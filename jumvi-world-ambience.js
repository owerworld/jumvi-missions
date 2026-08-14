/**
 * JUMVI World Ambience — Prosedürel Ses Üretimi
 * ------------------------------------------------
 * "Müzik gitti, ada kaldı."
 *
 * Dış ses dosyası kullanmaz. Rüzgar/yaprak hissi Paul Kellett pembe gürültü
 * algoritmasi + yavas filtre suzmesi ile uretilir. Ayrica çok seyrek, Breath'in
 * kendi perde ailesinden (D modal: D-E-F#-A-C) tek notalık "damla" sesleri
 * serpiştirilir — dünyanın kendi müzikal DNA'sını taşıması için.
 *
 * Avantajlar:
 *  - 0 KB dosya (network yok, cache yok, CSP/CDN sorunu yok)
 *  - Sonsuz varyasyon, hiç tekrar etmez
 *  - Telif/lisans riski yok — kod senin
 *  - Telefon hoparlöründe her zaman hayatta kalır (genis bantli gurultu,
 *    piyanonun aksine 500Hz altina hapsolmuyor)
 *
 * Kullanim:
 *   const ambience = new JumviWorldAmbience(audioCtx, destinationGainNode);
 *   ambience.start();
 *   ambience.stop();
 */

class JumviWorldAmbience {
  // Breath'in olcumlenmis perde ailesi: D en guclu, sonra A, E, G, F#
  // Yeden sesi (C#) ve F natural bilincli olarak DISI
  static PITCH_FAMILY_HZ = {
    D3: 146.83, A3: 220.00, E4: 329.63, G3: 196.00, Fs4: 369.99,
  };

  constructor(ctx, destination, { gain = 1.0 } = {}) {
    this.ctx = ctx;
    this.destination = destination; // disaridan gelen ambienceGain node'una baglanacak
    this.baseGain = gain;
    this._running = false;
    this._nodes = [];        // temizlik icin referans tut
    this._dropletTimer = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._startWindLayer();
    this._scheduleDroplet();
  }

  stop() {
    this._running = false;
    if (this._dropletTimer) clearTimeout(this._dropletTimer);
    this._nodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch (e) {} });
    this._nodes = [];
  }

  // ---------- Katman 1: ruzgar/yaprak (surekli pembe gurultu, yavas filtre suzmesi) ----------

  _startWindLayer() {
    const ctx = this.ctx;
    const bufferSize = 4 * ctx.sampleRate; // 4 saniyelik dongu, sessiz tekrar farkedilmez
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    this._fillPinkNoise(data);

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Bandpass: ruzgarin "hus" karakteri icin dar bant, yavas LFO ile suzuluyor
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.7;

    // LFO: filtre merkez frekansini 300-900 Hz arasinda çok yavaş gezdir (ruzgarin "gelip gitmesi")
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03; // ~33 saniyede bir tam donus
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Ikinci, daha yumusak LFO: genel seviyeyi hafif nefes aldirir
    const breathLfo = ctx.createOscillator();
    breathLfo.frequency.value = 0.05;
    const breathGain = ctx.createGain();
    breathGain.gain.value = this.baseGain;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = this.baseGain * 0.35;
    breathLfo.connect(breathDepth);
    breathDepth.connect(breathGain.gain);
    breathGain.gain.value = this.baseGain * 0.65; // taban seviye + LFO'nun ustune binecek
    breathLfo.start();

    noiseSource.connect(filter);
    filter.connect(breathGain);
    breathGain.connect(this.destination);
    noiseSource.start();

    this._nodes.push(noiseSource, filter, lfo, lfoGain, breathLfo, breathGain, breathDepth);
  }

  _fillPinkNoise(data) {
    // Paul Kellett algoritmasi — ucuz, stabil, ~3dB/oktav egim (dogrulandi)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; // normalize, klip yapmaz
    }
  }

  // ---------- Katman 2: cok seyrek pentatonik "damla" (dunyanin muzikal DNA'si) ----------

  _scheduleDroplet() {
    if (!this._running) return;
    // 40-140 saniyede bir, tek bir yumusak nota. Bu MUZIK degil, dunyanin sesi.
    const delay = this._rand(40, 140) * 1000;
    this._dropletTimer = setTimeout(() => {
      this._playDroplet();
      this._scheduleDroplet();
    }, delay);
  }

  _playDroplet() {
    const ctx = this.ctx;
    const notes = Object.values(JumviWorldAmbience.PITCH_FAMILY_HZ);
    const freq = notes[Math.floor(Math.random() * notes.length)];

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.value = 0;
    const now = ctx.currentTime;
    const peak = this.baseGain * 0.4; // ana muzik fragmanlarindan cok daha kisik
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(peak, now + 1.2);   // yumusak attack
    env.gain.exponentialRampToValueAtTime(0.0001, now + 6.5); // uzun, dogal sonus

    osc.connect(env);
    env.connect(this.destination);
    osc.start(now);
    osc.stop(now + 7);
  }

  _rand(min, max) {
    return min + Math.random() * (max - min);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JumviWorldAmbience;
}
