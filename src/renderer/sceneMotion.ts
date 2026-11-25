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

export interface WalkStrideTransform {
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface AttackLungeTransform {
  /** Signed multiplier of lunge distance (< 0 = wind-up pull-back, > 0 = forward strike). */
  distFactor: number;
  leanRad: number;
  scaleX: number;
  scaleY: number;
}

export interface HitRecoilTransform {
  /** Multiplier of recoil distance (0..1). */
  distFactor: number;
  leanRad: number;
  scaleX: number;
  scaleY: number;
}

export interface TelegraphPoseTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
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
 * Computes continuous, organic stride bounce, subtle weight-shift squash-and-stretch,
 * and rhythmic shoulder sway while an actor is walking so movement flows smoothly
 * between discrete sprite frames instead of sliding stiffly.
 */
export function computeWalkStrideTransform(
  animTimer: number,
  isStealth: boolean,
  reducedMotion: boolean
): WalkStrideTransform {
  const stealthScaleY = isStealth ? 0.94 : 1.0;
  const stealthOffsetY = isStealth ? 2.0 : 0;
  if (reducedMotion) {
    return { offsetY: stealthOffsetY, scaleX: 1.0, scaleY: stealthScaleY, rotation: 0 };
  }

  // Two footsteps per full 4-beat walk cycle (phase = animTimer * PI / 2)
  const phase = animTimer * Math.PI * 0.5;
  const stepLift = Math.abs(Math.sin(phase)); // 0 on footplant, 1 at mid-stride apex
  const sway = Math.sin(phase); // alternates -1..+1 between left and right steps
  const liftAmp = isStealth ? 1.5 : 3.1;
  const stretch = (stepLift - 0.5) * (isStealth ? 0.022 : 0.044);

  return {
    offsetY: stealthOffsetY - stepLift * liftAmp,
    scaleX: 1 - stretch * 0.65,
    scaleY: stealthScaleY * (1 + stretch),
    rotation: sway * (isStealth ? 0.018 : 0.036)
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

export interface FloatingTextMotion {
  scale: number;
  alpha: number;
  offsetY: number;
}

/**
 * Computes snappy pop-in scale, upward drift, and late fade-out for floating combat numbers
 * so damage & critical hits feel punchy and readable without harsh instant disappearance.
 */
export function computeFloatingTextMotion(
  elapsedSec: number,
  durationSec: number,
  isCritical: boolean,
  reducedMotion: boolean
): FloatingTextMotion {
  const dur = Math.max(0.05, durationSec);
  const progress = clamp01(elapsedSec / dur);
  // Hold full opacity for the first 62% of lifetime, then fade out cleanly
  const alpha = progress < 0.62 ? 1 : clamp01(1 - (progress - 0.62) / 0.38);

  if (reducedMotion) {
    return { scale: isCritical ? 1.12 : 1.0, alpha, offsetY: 0 };
  }

  const peakScale = isCritical ? 1.42 : 1.22;
  let scale = 1.0;
  if (elapsedSec < 0.11) {
    const t = clamp01(elapsedSec / 0.11);
    const eased = 1 - Math.pow(1 - t, 3);
    scale = 0.68 + (peakScale - 0.68) * eased;
  } else if (elapsedSec < 0.28) {
    const t = clamp01((elapsedSec - 0.11) / 0.17);
    const eased = t * t * (3 - 2 * t);
    scale = peakScale - (peakScale - (isCritical ? 1.08 : 1.0)) * eased;
  } else {
    scale = isCritical ? 1.08 : 1.0;
  }

  const driftEased = 1 - Math.pow(1 - progress, 2);
  const offsetY = -driftEased * (isCritical ? 18 : 13);
  return { scale, alpha, offsetY };
}

/**
 * Returns true when an NPC's persistent marker bubble (e.g. "💬 Czcibor", "🌿 Zielarka")
 * already displays the core identity of `actorName` (e.g. "Wartownik Czcibor", "Bagienna Zielarka"),
 * avoiding redundant stacked duplicate labels above the same character.
 */
export function isNpcNameCoveredBySpeechMarker(
  speechBubbleText: string | null | undefined,
  actorName: string
): boolean {
  if (!speechBubbleText || !actorName) return false;
  const stripped = speechBubbleText
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s❗❓⚔️🛡️🌿⚒️🍺💰🗣️💬⚖️📜🔥🪧⭐💀]+/gu, '')
    .trim()
    .toLowerCase();
  if (stripped.length < 3) return false;
  const normName = actorName.trim().toLowerCase();
  return normName.includes(stripped) || stripped.includes(normName);
}

/**
 * Identifies ethereal hovering actors (marsh wisps, wraiths, spirits) that should
 * float smoothly and animate continuously even when stationary, without footstep dust.
 */
export function isHoveringActor(actorId: string, actorName: string): boolean {
  const hay = `${actorId} ${actorName}`.toLowerCase();
  return /(blednik|błędnik|upior|upiór|widmo|zjawa|duch|wisp)/.test(hay);
}

/**
 * Smooth ethereal hover motion for floating spirits/wisps.
 */
export function computeHoverFloatTransform(
  actorId: string,
  elapsedSec: number,
  isMoving: boolean,
  reducedMotion: boolean
): WalkStrideTransform {
  if (reducedMotion) {
    return { offsetY: -3.5, scaleX: 1, scaleY: 1, rotation: 0 };
  }
  const seed = hashStringSeed(actorId);
  const wave = Math.sin(elapsedSec * (isMoving ? 3.6 : 2.6) + seed);
  const sway = Math.cos(elapsedSec * 1.9 + seed * 1.3);
  return {
    offsetY: -4.5 + wave * (isMoving ? 2.4 : 3.2),
    scaleX: 1 + wave * 0.02,
    scaleY: 1 - wave * 0.02,
    rotation: sway * (isMoving ? 0.06 : 0.035)
  };
}

/**
 * Asymmetric attack lunge curve: quick anticipation pull-back -> explosive forward strike -> smooth recovery.
 */
export function computeAttackLungeTransform(
  progress: number,
  reducedMotion: boolean
): AttackLungeTransform {
  const p = clamp01(progress);
  if (reducedMotion || p <= 0 || p >= 1) {
    return { distFactor: 0, leanRad: 0, scaleX: 1, scaleY: 1 };
  }
  if (p < 0.22) {
    // Wind-up pull-back
    const t = p / 0.22;
    const e = Math.sin(t * Math.PI * 0.5);
    return {
      distFactor: -0.24 * e,
      leanRad: -0.1 * e,
      scaleX: 1 - 0.04 * e,
      scaleY: 1 + 0.04 * e
    };
  }
  if (p < 0.48) {
    // Explosive snap forward into impact
    const t = (p - 0.22) / 0.26;
    const e = 1 - Math.pow(1 - t, 3);
    return {
      distFactor: -0.24 + 1.39 * e,
      leanRad: -0.1 + 0.31 * e,
      scaleX: 0.96 + 0.13 * e,
      scaleY: 1.04 - 0.1 * e
    };
  }
  // Cushioned ease-out recovery
  const t = (p - 0.48) / 0.52;
  const rem = Math.pow(1 - t, 2);
  return {
    distFactor: 1.15 * rem,
    leanRad: 0.21 * rem,
    scaleX: 1 + 0.09 * rem,
    scaleY: 1 - 0.06 * rem
  };
}

/**
 * Sharp impact knockback impulse with cushioned recovery and squash.
 */
export function computeHitRecoilTransform(
  progress: number,
  reducedMotion: boolean
): HitRecoilTransform {
  const p = clamp01(progress);
  if (reducedMotion || p <= 0 || p >= 1) {
    return { distFactor: 0, leanRad: 0, scaleX: 1, scaleY: 1 };
  }
  if (p < 0.2) {
    const t = p / 0.2;
    const e = 1 - Math.pow(1 - t, 3);
    return {
      distFactor: e,
      leanRad: 0.24 * e,
      scaleX: 1 + 0.09 * e,
      scaleY: 1 - 0.1 * e
    };
  }
  const t = (p - 0.2) / 0.8;
  const rem = Math.pow(1 - t, 2.2);
  return {
    distFactor: rem,
    leanRad: 0.24 * rem,
    scaleX: 1 + 0.09 * rem,
    scaleY: 1 - 0.1 * rem
  };
}

/**
 * Boss/elite telegraph anticipation posture while charging a telegraphed special attack.
 */
export function computeTelegraphAnticipationPose(
  intent: string,
  elapsedSec: number,
  reducedMotion: boolean
): TelegraphPoseTransform {
  if (reducedMotion) {
    return { offsetX: 0, offsetY: 0, scaleX: 1.04, scaleY: 0.96, rotation: 0 };
  }
  const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * 7.5);
  const tremor = Math.sin(elapsedSec * 42) * 1.05;
  if (intent === 'terror_howl') {
    return {
      offsetX: tremor * 0.7,
      offsetY: -2.2 - pulse * 1.4,
      scaleX: 1.03 + pulse * 0.03,
      scaleY: 1.05 + pulse * 0.05,
      rotation: Math.sin(elapsedSec * 14) * 0.03
    };
  }
  // heavy_cleave / generic power wind-up: coiled down, widened shoulders, tense rear tilt
  return {
    offsetX: tremor,
    offsetY: 1.6 + pulse * 0.8,
    scaleX: 1.05 + pulse * 0.04,
    scaleY: 0.93 - pulse * 0.03,
    rotation: -0.065 - pulse * 0.025
  };
}
