/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/fake.mjs — in-memory git/github/cloudflare doubles for
 * tools/check-mission-factory.mjs. Same interface as the real adapters
 * (adapters/git.mjs, adapters/github.mjs, adapters/cloudflare.mjs) so
 * publish.mjs never knows which one it's holding.
 *
 * DESIGN: the actual file-writing (the importer's real APPLY) still runs
 * for real against a throwaway sandbox `repoRoot` -- these fakes only
 * simulate the NETWORKED parts (git push, GitHub PR/CI/merge, Cloudflare
 * deploy). verifyProduction() reads the sandbox's data.js directly, which
 * is genuinely what the importer wrote -- so a passing test proves the real
 * import + validation plumbing, not just the orchestration's control flow.
 * ══════════════════════════════════════════════════════════════════════════*/
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function createFakeAdapters({
  repoRoot,
  initialMainSha = "fake-main-sha-0",
  initialMainMissionCount,
  ciOutcome = "success", // "success" | "failure" | "timeout"
  deployOutcome = "success", // "success" | "failure"
} = {}) {
  if (!repoRoot) throw new Error("createFakeAdapters requires repoRoot (the sandbox the importer writes into)");

  const state = {
    mainSha: initialMainSha,
    mainMissionCount: initialMainMissionCount,
    branches: {},
    prs: [],
    merged: null,
    checkRunsCalled: 0,
  };

  const git = {
    kind: "fake",
    async getMainState() {
      return { sha: state.mainSha, missionCount: state.mainMissionCount };
    },
    async createPublishBranch(branchName) {
      state.branches[branchName] = { baseSha: state.mainSha };
      return { branch: branchName, baseSha: state.mainSha };
    },
    // The importer already wrote the real files into repoRoot by this point
    // (publish.mjs calls it before commitAndPush) -- this just records that
    // a "commit" happened, it does not touch git at all.
    async commitAndPush(branchName, message, filePaths) {
      const b = state.branches[branchName];
      if (!b) throw new Error(`fake git: branch ${branchName} was never created`);
      b.committed = true;
      b.commitMessage = message;
      b.filePaths = filePaths;
      b.sha = `${branchName}-sha`;
      return { sha: b.sha };
    },
    async revParse(ref) {
      if (ref === "HEAD") {
        const names = Object.keys(state.branches);
        return state.branches[names[names.length - 1]]?.sha || state.mainSha;
      }
      return state.mainSha;
    },
  };

  const github = {
    kind: "fake",
    async createPullRequest({ title, head, base, body }) {
      const number = state.prs.length + 1;
      const pr = { number, url: `https://fake.example/pr/${number}`, title, head, base, body, state: "open" };
      state.prs.push(pr);
      return { number: pr.number, url: pr.url };
    },
    async waitForChecks({ ref }) {
      state.checkRunsCalled += 1;
      if (ciOutcome === "success") {
        return { success: true, timedOut: false, checks: [{ name: "guard", status: "completed", conclusion: "success" }] };
      }
      if (ciOutcome === "timeout") {
        return { success: false, timedOut: true, checks: [{ name: "guard", status: "in_progress", conclusion: null }] };
      }
      return { success: false, timedOut: false, checks: [{ name: "guard", status: "completed", conclusion: "failure" }] };
    },
    async mergePullRequest({ number, mergeMethod = "merge" }) {
      if (ciOutcome !== "success") {
        // Mirrors the real GitHub API's own refusal -- and publish.mjs must
        // never reach this call when CI isn't green in the first place.
        throw new Error("fake github: cannot merge, CI is not green");
      }
      const pr = state.prs.find((p) => p.number === number);
      if (!pr) throw new Error(`fake github: no such PR #${number}`);
      const branch = state.branches[pr.head];
      const sha = `merge-${branch.sha}`;
      state.merged = { number, sha };
      state.mainSha = sha;
      pr.state = "merged";
      return { merged: true, sha };
    },
  };

  const cloudflare = {
    kind: "fake",
    async waitForDeploy({ ref }) {
      if (deployOutcome === "success") {
        return { success: true, timedOut: false, checks: [{ name: "Deploy Health Check", status: "completed", conclusion: "success" }] };
      }
      return { success: false, timedOut: false, checks: [{ name: "Deploy Health Check", status: "completed", conclusion: "failure" }] };
    },
    async verifyProduction({ expectedMinCount, newMissionIds = [], newMissionTitles = [] }) {
      let liveMissionCount = null;
      let missingIds = [...newMissionIds];
      let missingTitles = [...newMissionTitles];
      let fetchError = null;
      try {
        const dataText = readFileSync(path.join(repoRoot, "data.js"), "utf8");
        const wrapped = `${dataText}\n;({ missions });`;
        const { missions } = vm.runInContext(wrapped, vm.createContext({}), { filename: "fake-production-data.js" });
        liveMissionCount = missions.length;
        const idSet = new Set(missions.map((m) => m.id));
        const titleSet = new Set(missions.map((m) => m.title));
        missingIds = newMissionIds.filter((id) => !idSet.has(id));
        missingTitles = newMissionTitles.filter((t) => !titleSet.has(t));
      } catch (e) {
        fetchError = e.message;
      }
      const ok =
        fetchError === null &&
        liveMissionCount !== null &&
        liveMissionCount >= expectedMinCount &&
        missingIds.length === 0 &&
        missingTitles.length === 0;
      return { ok, httpStatus: 200, liveMissionCount, missingIds, missingTitles, fetchError };
    },
  };

  return {
    git,
    github,
    cloudflare,
    state,
    /** Test helper: simulate main moving underneath the run (someone else
     * merged in the meantime) -- the next getMainState() call reflects it. */
    simulateMainChanged({ sha, missionCount }) {
      state.mainSha = sha;
      state.mainMissionCount = missionCount;
    },
  };
}
