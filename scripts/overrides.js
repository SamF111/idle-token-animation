// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\overrides.js

import { MODULE_ID } from "./constants.js";
import { resolveConditionEffect } from "./conditionResolver.js";

/**
 * Build final animation parameters for a specific placed token.
 *
 * Resolution order:
 * 1. Begin with global motion settings.
 * 2. Apply any enabled placed-token motion override.
 * 3. Resolve the token's neutral condition effect.
 * 4. Apply the condition effect to the resolved motion values.
 *
 * Token override rules:
 * - Missing fields inherit from the global motion settings.
 * - Override values are raw motion values before Motion Strength is applied.
 * - Frequency is direct and is not multiplied by Motion Strength.
 * - Any invalid override object is ignored.
 *
 * Condition-effect rules:
 * - Condition effects do not modify stored settings or token flags.
 * - Condition multipliers are applied after placed-token overrides.
 * - Tremor and twitch values are returned for the client animation engine.
 * - A disabled condition effect returns zero ordinary movement while retaining
 *   the token in the synchronisation payload.
 */
export function buildAnimationParamsForToken(token, globalParams) {
  const motionParams = buildBaseAnimationParamsForToken(
    token,
    globalParams
  );

  const conditionEffect = resolveConditionEffect(token);

  return applyConditionEffect(
    motionParams,
    conditionEffect
  );
}

/**
 * Build the token's ordinary motion parameters before condition effects.
 *
 * This preserves the existing global and placed-token override behaviour.
 */
function buildBaseAnimationParamsForToken(token, globalParams) {
  const override = getTokenMotionOverride(token);

  if (!override?.enabled) {
    return {
      ...globalParams
    };
  }

  const amount = finiteNumber(
    override.amount,
    globalParams.amount
  );

  const bobPx = finiteNumber(
    override.bobPx,
    globalParams.baseBobPx
  );

  const swayPx = finiteNumber(
    override.swayPx,
    globalParams.baseSwayPx
  );

  const rollDeg = finiteNumber(
    override.rollDeg,
    globalParams.baseRollDeg
  );

  const freqHz = finiteNumber(
    override.freqHz,
    globalParams.freqHz
  );

  const noise = finiteNumber(
    override.noise,
    globalParams.baseNoise
  );

  const randomPhase =
    typeof override.randomPhase === "boolean"
      ? override.randomPhase
      : globalParams.randomPhase;

  return {
    amount,

    baseBobPx: bobPx,
    baseSwayPx: swayPx,
    baseRollDeg: rollDeg,
    baseNoise: noise,

    bobPx: bobPx * amount,
    swayPx: swayPx * amount,
    rollDeg: rollDeg * amount,
    freqHz,
    noise: noise * amount,

    randomPhase
  };
}

/**
 * Apply one neutral condition effect to resolved token motion parameters.
 *
 * The original raw settings remain available through the base fields.
 * Effective fields are modified for consumption by the animation engine.
 */
