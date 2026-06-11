// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\animation.js

import { RUNTIME_KEY } from "./constants.js";
import { buildAnimationParamsFromSettings } from "./settings.js";
import { degreesToRadians } from "./utils.js";

const DEBUG = true;

const JITTER_X = 0.8;
const JITTER_Y = 0.6;
const JITTER_ROT = 0.15;

const TWO_PI = 2 * Math.PI;

const TOKEN_VARIATION = {
  amplitudeMin: 0.75,
  amplitudeMax: 1.25,

  frequencyMin: 0.85,
  frequencyMax: 1.15,

  axisFrequencyMin: 0.88,
  axisFrequencyMax: 1.12,

  speedDriftAmountMin: 0.08,
  speedDriftAmountMax: 0.22,

  speedDriftHzMin: 0.015,
  speedDriftHzMax: 0.045
};

/**
 * Apply a GM sync message on the local client.
 *
 * The GM decides which token ids are eligible.
 * The client applies local render-only animation to those token render objects.
 *
 * Supports:
 * - global params for all tokens
 * - per-token params from message.tokenParams[tokenId]
 */
export function applySyncMessage(message) {
  if (!canvas?.scene) return;
  if (message.sceneId !== canvas.scene.id) return;

  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  const activeTokens = runtime.state.activeTokens;
  const nextTokenIds = new Set(Array.isArray(message.tokenIds) ? message.tokenIds : []);
  const fallbackParams = normaliseParams(message.params ?? buildAnimationParamsFromSettings());

  for (const tokenId of Array.from(activeTokens.keys())) {
    if (nextTokenIds.has(tokenId)) continue;
    stopToken(tokenId);
  }

  for (const tokenId of nextTokenIds) {
    const params = normaliseParams(message.tokenParams?.[tokenId] ?? fallbackParams);
    startToken(tokenId, params);
  }

  if (DEBUG) {
    console.log("[Idle Token Animation] Sync applied.", {
      sceneId: message.sceneId,
      receivedTokenIds: Array.from(nextTokenIds),
      activeCount: activeTokens.size,
      params: fallbackParams,
      tokenParams: message.tokenParams ?? {}
    });
  }

  if (activeTokens.size > 0) ensureTicker();
  else stopTicker();
}

/**
 * Start local render-only animation for one token.
 *
 * Only pivot and rotation are snapshotted.
 * Scale is deliberately not snapshotted, pinned, or restored.
 *
 * Desynchronise token motion:
 * - uses stable deterministic per-token variation
 * - gives each token separate bob/sway/roll phases
 * - gives each token slight amplitude and frequency variation
 * - gives each token gradual speed drift
 *
 * This is not random per frame. It is stable per token, scene, and client sync.
 */
function startToken(tokenId, params) {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  const normalisedParams = normaliseParams(params);
  const existing = runtime.state.activeTokens.get(tokenId);

  if (existing) {
    const previousRandomPhase = existing.params?.randomPhase;
    existing.params = normalisedParams;
    existing.profile = buildTokenProfile(tokenId, normalisedParams.randomPhase);

    if (
      previousRandomPhase !== normalisedParams.randomPhase
      || !Number.isFinite(existing.bobPhase)
      || !Number.isFinite(existing.swayPhase)
      || !Number.isFinite(existing.rollPhase)
    ) {
      resetTokenPhases(existing);
    }

    return;
  }

  const token = canvas?.tokens?.get(tokenId);
  if (!token) {
    if (DEBUG) console.warn("[Idle Token Animation] Token not found.", { tokenId });
    return;
  }

  const target = getAnimationTarget(token);
  if (!target) {
    if (DEBUG) console.warn("[Idle Token Animation] No animation target.", { tokenId, token });
    return;
  }

  const base = snapshotBase(target);
  if (!base) {
    if (DEBUG) console.warn("[Idle Token Animation] Could not snapshot target.", { tokenId, target });
    return;
  }

  const profile = buildTokenProfile(tokenId, normalisedParams.randomPhase);

  const state = {
    tokenId,
    target,
    base,
    params: normalisedParams,
    profile,
    bobPhase: profile.bobPhase,
    swayPhase: profile.swayPhase,
    rollPhase: profile.rollPhase,
    t: 0
  };

  runtime.state.activeTokens.set(tokenId, state);

  if (DEBUG) {
    console.log("[Idle Token Animation] Token started.", {
      tokenId,
      tokenName: token.name,
      targetName: target.constructor?.name,
      base,
      params: state.params,
      profile: state.profile
    });
  }
}

