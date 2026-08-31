/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/cloudflare.mjs — production deploy wait + live verification.
 * Cloudflare posts its own build status as GitHub check runs on the commit
 * (the same "Workers Builds" / "Cloudflare Pages" / "Deploy Health Check"
 * checks this repo already runs) -- so "wait for Cloudflare" reuses the
 * GitHub adapter's check-run poller rather than inventing a second
 * mechanism. Live verification then hits the real site.
 * ══════════════════════════════════════════════════════════════════════════*/
import vm from "node:vm";

export function createCloudflareAdapter({ githubAdapter, siteUrl = "https://qr.jumvi.co/" }) {
  return {
    kind: "real",

    async waitForDeploy({ ref, timeoutMs = 5 * 60 * 1000, pollMs = 15000 }) {
      return githubAdapter.waitForChecks({ ref, timeoutMs, pollMs });
    },

    async verifyProduction({ expectedMinCount, newMissionIds = [], newMissionTitles = [] }) {
      const pageRes = await fetch(siteUrl);
      const httpStatus = pageRes.status;

      let liveMissionCount = null;
      let missingIds = [...newMissionIds];
      let missingTitles = [...newMissionTitles];
      let fetchError = null;

      try {
        const dataRes = await fetch(new URL("data.js", siteUrl));
        const dataText = await dataRes.text();
        const wrapped = `${dataText}\n;({ missions });`;
        const { missions } = vm.runInContext(wrapped, vm.createContext({}), { filename: "live-data.js" });
        liveMissionCount = missions.length;
        const idSet = new Set(missions.map((m) => m.id));
        const titleSet = new Set(missions.map((m) => m.title));
        missingIds = newMissionIds.filter((id) => !idSet.has(id));
        missingTitles = newMissionTitles.filter((t) => !titleSet.has(t));
      } catch (e) {
        fetchError = e.message;
      }

      const ok =
        httpStatus === 200 &&
        fetchError === null &&
        liveMissionCount !== null &&
        liveMissionCount >= expectedMinCount &&
        missingIds.length === 0 &&
        missingTitles.length === 0;

      return { ok, httpStatus, liveMissionCount, missingIds, missingTitles, fetchError };
    },
  };
}
