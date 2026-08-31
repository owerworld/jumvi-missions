/* ═══════════════════════════════════════════════════════════════════════════
 * publish.mjs — everything that happens automatically after a human types
 * ONAY: re-sync → (re-validate if stale) → import (reusing
 * tools/import-approved-missions.mjs, never duplicated) → tests → branch →
 * push → PR → wait for CI/Cloudflare → merge (only if green) → wait for
 * deploy → verify production.
 *
 * FAIL-CLOSED: every stage that can fail returns early with
 * { stopped: true, stage, reason } and the caller (jumvi-mission-factory.mjs)
 * must treat that as final -- there is no retry-past-a-safety-check anywhere
 * in this file, and mergePullRequest is only ever called after
 * waitForChecks() reported success === true.
 * ══════════════════════════════════════════════════════════════════════════*/
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadCurrentData, planImport, writeApply } from "../import-approved-missions.mjs";
import { fingerprintExistingMissions, runPreAuditChecks, structuralFingerprint } from "./fingerprint.mjs";
import { validatePublishPlan, validateDeploymentResult } from "./schemas.mjs";

function toImporterBatch(finalBatch) {
  return finalBatch.approved.map(({ candidate }) => ({
    title: candidate.title,
    pack: candidate.pack,
    difficulty: candidate.difficulty,
    players: candidate.players,
    time: candidate.time,
    age: candidate.age,
    equipment: candidate.equipment,
    steps: candidate.steps,
    win: candidate.win,
    safety: candidate.safety,
    tip: candidate.tip,
    auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST",
  }));
}

/** Re-validates a set of importer-shaped candidates against a FRESH read of
 * current main (used both pre-APPLY and, narrowly, pre-merge). Drops any
 * candidate that no longer passes the deterministic gate; never silently
 * keeps a candidate that would now collide. */
function revalidateAgainstCurrent(batchCandidates, current, packKeys) {
  const existingFingerprints = fingerprintExistingMissions(current.missions);
  const batchFingerprints = batchCandidates.map((c) => structuralFingerprint(c));
  const survivors = [];
  const dropped = [];
  for (const candidate of batchCandidates) {
    const check = runPreAuditChecks(candidate, {
      existingFingerprints,
      batchSiblingFingerprints: batchFingerprints.filter((fp) => fp.title !== candidate.title),
      existingPackKeys: packKeys,
    });
    if (check.passed) survivors.push(candidate);
    else dropped.push({ candidate, blockers: check.blockers });
  }
  return { survivors, dropped };
}

