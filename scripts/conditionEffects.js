// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\conditionEffects.js

import {
  CONDITION_EFFECT_IDS,
  DEFAULT_CONDITION_EFFECT,
  CONDITION_EFFECT_LIMITS
} from "./constants.js";

/*
 * Preserve these exports for existing imports elsewhere in the module.
 */
export {
  CONDITION_EFFECT_IDS,
  DEFAULT_CONDITION_EFFECT
};

/**
 * Neutral condition-driven motion effects.
 *
 * This file defines only render-animation behaviour.
 *
 * It must not:
 * - inspect actors, tokens, Active Effects, statuses, or game systems
 * - contain D&D 5e condition identifiers
 * - access Foundry documents
 * - write to token render objects
 * - decide which effect applies to a token
 *
 * A separate condition resolver translates system-specific statuses into one
 * of the neutral effect identifiers defined in constants.js.
 */

/**
 * Registered neutral condition effects.
 *
 * These values modify the token's already-resolved idle-animation parameters.
 * They do not replace global settings or placed-token motion overrides.
 */
export const CONDITION_EFFECTS = Object.freeze({
  [CONDITION_EFFECT_IDS.NORMAL]: createConditionEffect({
    id: CONDITION_EFFECT_IDS.NORMAL
  }),

  /**
   * Completely suppress ordinary idle animation.
   *
   * The animation engine restores and preserves the captured pivot and
   * rotation while this effect is active.
   */
  [CONDITION_EFFECT_IDS.STILL]: createConditionEffect({
    id: CONDITION_EFFECT_IDS.STILL,

    animationEnabled: false,

    amountMultiplier: 0,
    frequencyMultiplier: 0,
    bobMultiplier: 0,
    swayMultiplier: 0,
    rollMultiplier: 0,
    noiseMultiplier: 0,

    irregularity: 0
  }),

  /**
   * Preserve slow, shallow movement while strongly reducing lateral motion,
   * rotation, and procedural variation.
   */
  [CONDITION_EFFECT_IDS.SUBDUED]: createConditionEffect({
    id: CONDITION_EFFECT_IDS.SUBDUED,

    amountMultiplier: 0.35,
    frequencyMultiplier: 0.5,
    bobMultiplier: 0.7,
    swayMultiplier: 0.2,
    rollMultiplier: 0.15,
    noiseMultiplier: 0.25,

    irregularity: 0
  }),

  /**
   * Retain the ordinary idle pattern while adding a small, rapid tremor.
   */
  [CONDITION_EFFECT_IDS.TREMBLING]: createConditionEffect({
    id: CONDITION_EFFECT_IDS.TREMBLING,

    amountMultiplier: 0.9,
    frequencyMultiplier: 1.15,
    bobMultiplier: 0.8,
    swayMultiplier: 0.8,
    rollMultiplier: 0.75,
    noiseMultiplier: 1.25,

    irregularity: 0.15,

    tremorPx: 0.35,
    tremorFrequencyHz: 8
  }),

  /**
   * Reduce ordinary motion and permit occasional short impulses.
   *
   * Twitch timing and interpolation are handled by the animation engine.
   * No randomness is generated in this definition file.
   */
  [CONDITION_EFFECT_IDS.TWITCHING]: createConditionEffect({
    id: CONDITION_EFFECT_IDS.TWITCHING,

    amountMultiplier: 0.6,
    frequencyMultiplier: 0.75,
    bobMultiplier: 0.5,
    swayMultiplier: 0.45,
    rollMultiplier: 0.5,
    noiseMultiplier: 0.6,

    irregularity: 0.4,

    twitchChancePerSecond: 0.18,
    twitchDistancePx: 0.8,
    twitchRotationDeg: 0.5,
    twitchDurationMs: 180
  })
});

/**
 * Return a registered neutral condition effect.
 *
 * Unknown, empty, and invalid identifiers fall back to the normal effect.
 * The returned objects are frozen and must be treated as immutable.
 */
export function getConditionEffect(effectId) {
  const normalisedId =
    normaliseConditionEffectId(effectId);

  return (
    CONDITION_EFFECTS[normalisedId] ??
    CONDITION_EFFECTS[CONDITION_EFFECT_IDS.NORMAL]
  );
}

/**
 * Return whether a value identifies a registered neutral condition effect.
 */
export function isConditionEffectId(effectId) {
  const normalisedId =
    normaliseConditionEffectId(effectId);

  return Object.hasOwn(
    CONDITION_EFFECTS,
    normalisedId
  );
}

/**
 * Convert an arbitrary effect identifier into a stable lowercase key.
 *
 * This function performs no aliases or system-specific translation.
 */
