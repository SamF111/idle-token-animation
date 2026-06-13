// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\constants.js

export const MODULE_ID = "idle-token-animation";
export const RUNTIME_KEY = "idleTokenAnimation";
export const SOCKET_NAME = `module.${MODULE_ID}`;

/**
 * Default world-setting values.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  conditionAnimationsEnabled: true,

  amount: 1.0,
  bobPx: 2,
  swayPx: 2,
  rollDeg: 0,
  freqHz: 0.5,
  noise: 0.01,
  randomPhase: true,

  respectHidden: true,
  respectCombat: false,
  filterZeroHpTokens: true,
  hpDetectionMode: "auto",
  customHpPath: "",
  defaultActorOptOut: false
});

/**
 * Neutral condition-effect identifiers understood by the animation engine.
 *
 * These identifiers describe visual behaviour rather than game-system
 * conditions. System-specific resolvers translate their own statuses into
 * these neutral effects.
 */
export const CONDITION_EFFECT_IDS = Object.freeze({
  NORMAL: "normal",
  STILL: "still",
  SUBDUED: "subdued",
  TREMBLING: "trembling",
  TWITCHING: "twitching"
});

/**
 * Default values shared by all neutral condition effects.
 *
 * Multipliers of 1 preserve ordinary idle animation.
 * Additive values of 0 add no condition-specific movement.
 */
export const DEFAULT_CONDITION_EFFECT = Object.freeze({
  id: CONDITION_EFFECT_IDS.NORMAL,

  animationEnabled: true,

  amountMultiplier: 1,
  frequencyMultiplier: 1,
  bobMultiplier: 1,
  swayMultiplier: 1,
  rollMultiplier: 1,
  noiseMultiplier: 1,

  irregularity: 0,

  tremorPx: 0,
  tremorFrequencyHz: 0,

  twitchChancePerSecond: 0,
  twitchDistancePx: 0,
  twitchRotationDeg: 0,
  twitchDurationMs: 0
});

/**
 * Internal condition-animation safety limits.
 *
 * These are protective bounds rather than intended user-facing values.
 * Condition definitions and socket payloads must remain within these limits.
 */
export const CONDITION_EFFECT_LIMITS = Object.freeze({
  amountMultiplierMin: 0,
  amountMultiplierMax: 4,

  frequencyMultiplierMin: 0,
  frequencyMultiplierMax: 4,

  bobMultiplierMin: 0,
  bobMultiplierMax: 4,

  swayMultiplierMin: 0,
  swayMultiplierMax: 4,

  rollMultiplierMin: 0,
  rollMultiplierMax: 4,

  noiseMultiplierMin: 0,
  noiseMultiplierMax: 4,

  irregularityMin: 0,
  irregularityMax: 1,

  tremorPxMin: 0,
  tremorPxMax: 10,

  tremorFrequencyHzMin: 0,
  tremorFrequencyHzMax: 30,

  twitchChancePerSecondMin: 0,
  twitchChancePerSecondMax: 1,

  twitchDistancePxMin: 0,
  twitchDistancePxMax: 20,

  twitchRotationDegMin: 0,
  twitchRotationDegMax: 15,

  twitchDurationMsMin: 0,
  twitchDurationMsMax: 2000
});

/**
 * Internal client-runtime limits for condition-driven animation.
 *
 * These values constrain generated timing and render-layer output without
 * exposing additional public settings.
 */
export const CONDITION_RUNTIME_LIMITS = Object.freeze({
  minimumTwitchIntervalMs: 250,
  maximumTwitchIntervalMs: 60000,

  maximumCombinedOffsetPx: 50,
  maximumCombinedRotationDeg: 20,

  maximumTickerDeltaMs: 1000,
  fallbackTickerDeltaMs: 1000 / 60
});