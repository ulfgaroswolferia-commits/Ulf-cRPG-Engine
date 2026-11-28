/**
 * Procedural Web Audio API Sound Synthesizer for cRPG Combat.
 * Zero-dependency, lightweight (<2KB), procedural audio effects:
 * - Weapon slashes & whooshes (FM/noise sweep)
 * - Flesh hits & bludgeon impacts
 * - Armor clang & shield deflection (metallic ring)
 * - Critical strike impact (deep sub-bass resonance)
 * - Death rattle & collapse
 *
 * Gracefully degrades to a no-op in headless test or unsupported environments.
 */

export type CombatSoundKind =
  | 'slash_blade'
  | 'blunt_hit'
  | 'flesh_impact'
  | 'armor_clang'
  | 'critical_boom'
  | 'miss_whoosh'
  | 'death_gasp'
  | 'shield_block'
  | 'witch_cackle'
  | 'wraith_moan'
  | 'ghost_breath';

export type AmbienceMood =
  | 'none'
  | 'dawn'
  | 'forest'
  | 'creepy_forest'
  | 'night_storm'
  | 'town'
  | 'tavern';

export const COMBAT_SAMPLE_MAP: Record<CombatSoundKind, readonly string[]> = {
  slash_blade: ['./audio/sfx/swing1.wav', './audio/sfx/swing2.wav', './audio/sfx/blade1.wav', './audio/sfx/blade2.wav'],
  blunt_hit: ['./audio/sfx/blunt1.flac', './audio/sfx/blunt2.flac'],
  flesh_impact: ['./audio/sfx/flesh1.flac', './audio/sfx/flesh2.flac'],
  armor_clang: ['./audio/sfx/metal1.wav', './audio/sfx/metal2.wav'],
  critical_boom: ['./audio/sfx/crit1.flac', './audio/sfx/crit2.flac'],
  miss_whoosh: ['./audio/sfx/swing1.wav', './audio/sfx/swing2.wav', './audio/sfx/swing3.wav'],
  death_gasp: ['./audio/sfx/death1.wav', './audio/sfx/death2.wav'],
  shield_block: ['./audio/sfx/shield1.wav', './audio/sfx/shield2.wav'],
  witch_cackle: ['./audio/sfx/witch_cackle.ogg'],
  wraith_moan: ['./audio/sfx/wraith_moan.mp3'],
  ghost_breath: ['./audio/sfx/ghost_breath.flac']
};

export const AMBIENCE_SAMPLE_MAP: Record<Exclude<AmbienceMood, 'none'>, readonly string[]> = {
  dawn: ['./audio/ambience/dawn_wind.ogg'],
  forest: ['./audio/ambience/forest_ambience.mp3'],
  creepy_forest: ['./audio/ambience/creepy_forest.ogg'],
  night_storm: ['./audio/ambience/night_storm.ogg'],
  town: ['./audio/ambience/village_crowd.ogg'],
  tavern: ['./audio/ambience/tavern_ambience.ogg']
};

export class CombatAudioEngine {
  private static instance: CombatAudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private sampleBuffers = new Map<string, AudioBuffer>();
  private loadingStarted = false;
  private currentAmbienceMood: AmbienceMood = 'none';
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambiencePendingLoads = new Set<string>();

  public static getInstance(): CombatAudioEngine {
    if (!CombatAudioEngine.instance) {
      CombatAudioEngine.instance = new CombatAudioEngine();
    }
    return CombatAudioEngine.instance;
  }

