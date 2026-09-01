#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-factory-cli-args.mjs — regression suite for the shared
 * parseArgs() defect: `--count 6` (space-separated, exactly the syntax
 * documented everywhere and used in the very first real factory run)
 * silently became `count = true`, and `Number(true) === 1` slipped past
 * the "is this a positive integer" check -- so a real run requested with
 * `--count 6` silently generated exactly 1 mission, with no error, no
 * warning, nothing in the output to suggest anything was wrong.
 *
 * The fix (tools/import-approved-missions.mjs's parseArgs) adds an
 * explicit `valueFlags` allowlist: only flags a caller declares as
 * value-taking will consume a following space-separated token; anything
 * else keeps the exact old boolean-switch behavior. A declared value flag
 * given with no usable value (bare, or immediately followed by another
 * `--flag`) is left UNSET -- never coerced to `true` -- so it fails the
 * same "missing" validation a flag that was never passed at all would.
 *
 * This suite exercises the REAL exported VALUE_FLAGS sets from both CLI
 * entrypoints (tools/jumvi-mission-factory.mjs, tools/import-approved-
 * missions.mjs) through the REAL parseArgs() -- never a hand-copied
 * reimplementation that could silently drift out of sync with the actual
 * configuration those tools run with.
 *
 *   node tools/check-mission-factory-cli-args.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import { parseArgs, VALUE_FLAGS as IMPORTER_VALUE_FLAGS } from "./import-approved-missions.mjs";
import { VALUE_FLAGS as FACTORY_VALUE_FLAGS } from "./jumvi-mission-factory.mjs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission factory CLI argument-parsing contract\n");

/** Mirrors the exact validation main() applies to --count: a positive
 * integer, nothing else. */
