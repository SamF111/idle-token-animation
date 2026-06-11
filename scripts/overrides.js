// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\overrides.js

import { MODULE_ID } from "./constants.js";

/**
 * Build final animation parameters for a specific placed token.
 *
 * Token override rules:
 * - Missing fields inherit from the global motion settings.
 * - Override values are raw motion values before Motion Strength is applied.
 * - Frequency is direct and is not multiplied by Motion Strength.
 * - Any invalid override object is ignored.
 */
export function buildAnimationParamsForToken(token, globalParams) {
  const override = getTokenMotionOverride(token);

  if (!override?.enabled) {
    return globalParams;
  }

  const amount = finiteNumber(override.amount, globalParams.amount);
  const bobPx = finiteNumber(override.bobPx, globalParams.baseBobPx);
  const swayPx = finiteNumber(override.swayPx, globalParams.baseSwayPx);
  const rollDeg = finiteNumber(override.rollDeg, globalParams.baseRollDeg);
  const freqHz = finiteNumber(override.freqHz, globalParams.freqHz);
  const noise = finiteNumber(override.noise, globalParams.baseNoise);
  const randomPhase = typeof override.randomPhase === "boolean"
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
 * Read the placed-token motion override flag.
 */
export function getTokenMotionOverride(token) {
  const value = token?.document?.getFlag?.(MODULE_ID, "motionOverride");

  if (!value || typeof value !== "object") {
    return null;
  }

  return value;
}

/**
 * Set a placed-token motion override.
 */
export async function setTokenMotionOverride(token, override) {
  const document = token?.document ?? token;

  if (!document?.setFlag) {
    throw new Error("[Idle Token Animation] Cannot set motion override. Invalid token document.");
  }

  await document.setFlag(MODULE_ID, "motionOverride", {
    enabled: true,
    amount: finiteNumber(override?.amount, 1),
    bobPx: finiteNumber(override?.bobPx, 2),
    swayPx: finiteNumber(override?.swayPx, 2),
    rollDeg: finiteNumber(override?.rollDeg, 0),
    freqHz: finiteNumber(override?.freqHz, 0.5),
    noise: finiteNumber(override?.noise, 0.01),
    randomPhase: override?.randomPhase !== false
  });

  globalThis.idleTokenAnimation?.api?.requestSync?.();
}

/**
 * Clear a placed-token motion override.
 */
export async function clearTokenMotionOverride(token) {
  const document = token?.document ?? token;

  if (!document?.unsetFlag) {
    throw new Error("[Idle Token Animation] Cannot clear motion override. Invalid token document.");
  }

  await document.unsetFlag(MODULE_ID, "motionOverride");

  globalThis.idleTokenAnimation?.api?.requestSync?.();
}

/**
 * Return a finite number or fallback.
 */
function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}