  constructor() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('ulf_crpg_audio_muted') === 'true') {
        this.isMuted = true;
      }
    } catch {}
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const unlockOnGesture = (): void => {
        this.ensureContextRunning();
      };
      window.addEventListener('pointerdown', unlockOnGesture, { once: true, passive: true });
      window.addEventListener('keydown', unlockOnGesture, { once: true, passive: true });
    }
  }

  private initContext(): void {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.34, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.preloadSamples();
    } catch {
      this.ctx = null;
    }
  }

  private preloadSamples(): void {
    if (this.loadingStarted || !this.ctx || typeof fetch !== 'function') return;
    this.loadingStarted = true;
    const uniqueUrls = new Set<string>();
    for (const urls of Object.values(COMBAT_SAMPLE_MAP)) {
      for (const u of urls) uniqueUrls.add(u);
    }
    for (const url of uniqueUrls) {
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => (buf && this.ctx ? this.ctx.decodeAudioData(buf) : null))
        .then((decoded) => {
          if (decoded) this.sampleBuffers.set(url, decoded);
        })
        .catch(() => {});
    }
  }

  public ensureContextRunning(): void {
    if (!this.ctx) {
      this.initContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public dispose(): void {
    this.stopAmbience();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }

  /**
   * Starts or crossfades a looping ambient soundscape registered in AMBIENCE_SAMPLE_MAP.
   * Lazy-loads and caches the decoded AudioBuffer on first use.
   */
  public playAmbience(mood: AmbienceMood, volume = 0.24): void {
    if (mood === 'none') {
      this.stopAmbience();
      return;
    }
    if (this.currentAmbienceMood === mood && this.ambienceSource) {
      this.ensureContextRunning();
      return;
    }
    this.currentAmbienceMood = mood;
    this.ensureContextRunning();
    if (!this.ctx || !this.masterGain) return;

    const candidates = AMBIENCE_SAMPLE_MAP[mood];
    const url = candidates[0];
    if (!url) return;

    const cached = this.sampleBuffers.get(url);
    if (cached) {
      this.startAmbienceBuffer(cached, volume);
      return;
    }

    if (this.ambiencePendingLoads.has(url) || typeof fetch !== 'function') return;
    this.ambiencePendingLoads.add(url);
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => (buf && this.ctx ? this.ctx.decodeAudioData(buf) : null))
      .then((decoded) => {
        this.ambiencePendingLoads.delete(url);
        if (!decoded) return;
        this.sampleBuffers.set(url, decoded);
        if (this.currentAmbienceMood === mood) {
          this.startAmbienceBuffer(decoded, volume);
        }
      })
      .catch(() => {
        this.ambiencePendingLoads.delete(url);
      });
  }

  public stopAmbience(): void {
    this.currentAmbienceMood = 'none';
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
      } catch {}
      this.ambienceSource = null;
    }
    if (this.ambienceGain) {
      try {
        this.ambienceGain.disconnect();
      } catch {}
      this.ambienceGain = null;
    }
  }

  private startAmbienceBuffer(buffer: AudioBuffer, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
      } catch {}
      this.ambienceSource = null;
    }
    if (this.ambienceGain) {
      try {
        this.ambienceGain.disconnect();
      } catch {}
      this.ambienceGain = null;
    }

    try {
      const t = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(Math.max(0.02, Math.min(1.0, volume)), t + 1.2);
      gain.connect(this.masterGain);

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start(t);

      this.ambienceSource = src;
      this.ambienceGain = gain;
    } catch {}
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ulf_crpg_audio_muted', muted ? 'true' : 'false');
      }
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.34, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playSound(kind: CombatSoundKind, pitchMod = 1.0): void {
    if (this.isMuted) return;
    this.ensureContextRunning();
    if (!this.ctx || !this.masterGain) return;

    const candidates = COMBAT_SAMPLE_MAP[kind] ?? [];
    const loaded = candidates.filter((u) => this.sampleBuffers.has(u));
    if (loaded.length > 0) {
      try {
        const url = loaded[Math.floor(Math.random() * loaded.length)];
        const buffer = this.sampleBuffers.get(url);
        if (buffer) {
          const src = this.ctx.createBufferSource();
          src.buffer = buffer;
          const jitter = 0.95 + Math.random() * 0.1;
          src.playbackRate.setValueAtTime(Math.max(0.65, Math.min(1.5, pitchMod * jitter)), this.ctx.currentTime);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(kind === 'critical_boom' ? 1.0 : 0.85, this.ctx.currentTime);
          src.connect(gain);
          gain.connect(this.masterGain);
          src.start();
          return;
        }
      } catch {
        // Fall through to procedural fallback
      }
    }

    try {
      const t = this.ctx.currentTime;
      switch (kind) {
        case 'slash_blade':
          this.synthesizeSlash(t, pitchMod);
          break;
        case 'blunt_hit':
          this.synthesizeBlunt(t, pitchMod);
          break;
        case 'flesh_impact':
          this.synthesizeFlesh(t, pitchMod);
          break;
        case 'armor_clang':
          this.synthesizeArmorClang(t, pitchMod);
          break;
        case 'critical_boom':
          this.synthesizeCritical(t, pitchMod);
          break;
        case 'miss_whoosh':
          this.synthesizeWhoosh(t, pitchMod);
          break;
        case 'death_gasp':
          this.synthesizeDeath(t, pitchMod);
          break;
        case 'shield_block':
          this.synthesizeShieldBlock(t, pitchMod);
          break;
        case 'witch_cackle':
        case 'wraith_moan':
        case 'ghost_breath':
          this.synthesizeDeath(t, pitchMod * 0.85);
          break;
      }
    } catch {
      // Audio execution failure should never crash the game loop
    }
  }

  /**
   * Fast sharp air slash with high-frequency whoosh.
   */
  private synthesizeSlash(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(110 * pitchMod, t + 0.14);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 * pitchMod, t);
    filter.frequency.exponentialRampToValueAtTime(320 * pitchMod, t + 0.14);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.65, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Heavy blunt crush impact (low frequency punch + noise burst).
   */
  private synthesizeBlunt(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(38 * pitchMod, t + 0.18);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  /**
   * Wet flesh slice / cut (mid-frequency crunch).
   */
  private synthesizeFlesh(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(70 * pitchMod, t + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 * pitchMod, t);
    filter.frequency.exponentialRampToValueAtTime(200 * pitchMod, t + 0.12);

    gain.gain.setValueAtTime(0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Resonant metallic ring when hitting iron armor or maille.
   */
  private synthesizeArmorClang(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const freqs = [880, 1340, 2180, 3100];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitchMod, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  /**
   * Powerful critical hit: heavy sub-bass thud + ringing harmonic.
   */
  private synthesizeCritical(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    // Sub bass
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140 * pitchMod, t);
    subOsc.frequency.exponentialRampToValueAtTime(30 * pitchMod, t + 0.35);

    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.36);

    // High metal crack
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(1800 * pitchMod, t);
    crackOsc.frequency.exponentialRampToValueAtTime(400 * pitchMod, t + 0.16);

    crackGain.gain.setValueAtTime(0.6, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    crackOsc.connect(crackGain);
    crackGain.connect(this.masterGain);

    crackOsc.start(t);
    crackOsc.stop(t + 0.17);
  }

  /**
   * Soft whoosh on attack miss.
   */
  private synthesizeWhoosh(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(90 * pitchMod, t + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600 * pitchMod, t);
    filter.Q.setValueAtTime(1.5, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.17);
  }

  /**
   * Defend stance / wooden shield deflection.
   */
  private synthesizeShieldBlock(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(55 * pitchMod, t + 0.12);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Defeated enemy collapse & death gasp.
   */
  private synthesizeDeath(t: number, pitchMod: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitchMod, t);
    osc.frequency.exponentialRampToValueAtTime(45 * pitchMod, t + 0.45);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }
}
