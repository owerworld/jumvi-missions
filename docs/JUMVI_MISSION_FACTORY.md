# JUMVI Mission Factory — one command, generation to production

```sh
node tools/jumvi-mission-factory.mjs --count 6
```

One command runs the entire pipeline — Lab generation, duplicate/hard-gate/category
checks, an independent Auditor pass, automatic targeted revision, a concise
Turkish human review, a single approval prompt, and (only on approval) the
full import → test → PR → CI → merge → production-verify flow. Nobody
manually invokes a second tool or copies a packet between steps.

This document is the operating manual. For the batch contract the importer
half of this system consumes, see
[`docs/AUTONOMOUS_MISSION_IMPORTER.md`](AUTONOMOUS_MISSION_IMPORTER.md) —
this factory produces exactly that contract and hands it to
`tools/import-approved-missions.mjs`, **reused, never duplicated**.

## The pipeline

```
CURRENT MAIN SYNC
  → LAB GENERATION
  → DUPLICATE / HARD-GATE / CATEGORY CHECKS   (deterministic, no model call)
  → INDEPENDENT AUDITOR                        (isolated model context)
  → TARGETED LAB REVISION  ⟲  up to 3 rounds    (fresh isolated context each time)
  → INDEPENDENT REAUDIT                        (fresh isolated context each time)
  → FINAL APPROVED MISSIONS
  → TURKİSH İNSAN İNCELEMESİ (Turkish human review)
  → "YAYINLANSIN MI? [ONAY / İPTAL]"
```

**İPTAL** → stop. No repository change, no PR, no deployment. Run artifacts
are preserved under `artifacts/mission-runs/<RUN_ID>/` for review.

**ONAY** → automatically, in the same process, with no further prompts:

1. Re-fetch current `main`.
2. Confirm the mission inventory hasn't changed since generation.
3. If it changed: re-run duplicate/id/category validation; drop any
   candidate that no longer passes; continue only if survivors remain.