/**
 * Reset a token state's animated phases from its current motion profile.
 */
function resetTokenPhases(state) {
  state.bobPhase = state.profile.bobPhase;
  state.swayPhase = state.profile.swayPhase;
  state.rollPhase = state.profile.rollPhase;
}

/**
 * Stop local animation for one token and restore captured pivot/rotation.
 */
export function stopToken(tokenId) {
  const runtime = globalThis[RUNTIME_KEY];
  const state = runtime?.state?.activeTokens?.get(tokenId);

  if (!state) return;

  if (state.target && !state.target.destroyed) {
    restoreBase(state.target, state.base);
  }

  runtime.state.activeTokens.delete(tokenId);

  if (DEBUG) {
    console.log("[Idle Token Animation] Token stopped.", { tokenId });
  }

  if (runtime.state.activeTokens.size === 0) {
    stopTicker();
  }
}

/**
 * Stop every local animation and restore all captured pivots/rotations.
 */
export function stopAll() {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  for (const tokenId of Array.from(runtime.state.activeTokens.keys())) {
    stopToken(tokenId);
  }

  stopTicker();

  if (DEBUG) {
    console.log("[Idle Token Animation] All tokens stopped.");
  }
}

/**
 * Animate all active local token render objects.
 *
 * Writes only:
 * - target.pivot
 * - target.rotation
 *
 * Never writes:
 * - TokenDocument
 * - token x/y
 * - token.position
 * - scene embedded documents
 * - target.scale
 * - target.visible
 * - target.renderable
 * - target.alpha
 */
function tickAnimations() {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  const deltaMS = getSafeDeltaMS();
  const dt = Math.max(0, deltaMS) / 1000;

  if (runtime.state.activeTokens.size === 0) {
    stopTicker();
    return;
  }

  for (const state of Array.from(runtime.state.activeTokens.values())) {
    if (globalThis.fxbusTokenOscillation?.isActive?.(state.tokenId)) {
      stopToken(state.tokenId);
      continue;
    }

    const token = canvas?.tokens?.get(state.tokenId);
    if (!token) {
      stopToken(state.tokenId);
      continue;
    }

    const target = getAnimationTarget(token);
    if (!target || target !== state.target || target.destroyed) {
      stopToken(state.tokenId);
      continue;
    }

    state.t += dt;

    const { base, params, profile } = state;

    const speedDrift = getSpeedDriftMultiplier(state);
    const baseRate = TWO_PI * params.freqHz * profile.frequencyMultiplier * speedDrift;

    state.bobPhase = wrapPhase(state.bobPhase + (dt * baseRate * profile.bobFrequencyMultiplier));
    state.swayPhase = wrapPhase(state.swayPhase + (dt * baseRate * profile.swayFrequencyMultiplier));
    state.rollPhase = wrapPhase(state.rollPhase + (dt * baseRate * profile.rollFrequencyMultiplier));

    const bob = params.bobPx * profile.bobAmplitudeMultiplier * Math.sin(state.bobPhase);
    const sway = params.swayPx * profile.swayAmplitudeMultiplier * Math.sin(state.swayPhase);
    const roll = params.rollRad * profile.rollAmplitudeMultiplier * Math.sin(state.rollPhase);

    const n = params.noise > 0 ? noise1(profile, state.t) * params.noise : 0;
    const jx = n * JITTER_X;
    const jy = n * JITTER_Y;
    const jr = n * JITTER_ROT;

    /**
     * Large comment:
     * Pivot offsets are inverted because moving the pivot moves the rendered
     * content in the opposite visual direction.
     *
     * This matches the safe FX Bus token oscillation principle while avoiding
     * scale/visibility writes that are inappropriate for permanent idle motion.
     */
    const pivotX = base.pivotX - (sway + jx);
    const pivotY = base.pivotY - (bob + jy);

    if (target.pivot?.set) target.pivot.set(pivotX, pivotY);
    else {
      target.pivot.x = pivotX;
      target.pivot.y = pivotY;
    }

    target.rotation = base.rotation + roll + jr;
  }
}

/**
 * Ensure the local canvas ticker is running.
 */