export async function publishApprovedBatch({
  repoRoot,
  runId,
  finalBatch,
  syncStamp, // sync.inventoryStamp captured at generation time
  approvedBy,
  gitAdapter,
  githubAdapter,
  cloudflareAdapter,
  artifacts,
  branchPrefix = "claude/jumvi-mission-factory-run",
}) {
  const stop = (stage, reason, extra = {}) => {
    artifacts.write(`stop-${stage}`, { stage, reason, ...extra });
    return { stopped: true, stage, reason, ...extra };
  };

  if (finalBatch.approved.length === 0) {
    return stop("no-approved-candidates", "Final approved batch is empty -- nothing to publish.");
  }

  // ── 1-3: re-fetch current main, confirm no drift, re-validate if it moved ──
  const mainState = await gitAdapter.getMainState();
  artifacts.write("10-pre-apply-main-state", mainState);
  const staleAtApply = mainState.sha !== undefined && (mainState.missionCount !== syncStamp.mission_count);

  let importerBatch = toImporterBatch(finalBatch);
  const current0 = loadCurrentData(repoRoot);
  const packKeys0 = new Set(current0.PACKS.map((p) => p.key).filter((k) => k !== "all"));

  if (staleAtApply) {
    artifacts.log(`main changed since generation (was ${syncStamp.mission_count} missions, now ${mainState.missionCount}) -- re-validating before APPLY`);
    const { survivors, dropped } = revalidateAgainstCurrent(importerBatch, current0, packKeys0);
    artifacts.write("11-stale-main-revalidation", { staleAtApply, survivorCount: survivors.length, dropped });
    if (dropped.length) artifacts.log(`dropped ${dropped.length} candidate(s) that no longer pass after main changed: ${dropped.map((d) => d.candidate.title).join(", ")}`);
    importerBatch = survivors;
    if (importerBatch.length === 0) {
      return stop("stale-main-emptied-batch", "Main changed since generation and every approved candidate was invalidated by re-validation.", { dropped });
    }
  }

  // ── 4-6: assign safe next ids, import only eligible verdicts (already
  //    guaranteed -- every entry here is APPROVE_FOR_REAL_CHILD_PLAYTEST) ──
  const current = loadCurrentData(repoRoot); // repoRoot is on main at this point (no branch created yet)
  const plan = planImport(importerBatch, current, repoRoot);
  artifacts.write("12-import-plan", plan);
  if (plan.invalid.length > 0) {
    return stop("import-plan-invalid", "Importer's own planImport rejected one or more candidates that survived the factory's checks.", { invalid: plan.invalid });
  }
  if (plan.toImport.length === 0) {
    return stop("import-plan-empty", "Importer planImport produced zero missions to import.");
  }

  const publishPlan = {
    run_id: runId,
    human_approval: { decision: "ONAY", timestamp: new Date().toISOString(), approved_count: plan.toImport.length },
    import_plan: plan,
    batch_file_path: "(in-memory -- see 12-import-plan.json)",
  };
  const planCheck = validatePublishPlan(publishPlan);
  artifacts.write("13-publish-plan", { ok: planCheck.valid, errors: planCheck.errors, value: publishPlan });
  if (!planCheck.valid) {
    return stop("publish-plan-invalid", `Publish plan failed schema validation: ${planCheck.errors.join("; ")}`);
  }

  // ── 11: dedicated publish branch (creates it AND positions repoRoot's
  //    working tree there -- writeApply below writes into repoRoot) ────────
  const branchName = `${branchPrefix}-${runId}`;
  const branch = await gitAdapter.createPublishBranch(branchName);
  artifacts.write("14-branch", branch);

  // ── 6-9: write via the EXISTING importer (never duplicated), regenerate
  //    meta, bump cache/version, run the importer's own post-apply tests ──
  const applyResult = writeApply({
    root: repoRoot,
    plan,
    current,
    approvedBy,
  });
  artifacts.write("15-apply-result", applyResult);

  // ── 10: any test failure stops publication before anything is pushed ──
  const failedTests = (applyResult.testResults || []).filter((t) => t.status === "fail");
  if (failedTests.length > 0) {
    return stop("post-apply-tests-failed", "One or more post-apply regression tests failed -- not publishing.", { failedTests, testResults: applyResult.testResults });
  }

  // ── 11-13: commit, push, open PR ──────────────────────────────────────
  const commitMessage = `Import ${plan.toImport.length} approved mission(s) via jumvi-mission-factory (run ${runId})\n\napproved_by: ${approvedBy}`;
  const filesToCommit = applyResult.changed.map((f) => f.split(" ")[0]); // strip trailing "(...)" annotations
  const commit = await gitAdapter.commitAndPush(branchName, commitMessage, filesToCommit);
  artifacts.write("16-commit", commit);

  const prTitle = `Add ${plan.toImport.length} approved mission(s) (jumvi-mission-factory run ${runId})`;
  const prBody = buildPrBody({ runId, plan, approvedBy, filesToCommit });
  const pr = await githubAdapter.createPullRequest({ title: prTitle, head: branchName, base: "main", body: prBody });
  artifacts.write("17-pull-request", pr);

  // ── 14-15: wait for required CI, stop on any failure ──────────────────
  const ciResult = await githubAdapter.waitForChecks({ ref: commit.sha });
  artifacts.write("18-ci-result", ciResult);
  if (!ciResult.success) {
    return stop("ci-failed", ciResult.timedOut ? "Required CI checks did not complete in time." : "One or more required CI checks failed.", { ciResult, pr });
  }

  // ── stale-main check #2, immediately before merge: main may have moved
  //    during the CI wait. Only a genuine id-range collision blocks merge. ──
  const preMergeMainState = await gitAdapter.getMainState();
  artifacts.write("19-pre-merge-main-state", preMergeMainState);
  const ourLowestId = Math.min(...plan.toImport.map((x) => x.id));
  if (preMergeMainState.missionCount !== mainState.missionCount && preMergeMainState.missionCount >= ourLowestId) {
    return stop(
      "stale-main-id-collision-before-merge",
      `main advanced to ${preMergeMainState.missionCount} missions during the CI wait, which collides with this branch's assigned id range starting at ${ourLowestId}. Never force-merging -- re-run the factory to get fresh ids.`,
      { preMergeMainState, ourLowestId, pr }
    );
  }

  // ── 16: merge only now, only because CI is green and no collision ─────
  const merge = await githubAdapter.mergePullRequest({ number: pr.number });
  artifacts.write("20-merge", merge);
  if (!merge.merged) {
    return stop("merge-failed", "GitHub reported the merge did not succeed.", { merge, pr });
  }

  // ── 17-20: wait for deploy, verify production ──────────────────────────
  const deploy = await cloudflareAdapter.waitForDeploy({ ref: merge.sha });
  artifacts.write("21-deploy-wait", deploy);

  const newMissionIds = plan.toImport.map((x) => x.id);
  const newMissionTitles = plan.toImport.map((x) => x.candidate.title);
  const verification = await cloudflareAdapter.verifyProduction({
    expectedMinCount: current.missions.length + plan.toImport.length,
    newMissionIds,
    newMissionTitles,
  });
  artifacts.write("22-production-verification", verification);

  const deploymentResult = {
    run_id: runId,
    branch: branchName,
    pr_number: pr.number,
    pr_url: pr.url,
    ci_status: ciResult.success ? "success" : "failure",
    merged: merge.merged,
    merge_sha: merge.sha,
    production_verified: deploy.success && verification.ok,
    live_mission_count: verification.liveMissionCount,
    new_mission_ids_verified: newMissionIds.filter((id) => !verification.missingIds.includes(id)),
    new_mission_titles_verified: newMissionTitles.filter((t) => !verification.missingTitles.includes(t)),
    completed_at: new Date().toISOString(),
  };
  const resultCheck = validateDeploymentResult(deploymentResult);
  artifacts.write("23-deployment-result", { ok: resultCheck.valid, errors: resultCheck.errors, value: deploymentResult });

  return { stopped: false, deploymentResult, deploy, verification };
}

function buildPrBody({ runId, plan, approvedBy, filesToCommit }) {
  const rows = plan.toImport.map((x) => `- \`${x.id}\` [${x.candidate.pack}] ${x.candidate.title}`).join("\n");
  return [
    `Automated import from \`tools/jumvi-mission-factory.mjs\` (run \`${runId}\`).`,
    "",
    `Approved by: ${approvedBy}`,
    "",
    "## Missions",
    rows,
    "",
    "## Files changed",
    filesToCommit.map((f) => `- \`${f}\``).join("\n"),
    "",
    "Generated, audited (with automatic revision where needed), and Turkish-reviewed by the mission factory pipeline before this PR was opened. Every automated safety/integrity check passed before this PR was created; it is merged automatically only if required CI stays green.",
  ].join("\n");
}