export function normaliseConditionEffectId(effectId) {
  return String(effectId ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Build and freeze one complete neutral condition effect.
 *
 * Every effect receives the full default shape so downstream code does not
 * need to handle missing fields.
 *
 * All numeric values are constrained by the shared internal safety limits
 * defined in constants.js.
 */
function createConditionEffect(values = {}) {
  return Object.freeze({
    id: normaliseConditionEffectId(
      values.id ||
      DEFAULT_CONDITION_EFFECT.id
    ),

    animationEnabled:
      typeof values.animationEnabled === "boolean"
        ? values.animationEnabled
        : DEFAULT_CONDITION_EFFECT.animationEnabled,

    amountMultiplier: clampNumber(
      values.amountMultiplier,
      CONDITION_EFFECT_LIMITS.amountMultiplierMin,
      CONDITION_EFFECT_LIMITS.amountMultiplierMax,
      DEFAULT_CONDITION_EFFECT.amountMultiplier
    ),

    frequencyMultiplier: clampNumber(
      values.frequencyMultiplier,
      CONDITION_EFFECT_LIMITS.frequencyMultiplierMin,
      CONDITION_EFFECT_LIMITS.frequencyMultiplierMax,
      DEFAULT_CONDITION_EFFECT.frequencyMultiplier
    ),

    bobMultiplier: clampNumber(
      values.bobMultiplier,
      CONDITION_EFFECT_LIMITS.bobMultiplierMin,
      CONDITION_EFFECT_LIMITS.bobMultiplierMax,
      DEFAULT_CONDITION_EFFECT.bobMultiplier
    ),

    swayMultiplier: clampNumber(
      values.swayMultiplier,
      CONDITION_EFFECT_LIMITS.swayMultiplierMin,
      CONDITION_EFFECT_LIMITS.swayMultiplierMax,
      DEFAULT_CONDITION_EFFECT.swayMultiplier
    ),

    rollMultiplier: clampNumber(
      values.rollMultiplier,
      CONDITION_EFFECT_LIMITS.rollMultiplierMin,
      CONDITION_EFFECT_LIMITS.rollMultiplierMax,
      DEFAULT_CONDITION_EFFECT.rollMultiplier
    ),

    noiseMultiplier: clampNumber(
      values.noiseMultiplier,
      CONDITION_EFFECT_LIMITS.noiseMultiplierMin,
      CONDITION_EFFECT_LIMITS.noiseMultiplierMax,
      DEFAULT_CONDITION_EFFECT.noiseMultiplier
    ),

    irregularity: clampNumber(
      values.irregularity,
      CONDITION_EFFECT_LIMITS.irregularityMin,
      CONDITION_EFFECT_LIMITS.irregularityMax,
      DEFAULT_CONDITION_EFFECT.irregularity
    ),

    tremorPx: clampNumber(
      values.tremorPx,
      CONDITION_EFFECT_LIMITS.tremorPxMin,
      CONDITION_EFFECT_LIMITS.tremorPxMax,
      DEFAULT_CONDITION_EFFECT.tremorPx
    ),

    tremorFrequencyHz: clampNumber(
      values.tremorFrequencyHz,
      CONDITION_EFFECT_LIMITS.tremorFrequencyHzMin,
      CONDITION_EFFECT_LIMITS.tremorFrequencyHzMax,
      DEFAULT_CONDITION_EFFECT.tremorFrequencyHz
    ),

    twitchChancePerSecond: clampNumber(
      values.twitchChancePerSecond,
      CONDITION_EFFECT_LIMITS.twitchChancePerSecondMin,
      CONDITION_EFFECT_LIMITS.twitchChancePerSecondMax,
      DEFAULT_CONDITION_EFFECT.twitchChancePerSecond
    ),

    twitchDistancePx: clampNumber(
      values.twitchDistancePx,
      CONDITION_EFFECT_LIMITS.twitchDistancePxMin,
      CONDITION_EFFECT_LIMITS.twitchDistancePxMax,
      DEFAULT_CONDITION_EFFECT.twitchDistancePx
    ),

    twitchRotationDeg: clampNumber(
      values.twitchRotationDeg,
      CONDITION_EFFECT_LIMITS.twitchRotationDegMin,
      CONDITION_EFFECT_LIMITS.twitchRotationDegMax,
      DEFAULT_CONDITION_EFFECT.twitchRotationDeg
    ),

    twitchDurationMs: clampNumber(
      values.twitchDurationMs,
      CONDITION_EFFECT_LIMITS.twitchDurationMsMin,
      CONDITION_EFFECT_LIMITS.twitchDurationMsMax,
      DEFAULT_CONDITION_EFFECT.twitchDurationMs
    )
  });
}

/**
 * Return a finite number constrained to the supplied range.
 */
function clampNumber(
  value,
  minimum,
  maximum,
  fallback
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      number
    )
  );
}