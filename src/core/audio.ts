/**
 * 空山声景：全部由 WebAudio 实时合成，没有音频文件。
 * 钟、磬、木鱼、鼓、风、水、鸟、虫、低频梵音。
 */

export type TimeName = 'dawn' | 'noon' | 'dusk' | 'night';

function noiseBuffer(ctx: AudioContext, seconds = 2, brown = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
  }
  return buf;
}

function impulse(ctx: AudioContext, seconds = 3.2, decay = 2.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.6;
    }
  }
  return buf;
}

export class Soundscape {
  ctx: AudioContext | null = null;
  master!: GainNode;
  dry!: GainNode;
  wet!: GainNode;
  reverb!: ConvolverNode;
  enabled = false;
  private starting = false;
  private noise: AudioBuffer | null = null;
  private windGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private birdGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private birdTimer: number | null = null;
  private cricketTimer: number | null = null;
  private time: TimeName = 'dusk';
  private suspended = false;
  private chantGain: GainNode | null = null;
  private chantNodes: AudioScheduledSourceNode[] = [];

  get ready() {
    return !!this.ctx;
  }

  async enable() {
    if (this.enabled) return;
    if (this.starting) return;
    this.starting = true;
    try {
      if (!this.ctx) this.init();
      await this.ctx!.resume();
      this.enabled = true;
      this.master.gain.cancelScheduledValues(this.ctx!.currentTime);
      this.master.gain.setTargetAtTime(0.82, this.ctx!.currentTime, 0.6);
      this.applyTime(this.time, 2.5);
    } finally {
      this.starting = false;
    }
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
  }

  toggle() {
    if (this.enabled) this.disable();
    else void this.enable();
    return this.enabled;
  }

