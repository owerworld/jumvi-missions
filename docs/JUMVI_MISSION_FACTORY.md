# JUMVI Mission Factory — one command, generation to production

```sh
node tools/jumvi-mission-factory.mjs --count 6
```

That one command runs the entire generation pipeline — Lab generation,
duplicate/hard-gate/category checks, an independent Auditor pass, automatic
targeted revision — shows the Turkish human review, **persists the run, and
exits**. It never blocks a process waiting for a human to answer. When
you're ready to decide:

```sh
node tools/jumvi-mission-factory.mjs --resume <RUN_ID> --approve   # the single ONAY
node tools/jumvi-mission-factory.mjs --resume <RUN_ID> --cancel    # the single İPTAL
```

`--approve` re-fetches current `main`, re-validates if it moved, imports
(reusing `tools/import-approved-missions.mjs`), runs tests, branches,
pushes, opens a PR, waits for required CI + Cloudflare checks, merges only
if green, waits for deploy, verifies production — resuming the **exact
same audited batch** the review showed, never regenerating it. `--cancel`
makes zero repository writes. Neither command manually invokes a second
tool or copies a packet between steps; see
[Durable, resumable runs](#durable-resumable-runs) for why this is two
commands instead of one interactive prompt, and how a normal conversational
user never has to type a `RUN_ID` themselves.

By default this needs **no manually-set credentials** if your machine
already has the `claude` CLI logged in and `gh` authenticated — see
[Dependency check](#dependency-check) below. Default console output is
quiet: the generate command shows only the Turkish review and the `RUN_ID`
+ the two resume commands to run next; the resume commands show only one
final outcome line. Add `--verbose` to either for the full stage-by-stage
trace.

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

**İPTAL** (`--resume <RUN_ID> --cancel`) → stop. No repository change, no
PR, no deployment. Run artifacts are preserved under
`artifacts/mission-runs/<RUN_ID>/` for review.

**ONAY** (`--resume <RUN_ID> --approve`) → automatically, with no further
prompts:

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

## Durable, resumable runs

Generation and approval are two separate commands on purpose. A design
where one Node process runs generation, prints the review, then blocks on
`readline` waiting for a human to type `ONAY`/`İPTAL` cannot survive a
crash, a container restart, or a sandbox reclaiming a detached background
process between conversation turns — which is exactly what happened on the
first real run of this factory, losing a fully-audited, fully-approvable
batch for no reason related to the batch itself. The fix isn't a more
robust way to hold a process open; it's removing the requirement that any
one process stay alive across the human decision at all.

**What `--count N` actually does**: runs the pipeline, writes every fact a
later decision needs under `artifacts/mission-runs/<RUN_ID>/` — the final
approved batch (`05-final-approved-batch.json`), the site fingerprint it
was generated against (`00-site-fingerprint.json`), the Turkish review, and
`state.json` — prints the review and the two commands to run next, and
exits with code 0. Nothing is held in memory past that point.

**What `--resume <RUN_ID> --approve/--cancel` actually does**: reads
`state.json` and the persisted batch back off disk — never regenerates,
never trusts anything a caller might still be holding from generation —
and proceeds exactly as if it were the same process, because as far as the
pipeline is concerned it might as well be. `tools/check-mission-factory-
durability.mjs` proves this literally: one real, separate `node` process
generates and fully exits, then a second, unrelated `node` process resumes
by `RUN_ID` alone and publishes the same batch.

### Run states (`tools/factory/run-state.mjs`)

```
GENERATING → WAITING_FOR_HUMAN_APPROVAL → CANCELLED                  (İPTAL)
                                        → PUBLISHING → PUBLISHED       (ONAY, success)
                                                     → PUBLISH_STOPPED (ONAY, stopped for cause)
                                                     → FAILED          (ONAY, unexpected error)
GENERATING → FAILED                                                   (fail-closed pipeline error)
```

Every arrow above is the **entire** set of transitions the code will ever
perform — `transitionRunState()` is the sole place `state.json`'s `state`
field changes, and it throws `InvalidTransitionError` rather than silently
applying anything not on this list. That table, not a convention callers
have to remember, is what makes "a cancelled run cannot be approved" and "a
published run cannot be republished" actually true: `CANCELLED`,
`PUBLISHED`, and `PUBLISH_STOPPED` have zero outgoing transitions. A second
`--resume --approve` on an already-`PUBLISHED` (or `CANCELLED`, or
`PUBLISH_STOPPED`) run is refused, not re-executed — a `PUBLISH_STOPPED`
run is terminal on purpose, matching the existing stale-id-collision
guidance: re-run the factory for fresh ids rather than retrying.

`state.json` is written write-to-temp-then-`rename`, so a process killed
mid-write can never leave it half-written — a reader sees the complete old
version or the complete new version, never a corrupt mix. `readRunState()`
additionally validates shape (required fields, a recognised `state` value)
and throws `CorruptRunStateError` on anything else. Both error types (plus
a missing run entirely, `RunNotFoundError`) are fail-closed: `--resume`
refuses to proceed, it never guesses at a plausible-looking partial state.

### Simple UX, technical RUN_ID

A person talking to Claude Code still just says "6 yeni görev üret", reads
the Turkish review, and replies "ONAY" or "İPTAL" — they are not expected
to know the `RUN_ID` exists. The controlling Claude Code session reads the
`RUN_ID` the generate command printed and runs the matching `--resume`
command on the human's behalf; typing `--resume <RUN_ID> --approve` by
hand is for direct terminal / scripted use, not the normal conversational
path.

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

## Dependency check

Before any adapter is constructed, `main()` runs
`tools/factory/adapters/dependency-check.mjs`'s `checkDependencies()`,
**scoped to what the specific command being run actually needs** — the
generate/resume split means no single command needs everything anymore:

| Command | git | repo | `claude`/API key | `gh`/token |
|---|---|---|---|---|
| `--count N` (generate) | ✓ | ✓ | ✓ | — |
| `--resume … --approve` | ✓ | ✓ | — | ✓ |
| `--resume … --cancel` | — | ✓ | — | — |

Generation never touches GitHub; `--resume` never calls the Lab or
Auditor; `--cancel` makes zero repository writes and so needs neither.
Within whichever subset applies, checks run in this fixed priority order
and stop at the **first** thing missing:

1. `git` is on `PATH` (generate, approve only).
2. The current `--repo-root` looks like this repo (`data.js`,
   `tools/import-approved-missions.mjs`, `src/worker.js` all present, and
   it's a real git working tree).
3. Either the `claude` CLI is installed, **or** `ANTHROPIC_API_KEY` is set
   (generate only).
4. Either `gh` reports `gh auth status` success, **or** `GITHUB_TOKEN` is
   set (approve only).

On the first thing missing it prints **exactly one** short, actionable
Turkish message and exits — never a wall of diagnostics. A normal user with
Claude Code and `gh` already set up on their machine sees nothing here at
all; the check passes silently and the run proceeds.

## Isolated model context

Every Lab call and every Auditor call — including each revision round — is
a **fresh, stateless invocation** with no shared conversation state.

**Default (one-command mode): the locally authenticated `claude` CLI**
(`tools/factory/adapters/claude-cli.mjs`). Each call spawns a brand-new
`claude -p --output-format json --append-system-prompt "<pinned prompt>"`
subprocess with the structured task payload piped over stdin — never
`--continue`, `--resume`, or a shared session id, so each generation call,
each Auditor call, and each revision round is a genuinely new process, not
just a new logical request inside one shared conversation. This is what
lets a normal user run the factory without ever setting
`ANTHROPIC_API_KEY` themselves.

**Optional fallback: the direct Anthropic Messages API**
(`tools/factory/lab.mjs` / `tools/factory/auditor.mjs`, `createLive*Adapter`),
used only when the `claude` CLI isn't installed and `ANTHROPIC_API_KEY` is
set. Same isolation guarantee (a fresh, stateless HTTP request per call),
just a different transport.

Either way, the Auditor is explicitly instructed (in its pinned system
prompt, see below) not to defer to the Lab's own `uniqueness_rationale`,
and never to invent a replacement mechanic of its own — its structured
output contract has no field for handing back a mission, only text
`revision_instructions` a **fresh** Lab context must act on independently.

This factory never fabricates a credential. Building the live/CLI adapters
correctly is in scope for this implementation; actually running them for
real is a separately-reviewed decision the user makes later — nothing in
this repository's test suite ever calls a real LLM API, spawns a real
`claude`/`gh` process, pushes a real branch, or opens a real PR.

## Lab / Auditor prompts — pinned and versioned

The Lab and Auditor system prompts are not inlined as string literals in
`lab.mjs`/`auditor.mjs`/`claude-cli.mjs`. They live as plain text files
under `tools/factory/prompts/` (`lab.v1.txt`, `auditor.v1.txt`), loaded
through the one loader module, `tools/factory/prompts/prompts.mjs`
(`loadLabSystemPrompt()` / `loadAuditorSystemPrompt()`,
`LAB_PROMPT_VERSION` / `AUDITOR_PROMPT_VERSION`). Every adapter — mock,
direct-API, and `claude -p` — reports which `promptVersion` it used, so a
run's artifacts always resolve to the exact prompt text that produced them.
Bumping a prompt means adding a new `lab.vN.txt` / `auditor.vN.txt` file
and moving the version constant to it; the previous version stays on disk.

The Lab prompt pins: current-main sync first (a fresh structural-fingerprint
exclusion corpus every run/round, never a memorized list); no cosmetic
novelty (reskinning an existing mechanic is not a new mission); autonomous
player-count/difficulty/pack decisions; structural invention before naming;
never lowering quality to hit the requested count; and an explicit evidence
hierarchy (real observation > structural/physical reasoning > a
self-generated "simulated" playtest, which is never real-child evidence).

The Auditor prompt pins: independent live sync (re-derive duplicate status
itself); never inventing a replacement game; never trusting the Lab's own
conclusions; independent duplicate/category/HG10/physical/safety review;
the exact canonical verdict vocabulary; and no simulation claim without
reproducible evidence.

## Pinned governance (HG10 / Phase 3)

HG10 completeness and the Phase 3 physical principles are **not** defined
in `tools/factory/fingerprint.mjs` (an earlier build of this factory did
exactly that — invented its own `HARD_GATE_CHECKLIST` / `PHASE3_CONSTRAINTS`
lists and called them authoritative JUMVI governance; that has been
removed). They are pinned, versioned data:

- `tools/factory/governance/hg10-schema.json` — the 14 canonical Phase-3
  semantic fields (`player_count`, `ball_count`, `starting_positions`,
  `roles`, `starting_possession`, `objective`, `core_actions`,
  `event_triggers`, `consequences`, `role_transitions`, `continuation`,
  `reentry`, `difficulty_variables`, `safety_constraints`), the legacy
  field-name normalization map, the `consequences` merge rule,
  `safety_constraints` as mandatory-no-substitute, and the exact
  `HARD_FAIL — INCOMPLETE_PHYSICAL_GENOME (HG10)` error string.
- `tools/factory/governance/physical-principles.json` — the locked JUMVI
  physical-design law: `enforced: true` hard constraints (max 4 players,
  max 4 balls, only real JUMVI-set equipment, no rebound/bounce/racket
  -style/paddle-propelled mechanics) that deterministically hard-fail a
  candidate, and `enforced: false` / judgment-required entries (no
  impossible simultaneous states, no unsafe intended contact, requires
  valid continuation, no permanent meaningless participation) that are
  always surfaced to the Auditor as flags and **never** auto-promoted into
  a hard reject.

`tools/factory/governance/governance.mjs` is the **only** module allowed to
read those two files. `fingerprint.mjs` and `pipeline.mjs` consume its
exports (`validateHG10Genome`, `checkPhysicalPrinciples`); neither
redefines a rule list. A genome field that is genuinely absent is a
`HARD_FAIL`; a field the Lab honestly could not resolve and marked
`"UNKNOWN"` is **not** a hard fail, but is never silently treated as
resolved either — `pipeline.mjs` downgrades even an Auditor `APPROVE` into
a forced revision round if any `hg10_status.unknownFields` remain open, so
an unresolved field can never reach the published batch by the Auditor
simply overlooking it.

`tools/check-mission-factory-governance.mjs` proves all of this, including
that the validators' behavior is genuinely read from the JSON on disk (by
loading a deliberately mutated temp copy via `loadGovernanceFrom()` and
showing the same genome now validates differently) — governance drift
cannot silently happen.

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

Every Lab candidate must carry a `physical_genome` object (checked
structurally here; checked for HG10 *completeness* by the governance-driven
pre-Auditor gate above). Every `AuditorInput` carries a `governance` object
(the pinned HG10/Phase-3 versions and field list, sourced from
`governance.mjs`, never authored in `schemas.mjs`) and an `hg10_status`
object (this exact candidate's own missing/unknown genome fields) — the
Auditor is always told explicitly which fields, if any, are still
`UNKNOWN`, rather than having to guess.

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
`state.json` (see [Durable, resumable runs](#durable-resumable-runs)), the
site fingerprint, every Lab generation, every pre-audit check, every
Auditor round (initial + each reaudit), every revision packet, the final
approved batch, the Turkish review, the human decision, the import plan,
apply/test results, PR info, and the deployment result — one JSON file per
stage, plus `run.log`. **Never committed** (see `.gitignore` — only
`artifacts/mission-runs/.gitkeep` is tracked). `state.json` and the final
approved batch are the two files a `--resume` command actually depends on
to reconstruct the run; everything else here is audit trail.

## Test mode

```sh
node tools/check-mission-factory.mjs
node tools/check-mission-factory-governance.mjs
node tools/check-mission-factory-cli-adapters.mjs
node tools/check-mission-factory-cli-args.mjs
node tools/check-mission-factory-durability.mjs
```

Five suites, all fixtures/mocks only. **Nothing in any of them calls a
real LLM API, spawns a real `claude`/`gh` process, touches the real repo's
`data.js`, or makes a real GitHub/Cloudflare request** — except that
`check-mission-factory-durability.mjs` spawns real, separate `node`
subprocesses (still against a throwaway sandbox, still with mock/fake
adapters) specifically to prove cross-process durability, not to touch
anything real.

**`check-mission-factory.mjs`** drives the real `runFactory()`
orchestration — the same function the CLI's `main()` calls — with mock
Lab/Auditor adapters (`tools/factory/lab.mjs` / `auditor.mjs`,
`createMock*Adapter`) and fake git/github/cloudflare adapters
(`tools/factory/adapters/fake.mjs`). The only thing that runs for real is
the actual import against a throwaway sandbox directory (via
`--repo-root`-style parameterization, identical to how
`tools/check-mission-importer.mjs` already tests the importer alone), so a
passing run proves the real write/validation plumbing, not just control
flow. Covers, in one end-to-end run plus targeted scenario tests:

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

**`check-mission-factory-governance.mjs`** proves the pinned-governance
contract: HG10 canonical completeness (a complete genome passes; a missing
field hard-fails with the exact `HARD_FAIL — INCOMPLETE_PHYSICAL_GENOME
(HG10)` string); `UNKNOWN` staying `UNKNOWN` at both the governance-module
level and the full pipeline level (an Auditor that `APPROVE`s despite an
open `UNKNOWN` field is overridden by the deterministic gate, proven via a
deliberately misbehaving scripted Auditor); Phase-3 enforced-vs-judgment
separation; and governance drift detection (a mutated temp copy of the
pinned JSON changes validator behavior, proving it's data-driven, not
hardcoded — and a directory with no governance files fails loudly).

**`check-mission-factory-cli-adapters.mjs`** proves the one-command
defaults: the `claude -p` Lab/Auditor adapter's request shape (`-p
--output-format json --append-system-prompt`, payload on stdin, never a
session-continuation flag) and response parsing (including fail-closed
behavior on a bad process/response); the `gh` CLI GitHub adapter's request
shape (`gh api ... --input -`) and response parsing, matching
`adapters/github.mjs`'s semantics exactly; `checkClaudeCliInstalled` /
`checkGhCliAuthenticated`; the full `dependency-check.mjs` decision matrix
(CLI preferred, env-var fallback used only when the CLI truly isn't
available, in every combination); and the pinned prompts' required content.

**`check-mission-factory-cli-args.mjs`** proves the argument-parsing fix:
`--count 6` and `--count=6` parse identically; a bare or missing `--count`
is left unset (never coerced to a truthy `1`) and fails validation; zero,
negative, decimal, and non-numeric counts all fail; unknown positional
tokens never get silently consumed as some other flag's value; and the
same audit covers `tools/import-approved-missions.mjs`'s own value flags
(`--mode`, `--approved-by`, `--approved-count`, `--repo-root`), which had
the identical latent defect.

**`check-mission-factory-durability.mjs`** proves the durable/resumable
workflow: generation persists `WAITING_FOR_HUMAN_APPROVAL` and returns
without ever blocking on stdin; `--resume --approve`/`--cancel` reload the
persisted batch and site fingerprint from disk (structurally — neither
function even accepts the batch as a parameter); the existing stale-main
protection still applies through the new resume path; a run id that never
existed, a corrupted `state.json`, and a missing persisted-batch file all
fail closed via `RunNotFoundError`/`CorruptRunStateError` — the last case
additionally proving a failed load never leaves the run half-transitioned
into `PUBLISHING`; a second approve of an already-published run is
refused and nothing is published twice; a cancelled run cannot be
approved; a `PUBLISH_STOPPED` run (e.g. CI failure) is terminal, never
silently retried; and — the literal scenario this rework exists for — one
real `node` process generates and fully exits, then a second, completely
separate `node` process resumes by `RUN_ID` alone and publishes (or
cancels) the exact same audited batch.

## Guardrails (repeated, deliberately)

- This factory never creates a new pack.
- This factory never touches `src/worker.js`'s `PACK_KEYS` / `BADGE_IDS`
  analytics allowlists, and never loosens validation.
- `mergePullRequest` is only ever reached after required CI is green.
- A stale-main id collision is always a stop, never a force-merge.
- HG10/Phase-3 rules are pinned governance data
  (`tools/factory/governance/`), never a checklist authored in
  `fingerprint.mjs` or anywhere else in source.
- An `UNKNOWN` genome field is never silently treated as resolved, even if
  the Auditor itself returns `APPROVE_FOR_REAL_CHILD_PLAYTEST` — the
  deterministic gate has the final say on that one rule.
- Live mode prefers the locally authenticated `claude` / `gh` CLIs; it
  never fabricates or assumes `ANTHROPIC_API_KEY` / `GITHUB_TOKEN` — those
  remain optional fallbacks for when the CLIs aren't available.
- No command blocks on stdin waiting for a human. Generation persists and
  exits; approval/cancellation is always a separate `--resume` invocation
  against durable, on-disk state.
- A run's `state.json` transition table has no path back out of
  `CANCELLED` / `PUBLISHED` / `PUBLISH_STOPPED` — a cancelled run cannot
  be approved, a published run cannot be republished, and a stopped
  publish is never silently retried, all enforced by
  `tools/factory/run-state.mjs`, not by convention.
