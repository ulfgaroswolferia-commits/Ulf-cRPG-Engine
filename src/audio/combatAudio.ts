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
  | 'shield_block';

export class CombatAudioEngine {
  private static instance: CombatAudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;

  public static getInstance(): CombatAudioEngine {
    if (!CombatAudioEngine.instance) {
      CombatAudioEngine.instance = new CombatAudioEngine();
    }
    return CombatAudioEngine.instance;
  }

  constructor() {
    this.initContext();
  }

  private initContext(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  public ensureContextRunning(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.22, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playSound(kind: CombatSoundKind, pitchMod = 1.0): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    this.ensureContextRunning();

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
