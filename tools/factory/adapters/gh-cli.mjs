/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/gh-cli.mjs — the DEFAULT GitHub adapter: shells out to the
 * locally authenticated `gh` CLI instead of calling the GitHub REST API
 * directly with a hand-supplied GITHUB_TOKEN. Same interface as
 * adapters/github.mjs (createPullRequest / waitForChecks / mergePullRequest)
 * so publish.mjs never knows which one it's holding -- and, for maximum
 * behavioral parity with that adapter, this one drives the exact same REST
 * endpoints via `gh api`, not `gh pr create`/`gh pr merge` convenience
 * subcommands, so response shapes and semantics don't drift between the
 * two adapters.
 *
 * `runner({ args, input }) => Promise<{ code, stdout, stderr }>` is
 * INJECTABLE so tests can exercise this adapter's request shape and
 * response parsing without ever invoking the real `gh` binary --
 * tools/check-mission-factory-cli-adapters.mjs always supplies a fake
 * runner. Nothing here is exercised against a real `gh` process in tests.
 * ══════════════════════════════════════════════════════════════════════════*/
import { spawn } from "node:child_process";

/** Real runner: spawns `gh` with `args`, writes `input` to its stdin (used
 * only when a JSON body is being piped via --input -), and resolves with
 * the collected exit code/stdout/stderr. Never invoked in this repo's test
 * suite -- tests always inject a fake runner. */
export async function defaultGhRunner({ args, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.write(input ?? "");
    child.stdin.end();
  });
}

async function inferOwnerRepo(runner) {
  const { code, stdout, stderr } = await runner({ args: ["repo", "view", "--json", "owner,name"], input: "" });
  if (code !== 0) throw new Error(`gh repo view --json owner,name failed: ${(stderr || stdout || "").slice(0, 300)}`);
  const data = JSON.parse(stdout);
  return { owner: data.owner.login, repo: data.name };
}

async function ghApi(runner, path, { method = "GET", body } = {}) {
  const args = ["api", path, "-X", method, "-H", "Accept: application/vnd.github+json"];
  let input = "";
  if (body !== undefined) {
    args.push("--input", "-");
    input = JSON.stringify(body);
  }
  const { code, stdout, stderr } = await runner({ args, input });
  if (code !== 0) {
    throw new Error(`gh api ${method} ${path} -> exit ${code}: ${(stderr || stdout || "").slice(0, 500)}`);
  }
  return stdout.trim() ? JSON.parse(stdout) : null;
}

export function createGhCliAdapter({ runner = defaultGhRunner, owner, repo } = {}) {
  let resolved = owner && repo ? { owner, repo } : null;
  async function ensureResolved() {
    if (!resolved) resolved = await inferOwnerRepo(runner);
    return resolved;
  }

  return {
    kind: "gh-cli",

    async createPullRequest({ title, head, base, body }) {
      const { owner, repo } = await ensureResolved();
      const pr = await ghApi(runner, `repos/${owner}/${repo}/pulls`, { method: "POST", body: { title, head, base, body } });
      return { number: pr.number, url: pr.html_url };
    },

    /** Polls check-runs on `ref` until every one is completed (or timeout).
     * Identical semantics to adapters/github.mjs's waitForChecks: success
     * only if every completed check-run's conclusion is "success",
     * "skipped", or "neutral" -- never partial. */
    async waitForChecks({ ref, timeoutMs = 10 * 60 * 1000, pollMs = 15000 }) {
      const { owner, repo } = await ensureResolved();
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const data = await ghApi(runner, `repos/${owner}/${repo}/commits/${ref}/check-runs`);
        const runs = data.check_runs || [];
        const allComplete = runs.length > 0 && runs.every((r) => r.status === "completed");
        if (allComplete) {
          const ok = runs.every((r) => ["success", "skipped", "neutral"].includes(r.conclusion));
          return { success: ok, timedOut: false, checks: runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })) };
        }
        if (Date.now() > deadline) {
          return { success: false, timedOut: true, checks: runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })) };
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }
    },

    /** Never force-merges. Standard merge only; GitHub itself refuses if
     * required status checks / branch protection aren't satisfied. */
    async mergePullRequest({ number, mergeMethod = "merge" }) {
      const { owner, repo } = await ensureResolved();
      const result = await ghApi(runner, `repos/${owner}/${repo}/pulls/${number}/merge`, { method: "PUT", body: { merge_method: mergeMethod } });
      return { merged: !!result.merged, sha: result.sha || null };
    },
  };
}

/** Dependency-check helper: is `gh` installed AND authenticated? `gh auth
 * status` exits 0 and reports "Logged in" details (on stderr, in real gh)
 * only when a token is actually configured -- this is the CLI's own
 * canonical readiness check, not reimplemented here. Used by
 * adapters/dependency-check.mjs. */
export async function checkGhCliAuthenticated({ runner = defaultGhRunner } = {}) {
  try {
    const { code, stdout, stderr } = await runner({ args: ["auth", "status"], input: "" });
    if (code !== 0) return { authenticated: false, reason: (stderr || stdout || "gh auth status exited non-zero").trim() };
    return { authenticated: true, detail: (stderr || stdout || "").trim() };
  } catch (e) {
    return { authenticated: false, reason: e.message };
  }
}
