import type { PropKind } from '../core/worldMap';
import type { CombatAttackOutcome } from '../rpg/combatSystem';

export type CombatImpactCategory = 'dodge' | 'parry' | 'hit' | 'critical';
export type PropReactionKind = 'rock' | 'pop';

export interface PropReactionTransform {
  offsetY: number;
  skewX: number;
  scaleX: number;
  scaleY: number;
}

export interface IdleBreathingTransform {
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export interface DeathCollapsePose {
  offsetY: number;
  scaleY: number;
  rotation: number;
  bloodPoolScale: number;
}

export interface DodgeGhostOffset {
  offsetX: number;
  offsetY: number;
  ghostAlpha: number;
}

export const DEATH_COLLAPSE_DURATION_SEC = 0.35;
export const DODGE_ANIM_DURATION_SEC = 0.24;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hashStringSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 997) * 0.017;
}

/**
 * Computes a grounded, organic wind-sway skew (in radians) for foliage and cloth props.
 * Uses a global diagonal wind wave with slow gust modulation so neighboring trees/bushes
 * ripple cohesively rather than vibrating independently.
 */
export function computeWindSwaySkew(
  kind: PropKind,
  worldX: number,
  worldY: number,
  elapsedSec: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;

  let baseAmp = 0;
  let freq = 1.45;
  if (kind === 'pine_tree' || kind === 'ancient_oak') {
    baseAmp = 0.026;
    freq = 1.25;
  } else if (kind === 'dead_tree') {
    baseAmp = 0.014;
    freq = 1.1;
  } else if (kind === 'berry_bush' || kind === 'wildflower_patch') {
    baseAmp = 0.036;
    freq = 1.85;
  } else if (kind === 'school_banner') {
    baseAmp = 0.048;
    freq = 2.35;
  } else {
    return 0;
  }

  // Global diagonal wind gust envelope (0.55 .. 1.35)
  const spatialPhase = worldX * 0.42 + worldY * 0.28;
  const gust = 0.95 + 0.4 * Math.sin(elapsedSec * 0.48 - spatialPhase * 0.35);
  const primaryWave = Math.sin(elapsedSec * freq - spatialPhase);
  const secondaryFlutter = 0.22 * Math.sin(elapsedSec * freq * 2.15 + spatialPhase * 1.3);
  return (primaryWave + secondaryFlutter) * baseAmp * gust;
}

/**
 * Computes subtle breathing scale/glow modulation for arcane crystals.
 */
export function computeArcanePulseScale(
  kind: PropKind,
  worldX: number,
  worldY: number,
  elapsedSec: number,
  reducedMotion: boolean
): { scale: number; glowAlpha: number } {
  if (kind !== 'arcane_crystal') {
    return { scale: 1, glowAlpha: 0 };
  }
  if (reducedMotion) {
    return { scale: 1, glowAlpha: 0.22 };
  }
  const phase = worldX * 0.7 + worldY * 0.5;
  const wave = 0.5 + 0.5 * Math.sin(elapsedSec * 2.1 + phase);
  return {
    scale: 1 + (wave - 0.5) * 0.024,
    glowAlpha: 0.14 + wave * 0.22
  };
}

/**
 * Computes reactive prop motion:
 * - 'rock': damped pendulum sway (e.g., training dummy struck by a weapon)
 * - 'pop': crisp squash-and-stretch lift (e.g., chest opened)
 */
export function computePropReactionTransform(
  reactionKind: PropReactionKind,
  progress: number,
  reducedMotion: boolean
): PropReactionTransform {
  const p = clamp01(progress);
  if (reducedMotion || p <= 0 || p >= 1) {
    return { offsetY: 0, skewX: 0, scaleX: 1, scaleY: 1 };
  }

  if (reactionKind === 'rock') {
    const damp = (1 - p) * (1 - p);
    const skewX = Math.sin(p * Math.PI * 3.5) * 0.16 * damp;
    return { offsetY: 0, skewX, scaleX: 1, scaleY: 1 };
  }

  // 'pop' — quick upward bounce with subtle squash-and-stretch
  const lift = Math.sin(p * Math.PI);
  const stretch = Math.sin(p * Math.PI * 2) * (1 - p) * 0.08;
  return {
    offsetY: -lift * 5.5,
    skewX: 0,
    scaleX: 1 - stretch * 0.65,
    scaleY: 1 + stretch
  };
}

/**
 * Computes grounded idle breathing / stealth crouch / combat stance motion for characters.
 */
