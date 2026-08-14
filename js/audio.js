// Everything here is synthesized: no audio files, no network requests.

const A4_HZ = 440;
const hz = (semitones) => A4_HZ * Math.pow(2, semitones / 12);

// Semitone offsets from A4. The whole score lives in one C-major pentatonic
// set {C D E G A} centred on D, so any two voices that overlap stay consonant.
const N = {
  D1: -43, C2: -33, D2: -31, C3: -21, D3: -19, G3: -14, A3: -12,
  D4: -7, E4: -5, G4: -2, A4: 0, C5: 3, D5: 5, G5: 10, D6: 17, G6: 22,
};

// ×1..×4: root, +4th, +octave, +octave+4th (quartal, so stacked hits never clash)
const CHIME_NOTES = [N.D5, N.G5, N.D6, N.G6];

const BPM = 84;
const STEP_S = 30 / BPM; // eighth note
const STEPS_PER_BAR = 8;
const BARS = 4;
const PATTERN_STEPS = STEPS_PER_BAR * BARS;
const LOOKAHEAD_S = 0.4;
const PUMP_MS = 100;
const CROSSFADE_S = 2;

const ARP_NOTES = [
  N.D4, N.G4, N.A4, N.C5, N.D5, N.A4, N.C5, N.G4,
  N.D4, N.E4, N.G4, N.A4, N.C5, N.G4, N.A4, N.E4,
];
const SUB_BY_BAR = [N.D2, N.D2, N.C2, N.D2];
const STAB_STEPS = [0, 3, 6]; // 3+3+2 tresillo — drives without menace
const STAB_CHORD_BY_BAR = [[N.D3, N.A3], [N.D3, N.A3], [N.C3, N.G3], [N.D3, N.A3]];

const LAYERS = ['pad', 'arp', 'sub', 'stabs'];
const MIX = {
  hangar: { pad: 0.45, arp: 0, sub: 0, stabs: 0 },
  departure: { pad: 0.6, arp: 0, sub: 0, stabs: 0 },
  asteroids: { pad: 0.5, arp: 0.5, sub: 0, stabs: 0 },
  derelict: { pad: 0.45, arp: 0.32, sub: 0.6, stabs: 0 },
  boss: { pad: 0.4, arp: 0.24, sub: 0.5, stabs: 0.55 },
  tally: { pad: 0.7, arp: 0, sub: 0, stabs: 0 },
};
const STAB_PHASE_BOOST = { 1: 0.85, 2: 1, 3: 1.2 };

const MASTER_GAIN = 0.5;
const MUSIC_GAIN = 0.45;
const SFX_GAIN = 0.8;
const NOISE_SECONDS = 1;

