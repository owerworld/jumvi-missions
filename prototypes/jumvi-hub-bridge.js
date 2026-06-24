// Bridge: exposes what the 3D hub needs from the real app's classic-script scope
// (PACKS/missions/done/openMission) onto `window`, so the ES module script can
// reach them. Must be loaded with `defer` AFTER data.js and app.js. No app logic
// is reimplemented here — these are references to the real functions/data.
window.__jumviExports = { PACKS: PACKS, missions: missions, done: done, openMission: openMission };
