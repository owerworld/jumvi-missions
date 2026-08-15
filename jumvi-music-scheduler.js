/**
 * JUMVI Music Scheduler
 * ---------------------
 * "Playlist değil, yaşayan sistem."
 *
 * Mimari: World Ambience (surekli, cok kisik) + Music Moments (fragmanlar,
 * shuffle bag ile secilir, aralarina degisken sessizlik) + SFX ducking.
 *
 * Kullanim:
 *   const scheduler = new JumviMusicScheduler({
 *     fragments: [
 *       { id: 'A', url: '/audio/JUMVI_FRAGMAN_A_mobil.opus', fallback: '/audio/JUMVI_FRAGMAN_A_mobil_EQ.mp3' },
 *       { id: 'B-alt', url: '/audio/JUMVI_FRAGMAN_B-alt_mobil.opus', fallback: '/audio/JUMVI_FRAGMAN_B-alt_mobil_EQ.mp3' },
 *     ],
 *     // Ambience dis dosya degil, JumviWorldAmbience ile procedurel uretilir (asagida).
 *   });
 *
 * jumvi-world-ambience.js dosyasi bu dosyadan ONCE yuklenmeli (ayni script
 * etiketiyle veya modul importuyla) — JumviMusicScheduler onu otomatik kullanir.
 *
 *   // Kullanicinin ilk dokunusundan SONRA cagir (autoplay policy):
 *   document.addEventListener('pointerdown', () => scheduler.start(), { once: true });
 *
 *   // Coach Leo konusmaya basladiginda / bitince:
 *   scheduler.duck();      // -7 dB, 200ms attack
 *   scheduler.unduck();    // 600ms release
 *
 *   // Mission complete / badge SFX calarken:
 *   scheduler.duckForSfx(1200); // -4 dB, 1.2sn sonra otomatik geri gelir
 */

class JumviMusicScheduler {
  constructor({
    fragments,
    musicGainDb = -23,      // fragmanlarin hedef seviyesi (LUFS'a yakin bir gain proxy'si)
    ambienceGainDb = -52,   // dusuruldu (-38 -> -52) — gercek cihazda "TV statigi" gibi
                             // algilanan gurultuyu gidermek icin (bkz. iPhone geri bildirimi)
    speechDuckDb = -7,
    sfxDuckDb = -4,
    useAmbience = true,     // JumviWorldAmbience yuklu ise procedurel dunya sesi calsin mi
  } = {}) {
    if (!fragments || fragments.length < 2) {
      throw new Error('En az 2 fragman gerekli (shuffle bag icin).');
    }
    this.fragments = fragments;
    this.useAmbience = useAmbience;
    this.musicGain = this._dbToGain(musicGainDb);
    this.ambienceGain = this._dbToGain(ambienceGainDb);
    this.speechDuckGain = this._dbToGain(speechDuckDb);
    this.sfxDuckGain = this._dbToGain(sfxDuckDb);

    this.ctx = null;
    this.musicBus = null;      // GainNode - fragmanlarin ortak cikisi
    this.ambienceBus = null;   // GainNode - ambience cikisi
    this._ambienceSource = null;
    this._bag = [];            // shuffle bag
    this._lastPlayedId = null;
    this._sessionStart = true;
    this._running = false;
    this._nextTimer = null;
    this._buffers = new Map(); // id -> AudioBuffer (once decode edilir, tekrar tekrar kullanilir)
    this._visibilityBound = this._onVisibilityChange.bind(this);
  }

  // ---------- Genel yasam dongusu ----------

  async start() {
    if (this._running) return;
    this._running = true;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicGain;
    this.musicBus.connect(this.ctx.destination);

    if (this.useAmbience && typeof JumviWorldAmbience !== 'undefined') {
      this.ambienceBus = this.ctx.createGain();
      this.ambienceBus.gain.value = this.ambienceGain; // procedurel katman kendi zarfini yonetiyor
      this.ambienceBus.connect(this.ctx.destination);
      this._ambience = new JumviWorldAmbience(this.ctx, this.ambienceBus, { gain: 1.0 });
      this._ambience.start();
    }

    document.addEventListener('visibilitychange', this._visibilityBound);

    // Ilk fragman: 3-10 sn icinde (Hub'a giris)
    this._scheduleNext(this._rand(3, 10));
  }