function ensureTicker() {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state) return;
  if (runtime.state.ticker) return;
  if (!canvas?.app?.ticker) return;

  runtime.state.ticker = tickAnimations;
  canvas.app.ticker.add(runtime.state.ticker);

  if (DEBUG) {
    console.log("[Idle Token Animation] Ticker started.");
  }
}

/**
 * Stop the local canvas ticker.
 */
function stopTicker() {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.ticker) return;

  if (canvas?.app?.ticker) {
    canvas.app.ticker.remove(runtime.state.ticker);
  }

  runtime.state.ticker = null;

  if (DEBUG) {
    console.log("[Idle Token Animation] Ticker stopped.");
  }
}

/**
 * Resolve the render object to animate.
 *
 * Do not reparent.
 * Do not animate the Token root when mesh/icon exists.
 */
export function getAnimationTarget(token) {
  return token?.mesh ?? token?.icon ?? null;
}

/**
 * Snapshot baseline pivot and rotation only.
 */
function snapshotBase(target) {
  if (!target) return null;

  const pivotX = Number.isFinite(target.pivot?.x) ? target.pivot.x : 0;
  const pivotY = Number.isFinite(target.pivot?.y) ? target.pivot.y : 0;
  const rotation = Number.isFinite(target.rotation) ? target.rotation : 0;

  return {
    pivotX,
    pivotY,
    rotation
  };
}

/**
 * Restore baseline pivot and rotation only.
 */
function restoreBase(target, base) {
  if (!target || !base) return;

  if (target.pivot?.set) target.pivot.set(base.pivotX, base.pivotY);
  else {
    target.pivot.x = base.pivotX;
    target.pivot.y = base.pivotY;
  }

  target.rotation = base.rotation;
}

/**
 * Convert settings payload to animation parameters.
 */
function normaliseParams(params) {
  const rollDeg = finiteNumber(params?.rollDeg, 0);
  const bobPx = finiteNumber(params?.bobPx, 2);
  const swayPx = finiteNumber(params?.swayPx, 2);
  const freqHz = finiteNumber(params?.freqHz, 0.5);
  const noise = finiteNumber(params?.noise, 0.01);
  const randomPhase = typeof params?.randomPhase === "boolean" ? params.randomPhase : true;

  return {
    amount: finiteNumber(params?.amount, 1),
    rollRad: degreesToRadians(rollDeg),
    bobPx,
    swayPx,
    freqHz: Math.max(0.01, freqHz),
    noise: Math.max(0, Math.min(0.5, noise)),
    randomPhase
  };
}

/**
 * Build a stable per-token motion profile.
 *
 * When desynchronisation is disabled:
 * - all multipliers are 1
 * - all drift is disabled
 * - bob, sway, and roll use the previous simple relationship
 *
 * When desynchronisation is enabled:
 * - each token receives stable deterministic variation
 * - speed gently accelerates and decelerates over time
 * - axes no longer share one obviously synchronised phase
 */