export function computeIdleBreathingTransform(
  actorId: string,
  elapsedSec: number,
  inCombat: boolean,
  isMoving: boolean,
  isStealth: boolean,
  reducedMotion: boolean
): IdleBreathingTransform {
  const stealthScaleY = isStealth ? 0.94 : 1.0;
  const stealthOffsetY = isStealth ? 2.0 : 0;

  if (reducedMotion || isMoving) {
    return { offsetY: stealthOffsetY, scaleX: 1.0, scaleY: stealthScaleY };
  }

  const seed = hashStringSeed(actorId);
  if (inCombat) {
    const wave = Math.sin(elapsedSec * 5.2 + seed);
    return {
      offsetY: stealthOffsetY + wave * 1.35,
      scaleX: 1 - wave * 0.01,
      scaleY: stealthScaleY * (1 + wave * 0.016)
    };
  }

  // Calm exploration breathing
  const wave = Math.sin(elapsedSec * 2.2 + seed);
  return {
    offsetY: stealthOffsetY + wave * 0.55,
    scaleX: 1 - wave * 0.006,
    scaleY: stealthScaleY * (1 + wave * 0.012)
  };
}

/**
 * Classifies a combat attack outcome into a visual impact category for distinct VFX.
 */
export function classifyCombatImpact(
  outcome: Pick<
    CombatAttackOutcome,
    'hit' | 'critical' | 'rawDamage' | 'mitigatedByArmor' | 'damageDealt'
  >
): CombatImpactCategory {
  if (!outcome.hit) return 'dodge';
  if (outcome.critical) return 'critical';
  if (
    outcome.damageDealt <= 0 ||
    (outcome.rawDamage > 0 && outcome.mitigatedByArmor >= outcome.rawDamage * 0.55)
  ) {
    return 'parry';
  }
  return 'hit';
}

/**
 * Smooth ease-out cubic collapse pose for defeated actors (0 -> upright, 1 -> fallen corpse).
 */
export function computeDeathCollapsePose(
  progress: number,
  reducedMotion: boolean
): DeathCollapsePose {
  const p = reducedMotion ? 1 : clamp01(progress);
  const eased = 1 - Math.pow(1 - p, 3);
  return {
    offsetY: eased * 4.0,
    scaleY: 1 - eased * 0.62,
    rotation: eased * 0.42,
    bloodPoolScale: 0.2 + eased * 0.8
  };
}

/**
 * Sidestep offset and translucent afterimage alpha for a dodged attack.
 */
export function computeDodgeGhostOffset(
  progress: number,
  dirX: number,
  dirY: number,
  reducedMotion: boolean
): DodgeGhostOffset {
  const p = clamp01(progress);
  if (reducedMotion || p <= 0 || p >= 1) {
    return { offsetX: 0, offsetY: 0, ghostAlpha: 0 };
  }
  const len = Math.hypot(dirX, dirY) || 1;
  // Sidestep perpendicular to incoming attack direction for crisp visual readability
  const perpX = -dirY / len;
  const perpY = dirX / len;
  const dist = Math.sin(p * Math.PI) * 11;
  return {
    offsetX: perpX * dist,
    offsetY: perpY * dist * 0.55,
    ghostAlpha: (1 - p) * 0.42
  };
}

/**
 * Subtle horizontal shiver when an actor suffers from the 'strach' (fear) status.
 */
export function computeFearTrembleOffset(
  actorId: string,
  elapsedSec: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;
  const seed = hashStringSeed(actorId);
  return Math.sin(elapsedSec * 34 + seed) * 1.15;
}

export interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelOffsetCandidate {
  x: number;
  y: number;
}

/**
 * Picks the first candidate screen position (anchor 0.5, 1) that does not overlap
 * any already-placed world label rect, and appends the chosen rect to `placed`.
 */
export function resolveNonOverlappingLabelPosition(
  anchorX: number,
  anchorY: number,
  labelWidth: number,
  labelHeight: number,
  candidates: readonly LabelOffsetCandidate[],
  placed: LabelRect[],
  padX = 5,
  padY = 4
): { x: number; y: number } {
  const halfW = labelWidth * 0.5 + padX;
  for (const cand of candidates) {
    const x = anchorX + cand.x;
    const y = anchorY + cand.y;
    const left = x - halfW;
    const top = y - labelHeight - padY;
    const right = x + halfW;
    const bottom = y + padY;
    const overlaps = placed.some(
      (r) => left < r.right && right > r.left && top < r.bottom && bottom > r.top
    );
    if (!overlaps) {
      placed.push({ left, top, right, bottom });
      return { x, y };
    }
  }
  const fallback = candidates[0] ?? { x: 0, y: 0 };
  const fx = anchorX + fallback.x;
  const fy = anchorY + fallback.y;
  placed.push({
    left: fx - halfW,
    top: fy - labelHeight - padY,
    right: fx + halfW,
    bottom: fy + padY
  });
  return { x: fx, y: fy };
}
