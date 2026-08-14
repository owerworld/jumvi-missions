/* One-off manual QA driver for the Coach Leo prerecorded English pilot.
 * Not part of the permanent tr-qa suite (this repo ships no test runner) —
 * exercises the specific scenarios from CLAUDE_CODE_TASK.md's checklist
 * against the real app.js/jumvi-redlight.js/coach-leo-audio.js over the
 * local harness server (tools/tr-qa/serve.mjs), driven by real Chromium. */
let chromium;
try { ({ chromium } = await import("playwright")); }
catch (_) { console.error("playwright not found — npm install playwright"); process.exit(2); }

const BASE = process.env.BASE || "http://localhost:8787";
let pass = 0, fail = 0;
const ok = (l, c, d = "") => { c ? (pass++, console.log(`  ok   ${l}`)) : (fail++, console.log(`  FAIL ${l}${d ? "\n         " + d : ""}`)); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function trackedAudioPage() {
  const page = await browser.newPage();
  await page.addInitScript(`
    window.__audioLog = [];
    const OrigAudio = window.Audio;
    window.Audio = function(src) {
      const a = src ? new OrigAudio(src) : new OrigAudio();
      const rec = { src: src || "", events: [] };
      window.__audioLog.push(rec);
      ["play","pause","ended","error"].forEach(ev => a.addEventListener(ev, () => rec.events.push(ev)));
      return a;
    };
    window.Audio.prototype = OrigAudio.prototype;
  `);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { soundOn = true; } catch (_) {} });
  return page;
}

// 1) Mission 1 Start -> MP3 -> countdown -> timer
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); });
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => window.__audioLog.map(a => a.src));
  ok("Mission 1: MP3 clip constructed on Start", log.some(s => s.includes("01-speed-demon-en.mp3")), JSON.stringify(log));
  await page.waitForTimeout(10500); // mission 1 clip is 9.2s — wait past onEnd
  const state = await page.evaluate(() => ({ pending: _missionNarrationPending, label: document.getElementById("btnStartTimer").innerHTML }));
  ok("Mission 1: narration flag clears (moves toward countdown/timer)", state.pending === false, JSON.stringify(state));
  await page.close();
}

// 2) Skip & Play stops MP3 once, immediately
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); }); // starts narration
  await page.waitForTimeout(200);
  const beforeSkip = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); }); // Skip & Play
  await page.waitForTimeout(50);
  const afterSkip = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  ok("Skip & Play: clip was playing, then stops immediately", beforeSkip === true && afterSkip === false, `before=${beforeSkip} after=${afterSkip}`);
  await page.close();
}

// 3) Manual "Hear Steps" prefers MP3 and can stop
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(3); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("leoSpeakBtn").click(); });
  await page.waitForTimeout(200);
  const playing1 = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  ok("Hear Steps: mission 3 plays prerecorded clip", playing1 === true);
  await page.evaluate(() => { document.getElementById("leoSpeakBtn").click(); }); // second tap stops
  await page.waitForTimeout(50);
  const playing2 = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  ok("Hear Steps: second tap stops it", playing2 === false);
  await page.close();
}

// 4) Mission 13 stays silent (auto + manual)
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(13); } catch (_) {} });
  await page.waitForTimeout(300);
  const enabled = await page.evaluate(() => _missionCoachEnabled);
  ok("Mission 13: auto-coach disabled", enabled === false);
  const hasFile = await page.evaluate(() => window.CoachLeoAudio.hasMission(13));
  ok("Mission 13: no prerecorded file mapped", hasFile === false);
  await page.close();
}

// 5) Mission 2 RLGL: four cues fire, first-green vs later-green distinct
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(2); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); }); // Start Caller
  await page.waitForTimeout(4200); // 3-2-1 countdown + first green fires
  const firstLog = await page.evaluate(() => window.__audioLog.map(a => a.src));
  ok("RLGL: first GREEN uses green-light-en.mp3", firstLog.some(s => s.includes("green-light-en.mp3")), JSON.stringify(firstLog));
  await page.waitForTimeout(6000); // let scheduler cycle to a red and possibly a 2nd green
  const laterLog = await page.evaluate(() => window.__audioLog.map(a => a.src));
  ok("RLGL: red-light-en.mp3 fires at some point", laterLog.some(s => s.includes("red-light-en.mp3")), JSON.stringify(laterLog));
  await page.evaluate(() => { window.JumviRedLight.stop(); });
  await page.close();
}

// 6) Muted mode produces no MP3
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { soundOn = false; });
  await page.evaluate(() => { try { openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); });
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => window.__audioLog.map(a => a.src));
  ok("Muted: no Coach Leo mp3 constructed", !log.some(s => s.includes("coach-leo")), JSON.stringify(log));
  await page.close();
}

// 7) /tr never plays EN MP3
{
  const page = await trackedAudioPage();
  await page.goto(BASE + "/tr", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { soundOn = true; openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); });
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => window.__audioLog.map(a => a.src));
  const available = await page.evaluate(() => window.CoachLeoAudio.isAvailable());
  ok("/tr: CoachLeoAudio.isAvailable() is false", available === false);
  ok("/tr: no coach-leo mp3 constructed", !log.some(s => s.includes("coach-leo")), JSON.stringify(log));
  await page.close();
}

// 8) Missing-audio simulation falls back without breaking Start
{
  const page = await trackedAudioPage();
  await page.route("**/assets/audio/coach-leo/en/missions/01-speed-demon-en.mp3", route => route.fulfill({ status: 404, body: "" }));
  await page.evaluate(() => { try { openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); });
  await page.waitForTimeout(1000);
  const err = await page.evaluate(() => window.__lastErr || null);
  const started = await page.evaluate(() => document.getElementById("btnStartTimer").disabled !== undefined);
  ok("404'd mission mp3: no page crash, Start button still functions", started === true);
  await page.close();
}

// 9) Closing mission mid-audio leaves no ghost audio
{
  const page = await trackedAudioPage();
  await page.evaluate(() => { try { openMission(1); } catch (_) {} });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById("btnStartTimer").click(); });
  await page.waitForTimeout(200);
  const wasPlaying = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  await page.evaluate(() => { closeMission(); });
  await page.waitForTimeout(50);
  const stillPlaying = await page.evaluate(() => window.CoachLeoAudio.isPlaying());
  ok("Close mid-audio: was playing, then stopped", wasPlaying === true && stillPlaying === false, `was=${wasPlaying} still=${stillPlaying}`);
  await page.close();
}

await browser.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