  private init() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.85;
    this.dry.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 3.6, 2.4);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.34;
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);
    this.noise = noiseBuffer(ctx, 3, true);

    // 风
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.11;
    this.windGain = wg;
    wind.connect(windFilter).connect(wg).connect(this.dry);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.045;
    lfo.connect(lfoGain).connect(wg.gain);
    lfo.start();
    wind.start();

    // 水
    const water = ctx.createBufferSource();
    water.buffer = noiseBuffer(ctx, 4, false);
    water.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 900;
    wf.Q.value = 0.7;
    const wg2 = ctx.createGain();
    wg2.gain.value = 0.014;
    this.waterGain = wg2;
    water.connect(wf).connect(wg2).connect(this.dry);
    water.start();

    // 梵音低频垫
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 460;
    const pad = ctx.createGain();
    pad.gain.value = 0.0;
    this.padGain = pad;
    padFilter.connect(pad);
    pad.connect(this.reverb);
    for (const [f, g] of [[73.42, 0.05], [110, 0.038], [146.83, 0.03], [220, 0.014], [293.66, 0.008]]) {
      for (const det of [-0.12, 0.12]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det * 100;
        const og = ctx.createGain();
        og.gain.value = g;
        o.connect(og).connect(padFilter);
        o.start();
      }
    }
    const padLfo = ctx.createOscillator();
    padLfo.frequency.value = 0.06;
    const padLfoGain = ctx.createGain();
    padLfoGain.gain.value = 0.012;
    padLfo.connect(padLfoGain).connect(pad.gain);
    padLfo.start();

    // 鸟 / 虫 总线
    this.birdGain = ctx.createGain();
    this.birdGain.gain.value = 0;
    this.birdGain.connect(this.reverb);
    this.birdGain.connect(this.dry);
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.dry);

    this.scheduleBird();
    this.scheduleCricket();
    this.applyTime(this.time, 0.1);
  }

  applyTime(time: TimeName, ramp = 2) {
    this.time = time;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (node: GainNode | null, v: number) => {
      if (!node) return;
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(v, t, ramp);
    };
    const bird = time === 'dawn' ? 0.5 : time === 'noon' ? 0.32 : time === 'dusk' ? 0.18 : 0;
    set(this.birdGain, bird);
    set(this.cricketGain, time === 'night' ? 0.5 : 0);
    set(this.padGain, this.time === 'night' ? 0.7 : 0.42);
    set(this.waterGain, time === 'night' ? 0.02 : 0.015);
  }

  private scheduleBird() {
    if (this.birdTimer) window.clearTimeout(this.birdTimer);
    const delay = 4500 + Math.random() * 9000;
    this.birdTimer = window.setTimeout(() => {
      if (this.ctx && this.enabled && (this.time === 'dawn' || this.time === 'noon' || this.time === 'dusk')) {
        this.chirp();
        if (Math.random() > 0.35) window.setTimeout(() => this.chirp(), 180 + Math.random() * 300);
      }
      this.scheduleBird();
    }, delay);
  }

  private scheduleCricket() {
    if (this.cricketTimer) window.clearTimeout(this.cricketTimer);
    this.cricketTimer = window.setTimeout(() => {
      if (this.ctx && this.enabled && this.time === 'night') {
        this.cricket();
      }
      this.scheduleCricket();
    }, 900 + Math.random() * 1600);
  }

  private chirp() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.birdGain!);
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const start = t0 + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const base = 2100 + Math.random() * 1400;
      o.frequency.setValueAtTime(base, start);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.45), start + 0.045);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, start + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.06, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      o.connect(g).connect(pan);
      o.start(start);
      o.stop(start + 0.16);
    }
  }

  private cricket() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(this.cricketGain!);
    for (let i = 0; i < 3; i++) {
      const start = t0 + i * 0.085;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 4200 + Math.random() * 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.012, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
      o.connect(g).connect(pan);
      o.start(start);
      o.stop(start + 0.07);
    }
  }

  /** 大钟：低沉、长尾 */
  bell(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.5 * strength;
    out.connect(this.dry);
    out.connect(this.reverb);
    const base = 78 + Math.random() * 2;
    const partials = [1, 2.01, 2.42, 2.93, 3.98, 5.12, 6.7];
    const decays = [9, 7.5, 6.4, 5.2, 4.2, 3.2, 2.4];
    const amps = [0.5, 0.3, 0.22, 0.16, 0.12, 0.08, 0.05];
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * p;
      o.detune.value = (Math.random() - 0.5) * 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amps[i] * 0.5, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decays[i]);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + decays[i] + 0.2);
    });
    // 撞击声
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 380;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.16, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    n.connect(nf).connect(ng).connect(out);
    n.start(t0);
    n.stop(t0 + 0.3);
    // 泛音闪烁
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = base * 9.1;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t0 + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.02, t0 + 0.4);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
    shimmer.connect(sg).connect(out);
    shimmer.start(t0 + 0.05);
    shimmer.stop(t0 + 3.5);
  }

  /** 磬 */
  chime(pitch = 520, strength = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = strength * 0.4;
    out.connect(this.dry);
    out.connect(this.reverb);
    [1, 2.76, 5.4, 8.93].forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = pitch * p;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2 / (i + 1.5), t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8 - i * 0.4);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 3);
    });
  }

  woodblock(pitch = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(this.dry);
    out.connect(this.reverb);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520 * pitch, t0);
    o.frequency.exponentialRampToValueAtTime(180 * pitch, t0 + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.2);
    // 木头的敲击噪声
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1600;
    nf.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    n.connect(nf).connect(ng).connect(out);
    n.start(t0);
    n.stop(t0 + 0.06);
  }

  drum(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.55 * strength;
    out.connect(this.dry);
    out.connect(this.reverb);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(96, t0);
    o.frequency.exponentialRampToValueAtTime(44, t0 + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 1.5);
    // 中频鼓皮，让手机扬声器也能听见
    const mid = ctx.createOscillator();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(210, t0);
    mid.frequency.exponentialRampToValueAtTime(120, t0 + 0.18);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, t0);
    mg.gain.exponentialRampToValueAtTime(0.3, t0 + 0.006);
    mg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    mid.connect(mg).connect(out);
    mid.start(t0);
    mid.stop(t0 + 0.4);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    n.connect(nf).connect(ng).connect(out);
    n.start(t0);
    n.stop(t0 + 0.25);
  }

  step() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    n.connect(f).connect(g).connect(this.dry);
    n.start(t0);
    n.stop(t0 + 0.12);
  }

  paper() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    n.connect(f).connect(g).connect(this.reverb);
    n.start(t0);
    n.stop(t0 + 0.35);
  }

  /** 自动诵经时的低音诵经声床（不是录音，是实时合成的共振人声感） */
  chantStart() {
    if (!this.ctx || !this.enabled || this.chantGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.018, t0 + 2.4);
    g.connect(this.dry);
    g.connect(this.reverb);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 520;
    formant.Q.value = 1.1;
    formant.connect(g);

    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 1100;
    body.connect(formant);

    for (const [freq, amp] of [[110, 0.3], [164.81, 0.2], [220, 0.12]] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 8;
      const vg = ctx.createGain();
      vg.gain.value = amp;
      o.connect(vg).connect(body);
      o.start(t0);
      this.chantNodes.push(o);
    }

    // 缓慢的呼吸/音节起伏
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.19;
    const lg = ctx.createGain();
    lg.gain.value = 0.007;
    lfo.connect(lg).connect(g.gain);
    lfo.start(t0);
    this.chantNodes.push(lfo);

    // 很轻的换气声
    const breath = ctx.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = 760;
    bf.Q.value = 0.7;
    const bg = ctx.createGain();
    bg.gain.value = 0.012;
    breath.connect(bf).connect(bg).connect(g);
    breath.start(t0);
    this.chantNodes.push(breath);

    this.chantGain = g;
  }

  chantStop() {
    if (!this.ctx || !this.chantGain) return;
    const ctx = this.ctx;
    const g = this.chantGain;
    this.chantGain = null;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    const nodes = this.chantNodes;
    this.chantNodes = [];
    window.setTimeout(() => {
      for (const n of nodes) {
        try { n.stop(); } catch { /* noop */ }
      }
      try { g.disconnect(); } catch { /* noop */ }
    }, 900);
  }

  /** 莲灯落水 */
  waterDrop() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.35;
    out.connect(this.dry);
    out.connect(this.reverb);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t0);
    o.frequency.exponentialRampToValueAtTime(95, t0 + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.3);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    n.connect(f).connect(ng).connect(out);
    n.start(t0);
    n.stop(t0 + 0.18);
  }

  /** 点香：火柴擦过 / 香灰轻响 */
  incenseLight() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    n.connect(f).connect(g).connect(this.reverb);
    n.start(t0);
    n.stop(t0 + 0.45);
  }

  /** 片刻的梵音上扬，用于回向、撞钟一百零八下 */
  swell() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(this.reverb);
    [146.83, 220, 293.66, 440].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t0 + 2.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 9);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 9.5);
    });
  }

  setSuspended(v: boolean) {
    if (!this.ctx) return;
    if (v === this.suspended) return;
    this.suspended = v;
    if (v) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  }
}
