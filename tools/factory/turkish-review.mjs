/* ═══════════════════════════════════════════════════════════════════════════
 * turkish-review.mjs — turns a FinalApprovedBatch into the concise Turkish
 * summary a human actually reads (never a JSON/genome dump), surfaces any
 * unresolved real-world safety flags BEFORE the approval prompt, and owns
 * the single ONAY/İPTAL gate.
 * ══════════════════════════════════════════════════════════════════════════*/
import readline from "node:readline";

const VERDICT_TR = {
  APPROVE_FOR_REAL_CHILD_PLAYTEST: "Gerçek çocuk playtestine onaylandı",
  REVISE_AND_REAUDIT: "Revizyon istendi",
  REJECT: "Reddedildi",
};

function missionBlockTr(entry) {
  const c = entry.candidate;
  const verdict = entry.auditor_output?.auditor_verdict;
  const flags = entry.auditor_output?.findings?.safety?.real_world_flags || [];
  const roundNote = entry.revision_round_used ? ` (revizyon turu: ${entry.revision_round_used})` : "";
  return [
    `Görev adı: ${c.title}`,
    `Kategori: ${c.pack}`,
    `Kaç kişi: ${c.players}`,
    `Nasıl oynanıyor: ${(c.steps || []).join(" → ")}`,
    `Kazanma/hedef: ${c.win}`,
    `Neden yeni/farklı: ${c.uniqueness_rationale || c.mechanics_summary || "-"}`,
    `Auditor sonucu: ${VERDICT_TR[verdict] || verdict || "-"}${roundNote}`,
    `Varsa gerçek hayatta dikkat edilecek nokta: ${flags.length ? flags.join("; ") : "Yok"}`,
  ].join("\n");
}

/** All real-world flags across the approved set, deduplicated, for the
 * "do not hide these" pre-approval callout. */
export function collectRealWorldFlags(finalBatch) {
  const flags = [];
  for (const entry of finalBatch.approved) {
    const perMission = entry.auditor_output?.findings?.safety?.real_world_flags || [];
    for (const f of perMission) flags.push({ mission: entry.candidate.title, flag: f });
  }
  return flags;
}

export function formatTurkishReview(finalBatch, requestedCount) {
  const approvedBlocks = finalBatch.approved.map(missionBlockTr);
  const revisedCount = finalBatch.approved.filter((e) => e.revision_round_used > 0).length;
  const rejectedCount = finalBatch.rejected_outright.length + finalBatch.revised_but_still_failed.length;
  const flags = collectRealWorldFlags(finalBatch);

  const lines = [];
  if (approvedBlocks.length === 0) {
    lines.push("Onaylanan görev yok.");
  } else {
    lines.push(approvedBlocks.join("\n\n"));
  }
  lines.push("");
  if (flags.length) {
    lines.push("⚠ Gerçek hayatta dikkat edilecek noktalar (ONAY vermeden önce okuyun):");
    for (const f of flags) lines.push(`  - ${f.mission}: ${f.flag}`);
    lines.push("");
  }
  lines.push(`Üretilmesi istenen: ${requestedCount}`);
  lines.push(`Onaylanan: ${finalBatch.approved.length}`);
  lines.push(`Revizyondan geçen: ${revisedCount}`);
  lines.push(`Reddedilen: ${rejectedCount}`);

  return { text: lines.join("\n"), flags, counts: { requested: requestedCount, approved: finalBatch.approved.length, revised: revisedCount, rejected: rejectedCount } };
}

/** Real, interactive human gate. Only "ONAY" or "İPTAL" (case-insensitive,
 * Turkish İ/I tolerant) are accepted; anything else re-prompts. Never
 * defaults to ONAY on empty/garbled input -- silence is IPTAL's neighbor,
 * not approval's. */
export function askForApprovalInteractive({ input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    const ask = () => {
      rl.question("YAYINLANSIN MI? [ONAY / İPTAL] ", (answer) => {
        const normalized = String(answer || "").trim().toLocaleUpperCase("tr");
        if (normalized === "ONAY") {
          rl.close();
          resolve("ONAY");
        } else if (normalized === "İPTAL" || normalized === "IPTAL") {
          rl.close();
          resolve("IPTAL");
        } else {
          output.write('Lütfen yalnızca "ONAY" veya "İPTAL" yazın.\n');
          ask();
        }
      });
    };
    ask();
  });
}

/** Test-mode / scripted approval: `decision` is "ONAY" or "IPTAL", provided
 * by the caller (a fixture test), never guessed by this module. */
export function createScriptedApproval(decision) {
  if (decision !== "ONAY" && decision !== "IPTAL") {
    throw new Error(`createScriptedApproval: decision must be "ONAY" or "IPTAL", got ${JSON.stringify(decision)}`);
  }
  return async () => decision;
}
