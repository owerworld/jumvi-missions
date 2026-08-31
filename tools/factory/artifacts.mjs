/* ═══════════════════════════════════════════════════════════════════════════
 * artifacts.mjs — every factory run writes a full, inspectable record to
 * artifacts/mission-runs/<RUN_ID>/. Never committed (see .gitignore); this
 * is the audit trail a human reviews if anything looks wrong, and what the
 * fixture test suite reads back to assert pipeline behavior.
 * ══════════════════════════════════════════════════════════════════════════*/
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";

export function newRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}`;
}

export function artifactsRoot(repoRoot) {
  return path.join(repoRoot, "artifacts", "mission-runs");
}

export function runDir(repoRoot, runId) {
  return path.join(artifactsRoot(repoRoot), runId);
}

export class RunArtifacts {
  constructor(repoRoot, runId) {
    this.repoRoot = repoRoot;
    this.runId = runId;
    this.dir = runDir(repoRoot, runId);
    mkdirSync(this.dir, { recursive: true });
  }

  write(name, data) {
    const file = path.join(this.dir, `${name}.json`);
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    return file;
  }

  writeText(name, text) {
    const file = path.join(this.dir, name);
    writeFileSync(file, text);
    return file;
  }

  log(line) {
    const stamp = new Date().toISOString();
    appendFileSync(path.join(this.dir, "run.log"), `[${stamp}] ${line}\n`);
  }

  exists(name) {
    return existsSync(path.join(this.dir, `${name}.json`));
  }
}