  stop() {
    this._running = false;
    if (this._nextTimer) clearTimeout(this._nextTimer);
    document.removeEventListener('visibilitychange', this._visibilityBound);
    this._ambience?.stop();
    if (this.ctx) {
      this.ctx.suspend();
    }
  }

  // ---------- Duck / unduck (Coach Leo konusmasi) ----------

  duck() {
    if (!this.musicBus) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicGain * this.speechDuckGain, now, 0.2 / 3); // ~200ms attack
  }

  unduck() {
    if (!this.musicBus) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicGain, now, 0.6 / 3); // ~600ms release
  }

  // ---------- SFX ducking (mission complete, badge vb.) ----------

  duckForSfx(durationMs = 1000) {
    if (!this.musicBus) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(this.musicGain * this.sfxDuckGain, now, 0.05 / 3); // hizli, 50ms
    this.musicBus.gain.setTargetAtTime(this.musicGain, now + durationMs / 1000, 0.4 / 3);
  }

  // ---------- Page Visibility: arka planda pil tuketmeyi durdur ----------

  _onVisibilityChange() {
    if (document.hidden) {
      if (this._nextTimer) clearTimeout(this._nextTimer);
      this.ctx?.suspend();
    } else {
      this.ctx?.resume();
      // Sekmeye donunce hemen degil, kisa bir gecikmeyle devam et
      this._scheduleNext(this._rand(5, 15));
    }
  }

  // ---------- Shuffle bag: ayni fragman arka arkaya asla ----------

  _nextFragmentId() {
    if (this._bag.length === 0) {
      this._bag = this.fragments.map(f => f.id).sort(() => Math.random() - 0.5);
      // Bir onceki oturumun son cikan fragmani yeni torbanin basina denk gelirse takasla
      if (this._bag[0] === this._lastPlayedId && this._bag.length > 1) {
        [this._bag[0], this._bag[1]] = [this._bag[1], this._bag[0]];
      }
    }
    const id = this._bag.shift();
    this._lastPlayedId = id;
    return id;
  }

  // ---------- Zamanlama: erken giris, sonra genisleyen bosluklar ----------

  _nextGapSeconds() {
    if (this._sessionStart) {
      this._sessionStart = false;
      return 0; // ilk fragman zaten _scheduleNext(3-10) ile planlandi
    }
    const roll = Math.random();
    if (roll < 0.08) return this._rand(80, 120);   // nadiren uzun bosluk
    if (this._fragmentCount < 2) return this._rand(25, 55); // ilk fragmandan sonra
    return this._rand(35, 80); // sonrasi
  }

  _scheduleNext(delaySeconds) {
    if (!this._running) return;
    this._nextTimer = setTimeout(() => this._playNextFragment(), delaySeconds * 1000);
  }

  async _playNextFragment() {
    if (!this._running) return;
    const id = this._nextFragmentId();
    const meta = this.fragments.find(f => f.id === id);
    const buffer = await this._loadBuffer(meta);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.musicBus);
    source.start();

    this._fragmentCount = (this._fragmentCount || 0) + 1;

    source.onended = () => {
      if (!this._running) return;
      this._scheduleNext(this._nextGapSeconds());
    };
  }

  // ---------- Yardimcilar ----------

  async _loadBuffer(meta) {
    if (this._buffers.has(meta.id)) return this._buffers.get(meta.id);
    let res = await fetch(meta.url);
    if (!res.ok && meta.fallback) res = await fetch(meta.fallback); // Opus desteklenmiyorsa MP3'e dus
    const arr = await res.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arr);
    this._buffers.set(meta.id, buffer);
    return buffer;
  }

  _dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  _rand(min, max) {
    // Tam saniyelere kilitlenmemek icin ondalikli
    return min + Math.random() * (max - min);
  }
}

// PWA ortaminda export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JumviMusicScheduler;
}
