/**
 * JUMVI Sonic Cues — Marka Motifi
 * -------------------------------
 * Motif: D -> A -> F# -> E  (Breath'in kendi perde ailesinden, yeden sesi yok)
 *
 * Kullanim stratejisi (dokumanda tarif edildigi gibi):
 *   Badge            -> D -> A                    (motifin parcasi)
 *   Mission complete -> D -> A -> F# -> E          (motifin tamami, ~1.2sn)
 *   Zone complete     -> dort nota birlikte + Dadd9 pad (motifin en dogrulandigi an)
 *   Certificate       -> motifin 3-4 saniyelik duygusal, uzatilmis versiyonu
 *
 * Zone complete icin Dmaj9 degil Dadd9 (D-F#-A-E) kullanildi — Dmaj9'daki C#
 * (yeden sesi) sistemin geri kalaninda bilincli olarak kacinilan tek nota.
 * Odul aninda bile modal tutarlilik korunuyor. Degistirmek istersen asagida
 * tek satir (ZONE_CHORD_HZ).
 *
 * Tum sesler prosedurel uretilir (dis dosya yok). Yumusak sine tabanli,
 * hafif ustharmonik ile "parlar ama batmaz" bir karakter — fragmanlarin
 * piyano sicakligindan bilinçli olarak biraz daha "gorunur", cunku bunlar
 * dikkat cekmesi gereken odul anlari.
 *
 * Kullanim:
 *   const cues = new JumviSonicCues(audioCtx, destinationNode, scheduler);
 *   cues.playBadge();
 *   cues.playMissionComplete();
 *   cues.playZoneComplete();
 *   cues.playCertificate();
 *
 *   // scheduler verilirse muzik otomatik duck edilir (duckForSfx cagrilir).
 */

class JumviSonicCues {
  // Motif notalari (Hz) — D4-A4-F#4-E4 orta oktavda, telefon hoparlorunde net duyulur
  static MOTIF_HZ = { D: 293.66, A: 440.00, Fs: 369.99, E: 329.63 };

  // Zone complete altligi: Dadd9 (D-A-D-E-F#), C# YOK — bkz. yukaridaki not
  static ZONE_CHORD_HZ = [146.83, 220.00, 293.66, 329.63, 369.99]; // D3 A3 D4 E4 F#4

  constructor(ctx, destination, scheduler = null) {
    this.ctx = ctx;
    this.destination = destination;
    this.scheduler = scheduler; // varsa duckForSfx() cagrilir
  }

  // ---------- Badge: D -> A (kisa, ~0.7sn) ----------

  playBadge() {
    this._duck(700);
    const now = this.ctx.currentTime;
    this._tone(JumviSonicCues.MOTIF_HZ.D, now, 0.35, 0.5);
    this._tone(JumviSonicCues.MOTIF_HZ.A, now + 0.22, 0.45, 0.5);
  }

  // ---------- Mission complete: D -> A -> F# -> E (~1.2sn) ----------

  playMissionComplete() {
    this._duck(1400);
    const now = this.ctx.currentTime;
    const { D, A, Fs, E } = JumviSonicCues.MOTIF_HZ;
    const step = 0.24;
    this._tone(D, now, 0.35, 0.45);
    this._tone(A, now + step, 0.35, 0.45);
    this._tone(Fs, now + step * 2, 0.35, 0.45);
    this._tone(E, now + step * 2.9, 0.55, 0.5); // son nota biraz uzun tutulur, cozulme hissi
  }

  // ---------- Zone complete: dort nota birlikte + Dadd9 pad (motifin ilk kez "cozuldugu" an) ----------

  playZoneComplete() {
    this._duck(3200);
    const now = this.ctx.currentTime;

    // Pad: Dadd9, yumusak, uzun sure
    JumviSonicCues.ZONE_CHORD_HZ.forEach((freq, i) => {
      this._tone(freq, now, 2.8, 0.22, { attack: 0.6, brightness: 1500 });
    });

    // Ustune motif, biraz gecikmeli, daha net — "cozulmenin" oldugu an
    const { D, A, Fs, E } = JumviSonicCues.MOTIF_HZ;
    const startDelay = 0.4;
    const step = 0.22;
    this._tone(D, now + startDelay, 0.4, 0.4, { brightness: 2600 });
    this._tone(A, now + startDelay + step, 0.4, 0.4, { brightness: 2600 });
    this._tone(Fs, now + startDelay + step * 2, 0.4, 0.4, { brightness: 2600 });
    this._tone(E, now + startDelay + step * 2.8, 0.9, 0.45, { brightness: 2600 });
  }

  // ---------- Certificate: motifin 3-4 saniyelik duygusal versiyonu ----------

  playCertificate() {
    this._duck(4200);
    const now = this.ctx.currentTime;
    const { D, A, Fs, E } = JumviSonicCues.MOTIF_HZ;

    // Alt oktavda pad destegi, uzun sure
    this._tone(D / 2, now, 3.8, 0.18, { attack: 1.0, brightness: 900 });
    this._tone(A / 2, now + 0.1, 3.6, 0.15, { attack: 1.0, brightness: 900 });

    // Motif, yavas ve genis araliklarla
    const step = 0.9;
    this._tone(D, now + 0.3, 1.0, 0.4, { attack: 0.3, brightness: 2200 });
    this._tone(A, now + 0.3 + step, 1.0, 0.4, { attack: 0.3, brightness: 2200 });
    this._tone(Fs, now + 0.3 + step * 2, 1.0, 0.4, { attack: 0.3, brightness: 2200 });
    this._tone(E, now + 0.3 + step * 2.9, 1.6, 0.45, { attack: 0.3, brightness: 2000 });
  }

  // ---------- Cekirdek ses uretici: yumusak sine + hafif ustharmonik ----------

  _tone(freq, startTime, duration, peakGain, opts = {}) {
    const ctx = this.ctx;
    const attack = opts.attack ?? 0.08;   // yumusak, tik yok — sistemin geri kalaniyla tutarli
    const brightness = opts.brightness ?? 2000; // lowpass kesim, "parlar ama batmaz"

    const osc = ctx.createOscillator();
    osc.type = 'sine';

    // Cok hafif bir ustharmonik katmani (triangle, -14dB) — sadece "canlilik", sertlik degil
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.2;

    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = brightness;
    filter.Q.value = 0.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(env);
    env.connect(this.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
    osc2.start(startTime);
    osc2.stop(startTime + duration + 0.1);
  }

  _duck(durationMs) {
    this.scheduler?.duckForSfx?.(durationMs);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JumviSonicCues;
}