function isValidCount(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 — --count: space form, equals form, bare, missing value.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const spaceForm = parseArgs(["--count", "6"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--count 6 (space-separated) parses count as the string \"6\"", spaceForm.count === "6");
  check("...which validates to exactly 6", isValidCount(spaceForm.count) === 6);

  const equalsForm = parseArgs(["--count=6"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--count=6 (equals) parses count as the string \"6\"", equalsForm.count === "6");
  check("...which ALSO validates to exactly 6 -- both forms behave identically", isValidCount(equalsForm.count) === 6);

  const bareAtEnd = parseArgs(["--count"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("a bare --count at the end of argv is left UNSET, never coerced to true", bareAtEnd.count === undefined);
  check("...so it fails validation exactly like a missing flag (never silently becomes 1 via Number(true))", isValidCount(bareAtEnd.count) === null);

  const bareThenFlag = parseArgs(["--count", "--verbose"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--count immediately followed by another --flag is treated as a missing value, not as verbose's value", bareThenFlag.count === undefined && bareThenFlag.verbose === true);
  check("...and count still fails validation", isValidCount(bareThenFlag.count) === null);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 — invalid count values (zero / negative / decimal / non-number) fail.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  for (const bad of ["0", "-1", "3.5", "abc", "", "6abc"]) {
    const parsed = parseArgs(["--count", bad], { valueFlags: FACTORY_VALUE_FLAGS });
    check(`--count ${JSON.stringify(bad)} fails validation`, isValidCount(parsed.count) === null, `parsed.count=${JSON.stringify(parsed.count)}`);
  }
  for (const bad of ["0", "-1", "3.5", "abc"]) {
    const parsed = parseArgs([`--count=${bad}`], { valueFlags: FACTORY_VALUE_FLAGS });
    check(`--count=${bad} (equals form) also fails validation`, isValidCount(parsed.count) === null);
  }
  const good = parseArgs(["--count", "1"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--count 1 is the smallest VALID count", isValidCount(good.count) === 1);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 — unknown positional tokens never silently alter configuration.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const parsed = parseArgs(["some-stray-token", "--count", "6", "another-stray"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("stray positional tokens around a value flag don't get consumed as its value", parsed.count === "6");
  check("...they land in `_` untouched, available but never silently applied as configuration", parsed._.length === 2 && parsed._.includes("some-stray-token") && parsed._.includes("another-stray"));

  const boolThenPositional = parseArgs(["--verbose", "unrelated-positional"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("a boolean-only flag (not in valueFlags) never swallows a following positional as its 'value'", boolThenPositional.verbose === true && boolThenPositional._.includes("unrelated-positional"));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 — --resume / --repo-root / --approved-by (factory CLI's other value
 * flags) round-trip both syntaxes correctly.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const spaceForm = parseArgs(["--resume", "20260901-run-abc", "--approve"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--resume RUN_ID (space) captures the run id as a string, not true", spaceForm.resume === "20260901-run-abc");
  check("--approve (a plain boolean, not a value flag) is unaffected", spaceForm.approve === true);

  const equalsForm = parseArgs(["--resume=20260901-run-abc", "--cancel"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--resume=RUN_ID (equals) captures the same run id", equalsForm.resume === "20260901-run-abc");

  const repoRootSpace = parseArgs(["--repo-root", "/tmp/some/dir", "--count", "6"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--repo-root /path (space) captures a real string path (would not throw in path.resolve)", repoRootSpace["repo-root"] === "/tmp/some/dir");

  const approvedBySpace = parseArgs(["--resume", "r1", "--approve", "--approved-by", "Jane Doe"], { valueFlags: FACTORY_VALUE_FLAGS });
  check("--approved-by \"Jane Doe\" (space) captures the full name as a string, not true", approvedBySpace["approved-by"] === "Jane Doe");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 — audit: tools/import-approved-missions.mjs's own value flags had the
 * exact same latent defect (--mode/--approved-by/--approved-count/
 * --repo-root all previously broke under space-separated syntax); prove
 * they're fixed too, through the real shared VALUE_FLAGS/parseArgs.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const modeSpace = parseArgs(["batch.json", "--mode", "apply"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check("importer: --mode apply (space) now parses mode as \"apply\", not true", modeSpace.mode === "apply");
  const modeEquals = parseArgs(["batch.json", "--mode=apply"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check("importer: --mode=apply (equals) still works identically", modeEquals.mode === "apply");

  const approvedBy = parseArgs(["batch.json", "--mode=apply", "--approved-by", "Jane Auditor"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check("importer: --approved-by \"Jane Auditor\" (space) captures the full string, not true", approvedBy["approved-by"] === "Jane Auditor");

  const approvedCount = parseArgs(["batch.json", "--mode=apply", "--approved-count", "3"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check(
    "importer: --approved-count 3 (space) captures \"3\" -- previously this could silently become Number(true)=1 and coincidentally slip past validation when the real eligible count was exactly 1",
    approvedCount["approved-count"] === "3" && Number(approvedCount["approved-count"]) === 3
  );

  const repoRoot = parseArgs(["batch.json", "--repo-root", "/tmp/sandbox"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check("importer: --repo-root /path (space) captures a real string (would previously crash path.resolve(true))", repoRoot["repo-root"] === "/tmp/sandbox");

  // Pure boolean switches are untouched by the fix -- they were never
  // meant to take a space-separated value and still don't.
  const booleans = parseArgs(["batch.json", "--json", "--skip-tests"], { valueFlags: IMPORTER_VALUE_FLAGS });
  check("importer: --json and --skip-tests remain plain booleans, unaffected by the value-flag mechanism", booleans.json === true && booleans["skip-tests"] === true);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 — default parseArgs() call (no valueFlags argument at all) is
 * byte-for-byte the OLD behavior -- any caller that hasn't opted in is
 * completely unaffected by this change.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const noOptIn = parseArgs(["--count", "6"]);
  check("without declaring valueFlags, --count behaves exactly as before the fix (a bare boolean switch)", noOptIn.count === true && noOptIn._.length === 1 && noOptIn._[0] === "6");
}

/* ── report ───────────────────────────────────────────────────────────── */
if (failures) {
  console.log(`\n❌ ${failures} CLI argument-parsing contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ --count (and every other declared value flag, in both CLIs) parses identically whether given as --flag value or --flag=value, fails closed on a missing/invalid value, and never lets a stray positional silently alter configuration.");
