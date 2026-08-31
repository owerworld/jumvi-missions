/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/git.mjs — real git operations via child_process (execFileSync
 * with array args, never a shell string, so nothing here is injectable).
 * Used only by the real publish path; tests use adapters/fake.mjs instead.
 * ══════════════════════════════════════════════════════════════════════════*/
import { execFileSync } from "node:child_process";

function git(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

export function createGitAdapter({ repoRoot }) {
  return {
    kind: "real",

    /** Read-only: fetches origin/main and reads its data.js mission count
     * WITHOUT checking it out or touching the working tree -- safe to call
     * at any point, including mid-run for stale-state checks. */
    async getMainState() {
      git(repoRoot, ["fetch", "origin", "main"]);
      const sha = git(repoRoot, ["rev-parse", "origin/main"]);
      const dataJs = git(repoRoot, ["show", `origin/main:data.js`]);
      const missionCount = (dataJs.match(/^\s*m\(/gm) || []).length;
      return { sha, missionCount };
    },

    /** Resets the local branch to latest origin/main and checks it out --
     * the publish branch starts from exactly what was just verified. */
    async createPublishBranch(branchName) {
      git(repoRoot, ["fetch", "origin", "main"]);
      git(repoRoot, ["checkout", "-B", branchName, "origin/main"]);
      return { branch: branchName, baseSha: git(repoRoot, ["rev-parse", "HEAD"]) };
    },

    async commitAndPush(branchName, message, filePaths) {
      git(repoRoot, ["add", ...filePaths]);
      git(repoRoot, ["commit", "-m", message]);
      git(repoRoot, ["push", "-u", "origin", branchName]);
      return { sha: git(repoRoot, ["rev-parse", "HEAD"]) };
    },

    async revParse(ref) {
      return git(repoRoot, ["rev-parse", ref]);
    },
  };
}
