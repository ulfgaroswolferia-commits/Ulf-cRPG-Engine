import { describe, expect, it } from 'vitest';
import { CombatAudioEngine, CombatSoundKind } from '../../src/audio/combatAudio';

describe('CombatAudioEngine', () => {
  it('instantiates correctly and handles singleton access', () => {
    const audio = CombatAudioEngine.getInstance();
    expect(audio).toBeDefined();
    expect(audio.getMuted()).toBe(false);
  });

  it('safely toggles mute state', () => {
    const audio = CombatAudioEngine.getInstance();
    audio.setMuted(true);
    expect(audio.getMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.getMuted()).toBe(false);
  });

  it('safely handles playSound calls in headless test environment without throwing', () => {
    const audio = CombatAudioEngine.getInstance();
    const sounds: CombatSoundKind[] = [
      'slash_blade',
      'blunt_hit',
      'flesh_impact',
      'armor_clang',
      'critical_boom',
      'miss_whoosh',
      'death_gasp',
      'shield_block'
    ];

    for (const snd of sounds) {
      expect(() => audio.playSound(snd)).not.toThrow();
    }
  });
});