function buildTokenProfile(tokenId, randomPhase) {
  if (!randomPhase) {
    return {
      bobPhase: Math.PI / 2,
      swayPhase: 0,
      rollPhase: 0,

      bobAmplitudeMultiplier: 1,
      swayAmplitudeMultiplier: 1,
      rollAmplitudeMultiplier: 1,

      frequencyMultiplier: 1,
      bobFrequencyMultiplier: 1,
      swayFrequencyMultiplier: 1,
      rollFrequencyMultiplier: 1,

      speedDriftAmount: 0,
      speedDriftHz: 0,
      speedDriftPhase: 0,

      noisePhaseA: 0,
      noisePhaseB: 0,
      noisePhaseC: 0,
      noiseHzA: 0.11,
      noiseHzB: 0.17,
      noiseHzC: 0.07
    };
  }

  const seed = `${canvas?.scene?.id ?? "scene"}:${tokenId}`;

  return {
    bobPhase: randomRange(seed, "bobPhase", 0, TWO_PI),
    swayPhase: randomRange(seed, "swayPhase", 0, TWO_PI),
    rollPhase: randomRange(seed, "rollPhase", 0, TWO_PI),

    bobAmplitudeMultiplier: randomRange(
      seed,
      "bobAmplitudeMultiplier",
      TOKEN_VARIATION.amplitudeMin,
      TOKEN_VARIATION.amplitudeMax
    ),
    swayAmplitudeMultiplier: randomRange(
      seed,
      "swayAmplitudeMultiplier",
      TOKEN_VARIATION.amplitudeMin,
      TOKEN_VARIATION.amplitudeMax
    ),
    rollAmplitudeMultiplier: randomRange(
      seed,
      "rollAmplitudeMultiplier",
      TOKEN_VARIATION.amplitudeMin,
      TOKEN_VARIATION.amplitudeMax
    ),

    frequencyMultiplier: randomRange(
      seed,
      "frequencyMultiplier",
      TOKEN_VARIATION.frequencyMin,
      TOKEN_VARIATION.frequencyMax
    ),
    bobFrequencyMultiplier: randomRange(
      seed,
      "bobFrequencyMultiplier",
      TOKEN_VARIATION.axisFrequencyMin,
      TOKEN_VARIATION.axisFrequencyMax
    ),
    swayFrequencyMultiplier: randomRange(
      seed,
      "swayFrequencyMultiplier",
      TOKEN_VARIATION.axisFrequencyMin,
      TOKEN_VARIATION.axisFrequencyMax
    ),
    rollFrequencyMultiplier: randomRange(
      seed,
      "rollFrequencyMultiplier",
      TOKEN_VARIATION.axisFrequencyMin,
      TOKEN_VARIATION.axisFrequencyMax
    ),

    speedDriftAmount: randomRange(
      seed,
      "speedDriftAmount",
      TOKEN_VARIATION.speedDriftAmountMin,
      TOKEN_VARIATION.speedDriftAmountMax
    ),
    speedDriftHz: randomRange(
      seed,
      "speedDriftHz",
      TOKEN_VARIATION.speedDriftHzMin,
      TOKEN_VARIATION.speedDriftHzMax
    ),
    speedDriftPhase: randomRange(seed, "speedDriftPhase", 0, TWO_PI),

    noisePhaseA: randomRange(seed, "noisePhaseA", 0, TWO_PI),
    noisePhaseB: randomRange(seed, "noisePhaseB", 0, TWO_PI),
    noisePhaseC: randomRange(seed, "noisePhaseC", 0, TWO_PI),
    noiseHzA: randomRange(seed, "noiseHzA", 0.08, 0.16),
    noiseHzB: randomRange(seed, "noiseHzB", 0.16, 0.28),
    noiseHzC: randomRange(seed, "noiseHzC", 0.035, 0.09)
  };
}

/**
 * Return the current gradual speed multiplier for one token.
 *
 * This makes tokens slowly speed up and slow down without changing real token
 * position or document state.
 */
function getSpeedDriftMultiplier(state) {
  const { profile } = state;

  if (!profile.speedDriftAmount || !profile.speedDriftHz) {
    return 1;
  }

  return 1 + (
    Math.sin((state.t * profile.speedDriftHz * TWO_PI) + profile.speedDriftPhase)
    * profile.speedDriftAmount
  );
}

/**
 * Get a safe ticker delta in milliseconds.
 */
function getSafeDeltaMS() {
  const deltaMS = Number(canvas?.app?.ticker?.deltaMS);

  if (Number.isFinite(deltaMS) && deltaMS > 0 && deltaMS < 1000) {
    return deltaMS;
  }

  return 1000 / 60;
}

/**
 * Deterministic smooth pseudo-noise in [-1, 1].
 *
 * This is deliberately slow. It should read as organic irregularity rather
 * than twitching or frame jitter.
 */
function noise1(profile, tSeconds) {
  const a = Math.sin((tSeconds * profile.noiseHzA * TWO_PI) + profile.noisePhaseA);
  const b = Math.sin((tSeconds * profile.noiseHzB * TWO_PI) + profile.noisePhaseB);
  const c = Math.sin((tSeconds * profile.noiseHzC * TWO_PI) + profile.noisePhaseC);

  return (1.0 * a + 0.6 * b + 0.3 * c) / 1.9;
}

/**
 * Keep a phase in a small stable range.
 */
function wrapPhase(value) {
  if (!Number.isFinite(value)) return 0;
  if (value >= TWO_PI || value <= -TWO_PI) return value % TWO_PI;
  return value;
}

/**
 * Return a deterministic random number in a range.
 */
function randomRange(seed, salt, min, max) {
  return min + ((max - min) * hashStringToUnit(`${seed}:${salt}`));
}

/**
 * FNV-1a 32-bit hash to unit interval.
 */
function hashStringToUnit(str) {
  let h = 0x811c9dc5;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return (h >>> 0) / (2 ** 32);
}

/**
 * Return a finite number or fallback.
 */
function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}