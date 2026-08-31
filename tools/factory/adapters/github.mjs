/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/github.mjs — real GitHub REST API via fetch + GITHUB_TOKEN. Used
 * only by the real publish path; tests use adapters/fake.mjs instead.
 *
 * This is what a standalone `node tools/jumvi-mission-factory.mjs` run
 * (outside Claude Code, outside any agent host) uses for PR creation, CI
 * polling, and merge -- it cannot depend on this session's MCP GitHub tools,
 * which don't exist in that context.
 * ══════════════════════════════════════════════════════════════════════════*/
import { execFileSync } from "node:child_process";

const API = "https://api.github.com";

function inferOwnerRepo(repoRoot) {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!m) throw new Error(`could not parse owner/repo from git remote "${url}"`);
  return { owner: m[1], repo: m[2] };
}

export function createGitHubAdapter({ repoRoot, token = process.env.GITHUB_TOKEN, owner, repo } = {}) {
  if (!token) {
    throw new Error("createGitHubAdapter requires GITHUB_TOKEN. This factory never fabricates a token -- set the env var yourself before using --mode live.");
  }
  const resolved = owner && repo ? { owner, repo } : inferOwnerRepo(repoRoot);

  async function api(path, init = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${init.method || "GET"} ${path} -> ${res.status}: ${body.slice(0, 500)}`);
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    kind: "real",
    owner: resolved.owner,
    repo: resolved.repo,

    async createPullRequest({ title, head, base, body }) {
      const pr = await api(`/repos/${resolved.owner}/${resolved.repo}/pulls`, {
        method: "POST",
        body: JSON.stringify({ title, head, base, body }),
      });
      return { number: pr.number, url: pr.html_url };
    },

    /** Polls check-runs on `ref` until every one is completed (or timeout).
     * success = true only if every completed check-run's conclusion is
     * "success", "skipped", or "neutral" -- any "failure"/"cancelled"/
     * "timed_out"/"action_required" makes success = false. Never partial. */
    async waitForChecks({ ref, timeoutMs = 10 * 60 * 1000, pollMs = 15000 }) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const data = await api(`/repos/${resolved.owner}/${resolved.repo}/commits/${ref}/check-runs`);
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
      const result = await api(`/repos/${resolved.owner}/${resolved.repo}/pulls/${number}/merge`, {
        method: "PUT",
        body: JSON.stringify({ merge_method: mergeMethod }),
      });
      return { merged: !!result.merged, sha: result.sha || null };
    },
  };
}