function applyConditionEffect(params, effect) {
  const animationEnabled = effect?.animationEnabled !== false;

  const amountMultiplier = finiteNonNegativeNumber(
    effect?.amountMultiplier,
    1
  );

  const frequencyMultiplier = finiteNonNegativeNumber(
    effect?.frequencyMultiplier,
    1
  );

  const bobMultiplier = finiteNonNegativeNumber(
    effect?.bobMultiplier,
    1
  );

  const swayMultiplier = finiteNonNegativeNumber(
    effect?.swayMultiplier,
    1
  );

  const rollMultiplier = finiteNonNegativeNumber(
    effect?.rollMultiplier,
    1
  );

  const noiseMultiplier = finiteNonNegativeNumber(
    effect?.noiseMultiplier,
    1
  );

  const conditionAmount = animationEnabled
    ? amountMultiplier
    : 0;

  const tremorPx = animationEnabled
    ? finiteNonNegativeNumber(effect?.tremorPx, 0) *
      params.amount
    : 0;

  const tremorFrequencyHz = animationEnabled
    ? finiteNonNegativeNumber(
        effect?.tremorFrequencyHz,
        0
      )
    : 0;

  const twitchChancePerSecond = animationEnabled
    ? clampNumber(
        effect?.twitchChancePerSecond,
        0,
        1,
        0
      )
    : 0;

  const twitchDistancePx = animationEnabled
    ? finiteNonNegativeNumber(
        effect?.twitchDistancePx,
        0
      ) * params.amount
    : 0;

  const twitchRotationDeg = animationEnabled
    ? finiteNonNegativeNumber(
        effect?.twitchRotationDeg,
        0
      ) * params.amount
    : 0;

  const twitchDurationMs = animationEnabled
    ? finiteNonNegativeNumber(
        effect?.twitchDurationMs,
        0
      )
    : 0;

  return {
    ...params,

    conditionEffectId: String(
      effect?.id ?? "normal"
    ),

    animationEnabled,

    conditionAmountMultiplier: amountMultiplier,
    conditionFrequencyMultiplier: frequencyMultiplier,
    conditionBobMultiplier: bobMultiplier,
    conditionSwayMultiplier: swayMultiplier,
    conditionRollMultiplier: rollMultiplier,
    conditionNoiseMultiplier: noiseMultiplier,

    bobPx:
      params.bobPx *
      conditionAmount *
      bobMultiplier,

    swayPx:
      params.swayPx *
      conditionAmount *
      swayMultiplier,

    rollDeg:
      params.rollDeg *
      conditionAmount *
      rollMultiplier,

    freqHz:
      params.freqHz *
      frequencyMultiplier,

    noise:
      params.noise *
      conditionAmount *
      noiseMultiplier,

    tremorPx,
    tremorFrequencyHz,

    twitchChancePerSecond,
    twitchDistancePx,
    twitchRotationDeg,
    twitchDurationMs
  };
}

/**
 * Read the placed-token motion override flag.
 */
export function getTokenMotionOverride(token) {
  const value = token?.document?.getFlag?.(
    MODULE_ID,
    "motionOverride"
  );

  if (!value || typeof value !== "object") {
    return null;
  }

  return value;
}

/**
 * Set a placed-token motion override.
 */
export async function setTokenMotionOverride(
  token,
  override
) {
  const document = token?.document ?? token;

  if (!document?.setFlag) {
    throw new Error(
      "[Idle Token Animation] Cannot set motion override. Invalid token document."
    );
  }

  await document.setFlag(
    MODULE_ID,
    "motionOverride",
    {
      enabled: true,

      amount: finiteNumber(
        override?.amount,
        1
      ),

      bobPx: finiteNumber(
        override?.bobPx,
        2
      ),

      swayPx: finiteNumber(
        override?.swayPx,
        2
      ),

      rollDeg: finiteNumber(
        override?.rollDeg,
        0
      ),

      freqHz: finiteNumber(
        override?.freqHz,
        0.5
      ),

      noise: finiteNumber(
        override?.noise,
        0.01
      ),

      randomPhase:
        override?.randomPhase !== false
    }
  );

  globalThis.idleTokenAnimation?.api?.requestSync?.();
}

/**
 * Clear a placed-token motion override.
 */
export async function clearTokenMotionOverride(token) {
  const document = token?.document ?? token;

  if (!document?.unsetFlag) {
    throw new Error(
      "[Idle Token Animation] Cannot clear motion override. Invalid token document."
    );
  }

  await document.unsetFlag(
    MODULE_ID,
    "motionOverride"
  );

  globalThis.idleTokenAnimation?.api?.requestSync?.();
}

/**
 * Return a finite number or the supplied fallback.
 */
function finiteNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/**
 * Return a finite non-negative number or the supplied fallback.
 */
function finiteNonNegativeNumber(value, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, number);
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
    Math.max(minimum, number)
  );
}