function register() {
  AFRAME.registerComponent('audio-director', {
    init() {
      this.ctx = null;
      this.layers = null;
      this.noiseBuffer = null;
      this.beat = 'hangar';
      this.targets = MIX.hangar;
      this.stabBoost = 1;
      this.stepIndex = 0;
      this.nextStepTime = 0;
      this.pumpTimer = 0;

      this.unlock = this.unlock.bind(this);
      this.onFired = this.onFired.bind(this);
      this.onScored = this.onScored.bind(this);
      this.onComboBroken = this.onComboBroken.bind(this);
      this.onBeatChanged = this.onBeatChanged.bind(this);
      this.onBossPhase = this.onBossPhase.bind(this);
      this.onBossDefeated = this.onBossDefeated.bind(this);
      this.onRideStarted = this.onRideStarted.bind(this);
      this.onRideDone = this.onRideDone.bind(this);
      this.onTallyDone = this.onTallyDone.bind(this);
      this.onTargetHit = this.onTargetHit.bind(this);
      this.onHidden = this.onHidden.bind(this);
      this.onShown = this.onShown.bind(this);
      this.pump = this.pump.bind(this);

      const el = this.el;
      el.addEventListener('fired', this.onFired);
      el.addEventListener('scored', this.onScored);
      el.addEventListener('combobroken', this.onComboBroken);
      el.addEventListener('beatchanged', this.onBeatChanged);
      el.addEventListener('bossphase', this.onBossPhase);
      el.addEventListener('bossdefeated', this.onBossDefeated);
      el.addEventListener('ridestarted', this.onRideStarted);
      el.addEventListener('ridedone', this.onRideDone);
      el.addEventListener('tallydone', this.onTallyDone);
      el.addEventListener('targethit', this.onTargetHit);
      el.addEventListener('gamehidden', this.onHidden);
      el.addEventListener('gameshown', this.onShown);

      // Quest's browser refuses an AudioContext outside a user gesture.
      for (const type of ['click', 'touchend', 'keydown']) {
        window.addEventListener(type, this.unlock);
      }
    },

    remove() {
      const el = this.el;
      el.removeEventListener('fired', this.onFired);
      el.removeEventListener('scored', this.onScored);
      el.removeEventListener('combobroken', this.onComboBroken);
      el.removeEventListener('beatchanged', this.onBeatChanged);
      el.removeEventListener('bossphase', this.onBossPhase);
      el.removeEventListener('bossdefeated', this.onBossDefeated);
      el.removeEventListener('ridestarted', this.onRideStarted);
      el.removeEventListener('ridedone', this.onRideDone);
      el.removeEventListener('tallydone', this.onTallyDone);
      el.removeEventListener('targethit', this.onTargetHit);
      el.removeEventListener('gamehidden', this.onHidden);
      el.removeEventListener('gameshown', this.onShown);
      for (const type of ['click', 'touchend', 'keydown']) {
        window.removeEventListener(type, this.unlock);
      }
      if (this.pumpTimer) clearInterval(this.pumpTimer);
      this.pumpTimer = 0;
      if (this.ctx) {
        try { this.ctx.close(); } catch { /* already closing */ }
        this.ctx = null;
      }
    },

    // ---- context lifecycle -------------------------------------------------

    ensureContext() {
      if (this.ctx) return this.ctx;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      this.buildGraph();
      this.startMusic();
      this.applyMix(this.beat, CROSSFADE_S);
      return this.ctx;
    },

    unlock() {
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'suspended') return;
      try { ctx.resume().catch(() => {}); } catch { /* stale context */ }
    },

    running() {
      const ctx = this.ensureContext();
      return ctx && ctx.state === 'running' ? ctx : null;
    },

    buildGraph() {
      const ctx = this.ctx;
      // Safety limiter: the ×4 chime, a whoosh and a shatter can land together.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.25;
      limiter.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(limiter);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = MUSIC_GAIN;
      this.musicBus.connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = SFX_GAIN;
      this.sfxBus.connect(this.master);

      this.layers = {};
      for (const name of LAYERS) {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(this.musicBus);
        this.layers[name] = g;
      }

      const frames = Math.floor(ctx.sampleRate * NOISE_SECONDS);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    },

    // ---- music -------------------------------------------------------------

    startMusic() {
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.7;
      filter.connect(this.layers.pad);

      for (const [note, detune] of [[N.D3, 7], [N.A3, -7]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(note);
        osc.detune.value = detune;
        const trim = ctx.createGain();
        trim.gain.value = 0.22;
        osc.connect(trim);
        trim.connect(filter);
        osc.start();
      }

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.06;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 220;
      lfo.connect(lfoDepth);
      lfoDepth.connect(filter.frequency);
      lfo.start();

      this.stepIndex = 0;
      this.nextStepTime = ctx.currentTime + 0.15;
      // The interval only pumps the lookahead window; every note time below is
      // derived from ctx.currentTime, so timing never rides on timer jitter.
      this.pumpTimer = setInterval(this.pump, PUMP_MS);
    },

    pump() {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      if (this.nextStepTime < ctx.currentTime) this.nextStepTime = ctx.currentTime + 0.05;
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      let guard = 0;
      while (this.nextStepTime < horizon && guard++ < 64) {
        this.scheduleStep(this.stepIndex, this.nextStepTime);
        this.stepIndex = (this.stepIndex + 1) % PATTERN_STEPS;
        this.nextStepTime += STEP_S;
      }
    },

    audible(name) {
      const layer = this.layers && this.layers[name];
      if (!layer) return false;
      return (this.targets[name] || 0) > 0 || layer.gain.value > 0.001;
    },

    scheduleStep(index, time) {
      const bar = Math.floor(index / STEPS_PER_BAR);
      const step = index % STEPS_PER_BAR;

      if (this.audible('arp')) {
        this.voice(this.layers.arp, {
          type: 'triangle',
          freq: hz(ARP_NOTES[index % ARP_NOTES.length]),
          time, peak: 0.18, attack: 0.006, release: 0.34, lowpass: 2600,
        });
      }

      if (this.audible('sub') && step === 0) {
        this.voice(this.layers.sub, {
          type: 'sine',
          freq: hz(SUB_BY_BAR[bar]),
          time, peak: 0.5, attack: 0.18, release: 1.3,
        });
      }

      if (this.audible('stabs') && STAB_STEPS.includes(step)) {
        for (const note of STAB_CHORD_BY_BAR[bar]) {
          this.voice(this.layers.stabs, {
            type: 'sawtooth',
            freq: hz(note),
            time, peak: 0.16, attack: 0.012, release: 0.26,
            lowpass: 700, lowpassTo: 1800,
          });
        }
      }
    },

    applyMix(name, fadeS) {
      const mix = MIX[name] || MIX.hangar;
      this.beat = name;
      this.targets = mix;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const layerName of LAYERS) {
        const param = this.layers[layerName].gain;
        const target = mix[layerName] * (layerName === 'stabs' ? this.stabBoost : 1);
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, now + fadeS);
      }
      console.debug('[audio] beat', name, JSON.stringify(mix), 'stabBoost', this.stabBoost);
    },

    // ---- voices ------------------------------------------------------------

    voice(dest, opts) {
      const ctx = this.ctx;
      const { type, freq, time, peak, attack, release, detune, glideTo, lowpass, lowpassTo } = opts;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, time + attack + release);
      if (detune) osc.detune.setValueAtTime(detune, time);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);
      osc.connect(gain);

      let tail = gain;
      if (lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(lowpass, time);
        if (lowpassTo) filter.frequency.exponentialRampToValueAtTime(lowpassTo, time + attack + release);
        gain.connect(filter);
        tail = filter;
      }
      tail.connect(dest);

      osc.start(time);
      osc.stop(time + attack + release + 0.05);
    },

    noiseVoice(dest, opts) {
      const ctx = this.ctx;
      const { time, peak, attack, release, filterType, from, to, q } = opts;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true; // one shared 1s buffer has to cover the 3s finale rumble too

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(from, time);
      filter.frequency.exponentialRampToValueAtTime(to, time + attack + release);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peak, time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(time, Math.random() * NOISE_SECONDS * 0.5);
      src.stop(time + attack + release + 0.05);
    },

    // ---- event handlers ----------------------------------------------------

    onFired() {
      const ctx = this.running();
      if (!ctx) { this.unlock(); return; }
      this.noiseVoice(this.sfxBus, {
        time: ctx.currentTime, peak: 0.3, attack: 0.02, release: 0.13,
        filterType: 'bandpass', from: 400, to: 2000, q: 1.1,
      });
    },

    onScored(evt) {
      const ctx = this.running();
      if (!ctx) return;
      const multiplier = Math.min(4, Math.max(1, evt.detail.multiplier | 0));
      const note = CHIME_NOTES[multiplier - 1];
      const now = ctx.currentTime;
      this.voice(this.sfxBus, {
        type: 'sine', freq: hz(note), time: now,
        peak: 0.26, attack: 0.005, release: 0.85,
      });
      // Body an octave below, not above: keeps the ×4 chime warm instead of shrill.
      this.voice(this.sfxBus, {
        type: 'triangle', freq: hz(note - 12), time: now,
        peak: 0.13, attack: 0.004, release: 0.4, lowpass: 3000,
      });
    },

    onComboBroken() {
      const ctx = this.running();
      if (!ctx) return;
      this.voice(this.sfxBus, {
        type: 'triangle', freq: 420, glideTo: 150, time: ctx.currentTime,
        peak: 0.1, attack: 0.01, release: 0.21, lowpass: 1600,
      });
    },

    onBeatChanged(evt) {
      this.applyMix(evt.detail.name, CROSSFADE_S);
    },

    onBossPhase(evt) {
      this.stabBoost = STAB_PHASE_BOOST[evt.detail.phase] || 1;
      this.applyMix(this.beat, 1);
    },

    onBossDefeated() {
      const ctx = this.running();
      if (!ctx) return;
      const now = ctx.currentTime;
      this.voice(this.sfxBus, {
        type: 'sine', freq: hz(N.D1), glideTo: hz(N.D2), time: now,
        peak: 0.55, attack: 2, release: 1,
      });
      this.voice(this.sfxBus, {
        type: 'sawtooth', freq: hz(N.D2), detune: 6, time: now,
        peak: 0.2, attack: 2, release: 1, lowpass: 90, lowpassTo: 420,
      });
      this.noiseVoice(this.sfxBus, {
        time: now, peak: 0.14, attack: 2, release: 1,
        filterType: 'lowpass', from: 120, to: 600, q: 0.6,
      });
      // Lands the swell on a bright major-pentatonic spread so the finale reads
      // triumphant rather than ominous to a six-year-old.
      for (const [i, note] of [N.D5, N.G5, N.D6].entries()) {
        this.voice(this.sfxBus, {
          type: 'sine', freq: hz(note), time: now + 1.9 + i * 0.08,
          peak: 0.22, attack: 0.01, release: 1.1,
        });
      }
    },

    onRideStarted() {
      this.stabBoost = 1;
      this.unlock();
      this.applyMix('departure', CROSSFADE_S);
    },

    onRideDone() {
      this.stabBoost = 1;
      this.applyMix('tally', CROSSFADE_S);
    },

    onTallyDone() {
      this.applyMix('hangar', CROSSFADE_S);
    },

    onTargetHit(evt) {
      if (evt.detail && evt.detail.type === 'core') this.unlock();
    },

    onHidden() {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      try { ctx.suspend().catch(() => {}); } catch { /* stale context */ }
    },

    onShown(evt) {
      const state = evt.detail && evt.detail.state;
      // In the hangar we deliberately stay silent until the next gesture —
      // resuming here is what left starcatcher's audio parked and mute.
      if (state !== 'riding' && state !== 'tally') return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'suspended') return;
      try { ctx.resume().catch(() => {}); } catch { /* stale context */ }
    },

    debugSnapshot() {
      const layers = {};
      const activeLayers = [];
      if (this.layers) {
        for (const name of LAYERS) {
          const value = Math.round(this.layers[name].gain.value * 1000) / 1000;
          layers[name] = value;
          if (value > 0.001) activeLayers.push(name);
        }
      }
      return {
        ctxState: this.ctx ? this.ctx.state : 'none',
        beat: this.beat,
        stabBoost: this.stabBoost,
        layers,
        activeLayers,
        targets: this.targets,
      };
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