4. Assign safe next mission ids (via the importer).
5. Import only `auditor_verdict = APPROVE_FOR_REAL_CHILD_PLAYTEST` candidates.
6. Add them using the **exact current `data.js` mission model** (the
   importer's `m(...)` renderer — no new UI, no new rendering path).
7. Regenerate/check `data/missions-meta.json`.
8. Bump cache/version files, only if there is actually something to bump.
9. Run the importer's own regression/schema tests against the write.
10. **Any test failure stops publication.** Nothing is pushed.
11. Create a dedicated publish branch.
12. Push it.
13. Open a PR to `main` automatically.
14. Wait for required GitHub + Cloudflare checks.
15. **Any required check failing stops publication** and is reported.
16. Only if every check is green: merge automatically. **Never force-merged.**
17. Wait for the Cloudflare production deploy.
18. Verify `https://qr.jumvi.co/` is live.
19. Verify the expected new mission count.
20. Verify the newly published mission ids/titles are actually on production.

The single `ONAY` is the human's authorization for the whole `IMPORT → TEST
→ PR → CI → MERGE → PRODUCTION DEPLOY` chain — but it only ever *reaches*
production if every one of the checks above stays green. Approval is
necessary, never sufficient.

## Fail-closed, always

None of the following can ever be skipped, bypassed, or downgraded to a
warning, regardless of how the human answers the approval prompt:

- schema validation (every structured Lab/Auditor payload — see below)
- duplicate validation (existing inventory *and* batch-internal)
- pack validation (never creates a new pack)
- mission-id collision / ceiling validation
- the importer's own regression tests
- `data/missions-meta.json` synchronization
- required GitHub CI
- required Cloudflare checks

A failure at any of these stops the run. `mergePullRequest` is *only* ever
called after `waitForChecks()` reports `success === true` — there is no
path in `tools/factory/publish.mjs` that reaches it otherwise, and it is
covered by a regression test (`tools/check-mission-factory.mjs`, "CI
failure → no merge").

## The Independent Auditor's verdict vocabulary

Identical to the standalone importer's contract:

| Verdict | Meaning |
|---|---|
| `APPROVE_FOR_REAL_CHILD_PLAYTEST` | Eligible — the only verdict that reaches the final batch |
| `REVISE_AND_REAUDIT` | Fixable — routed back to a **fresh** Lab context with the Auditor's findings, then to a **fresh** Auditor context, up to 3 times |
| `REJECT` | Not fixable — dropped immediately, no revision attempted |

If a candidate exhausts 3 revision rounds without an `APPROVE`, it is
**dropped from the final batch**. The factory never invents a weaker
replacement to hit the requested count — see
`tools/factory/pipeline.mjs`'s revision loop and the "Delta" fixture in the
test suite, which proves exactly this.

## "Isolated model context"

Every Lab call and every Auditor call — including each revision round — is
a **fresh, stateless request** to the Anthropic Messages API
(`tools/factory/lab.mjs` / `tools/factory/auditor.mjs`, live adapters). No
conversation history is shared between them, and the Auditor is explicitly
instructed not to defer to the Lab's own `uniqueness_rationale`. That
statelessness *is* the isolation — there is no cheaper or more literal way
to get independent model contexts from inside a plain Node script that
runs outside any particular agent host.

**Live mode requires `ANTHROPIC_API_KEY`** (for Lab/Auditor) **and
`GITHUB_TOKEN`** (for PR/CI/merge). This factory never fabricates either.
Building the live adapters correctly is in scope for this implementation;
actually running them against a real key is a separately-reviewed decision
the user makes later — nothing in this repository's test suite or in the
implementation session that built it ever called a real LLM API, pushed a
real branch, or opened a real PR.

## HG10 and Phase 3 — a stated assumption, not a hidden one

No existing "HG10" or "Phase 3 physical constraints" document was found
anywhere in this repository. `tools/factory/fingerprint.mjs` defines its own
10-item hard-gate checklist and 7-item physical-constraint checklist,
written to match what this product actually ships (2-4 players, ages 3-8,
six packs, "big-kid steps" phrasing). **If the real JUMVI production
pipeline has an authoritative HG10 / Phase 3 spec, replace
`HARD_GATE_CHECKLIST` / `PHASE3_CONSTRAINTS` in that one file** — every
consumer (the deterministic pre-Auditor gate, and the text handed to the
Auditor) reads them from there, never duplicates them inline.

## Duplicate / near-duplicate detection

`tools/factory/fingerprint.mjs` builds a structural fingerprint per mission
— pack + a token bag drawn from title/steps/win, stopword-filtered — and
compares candidates against **both** the live inventory and the rest of the
batch via Jaccard similarity (`NEAR_DUPLICATE_THRESHOLD = 0.5`, same-pack
overlap weighted slightly higher). This runs twice: once as a deterministic
pre-Auditor gate (cheap, catches the obvious cases before spending a model
call), and again independently inside the Auditor's own evaluation — the
Auditor is told to re-derive duplicate status itself, not trust the Lab's
claim of uniqueness.

## Structured internal contracts

Every model-to-model (and human-to-pipeline) handoff is a validated JSON
shape, enforced in `tools/factory/schemas.mjs` (hand-rolled, matching the
zero-dependency style the rest of `tools/*.mjs` already uses — the repo has
no JSON-Schema library):

- Lab output (`validateLabOutput`)
- Auditor input (`validateAuditorInput`)
- Auditor output (`validateAuditorOutput`)
- Revision packet (`validateRevisionPacket`)
- Final approved batch (`validateFinalApprovedBatch`)
- Publish plan (`validatePublishPlan`)
- Deployment result (`validateDeploymentResult`)

`validateOrRetry()` is the **only** sanctioned way a raw model response
becomes a trusted object: it calls the producer up to `maxAttempts` times,
and the first response to pass validation wins. A payload that never
validates fails the run closed (`FactoryFailClosedError`) — it is never
patched, guessed, or silently accepted partially invalid.

## The Turkish human review

Never a JSON/genome dump. Each approved mission renders as:

```
Görev adı: ...
Kategori: ...
Kaç kişi: ...
Nasıl oynanıyor: ...
Kazanma/hedef: ...
Neden yeni/farklı: ...
Auditor sonucu: ...
Varsa gerçek hayatta dikkat edilecek nokta: ...
```

Any unresolved real-world flag from the Auditor's safety findings
(collision/separation, interception/contact, age/motor uncertainty,
physical distance, multi-ball interference, behavioral competition risk) is
listed under a `⚠` callout **before** the summary counts and the approval
prompt — the human sees it, it is never hidden.

Then:

```
Üretilmesi istenen: N   — what was asked for
Onaylanan: N             — final approved count (what will be published)
Revizyondan geçen: N     — of the approved set, how many needed >=1 revision round to get there
Reddedilen: N            — rejected outright, plus candidates that exhausted all 3 revision rounds and were dropped
```

## Stale-state protection

Checked twice, per the spec's explicit requirement:

1. **Immediately before APPLY** (`tools/factory/publish.mjs`): if `main`'s
   mission count differs from what generation was evaluated against, every
   approved candidate is re-run through the deterministic gate against the
   *current* inventory. Survivors continue; anything that no longer passes
   is dropped and logged. If nothing survives, publication stops.
2. **Immediately before merge**: `main` may have moved again during the CI
   wait. This check is narrower and stricter — it only blocks on an actual
   **id-range collision** (main's new max id reaching into the range this
   branch already claimed), not on any drift. A collision **always** stops
   the run; the branch is never force-merged, and the fix is to re-run the
   factory for fresh ids, not to patch around it.

## Run artifacts

Every run writes a full record to `artifacts/mission-runs/<RUN_ID>/`:
the site fingerprint, every Lab generation, every pre-audit check, every
Auditor round (initial + each reaudit), every revision packet, the final
approved batch, the Turkish review, the human decision, the import plan,
apply/test results, PR info, and the deployment result — one JSON file per
stage, plus `run.log`. **Never committed** (see `.gitignore` — only
`artifacts/mission-runs/.gitkeep` is tracked).

## Test mode

```sh
node tools/check-mission-factory.mjs
```

Drives the real `runFactory()` orchestration — the same function the CLI's
`main()` calls — with mock Lab/Auditor adapters (`tools/factory/lab.mjs` /
`auditor.mjs`, `createMock*Adapter`) and fake git/github/cloudflare
adapters (`tools/factory/adapters/fake.mjs`). The only thing that runs for
real is the actual import against a throwaway sandbox directory (via
`--repo-root`-style parameterization, identical to how
`tools/check-mission-importer.mjs` already tests the importer alone), so a
passing run proves the real write/validation plumbing, not just control
flow. **Nothing in the test suite calls a real LLM API, touches the real
repo's `data.js`, or makes a real GitHub/Cloudflare request.**

Covers, in one end-to-end run plus targeted scenario tests:

- `APPROVE_FOR_REAL_CHILD_PLAYTEST` on the first pass
- `REVISE_AND_REAUDIT` → automatic Lab revision → re-Auditor `APPROVE`
- `REJECT` outright
- `REVISE_AND_REAUDIT` exhausting all 3 rounds → dropped, never replaced
- the Turkish review's flag surfacing and count arithmetic
- human `İPTAL` → zero repository writes
- CI failure → PR exists, never merged
- stale main with a safe (non-colliding) drift → re-validates and continues
- stale main with a colliding drift right before merge → stops, never merges
- invalid structured model output → fails closed, no retry-forever, no guess
- the importer's own rejection (defense in depth) → no PR ever created
- a failing post-apply regression test → stops before any push/PR

## Guardrails (repeated, deliberately)

- This factory never creates a new pack.
- This factory never touches `src/worker.js`'s `PACK_KEYS` / `BADGE_IDS`
  analytics allowlists, and never loosens validation.
- `mergePullRequest` is only ever reached after required CI is green.
- A stale-main id collision is always a stop, never a force-merge.
- Live mode requires the human to supply real credentials
  (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) — this implementation never
  fabricates or assumes one.
