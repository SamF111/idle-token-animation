// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\animation.js

import { RUNTIME_KEY } from "./constants.js";
import { buildAnimationParamsFromSettings } from "./settings.js";
import { degreesToRadians } from "./utils.js";

const DEBUG = true;

const JITTER_X = 0.8;
const JITTER_Y = 0.6;
const JITTER_ROT = 0.15;

const TREMOR_ROTATION_FACTOR = 0.0025;

const MINIMUM_TWITCH_INTERVAL_MS = 250;
const MAXIMUM_TWITCH_INTERVAL_MS = 60000;

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
 * The GM decides which token ids are eligible and resolves all effective
 * animation parameters, including condition-derived behaviour.
 *
 * The client applies local render-only animation to the listed token render
 * objects.
 *
 * Supports:
 * - global parameters for all tokens
 * - per-token parameters from message.tokenParams[tokenId]
 * - condition-controlled animation suppression
 * - condition tremor
 * - condition twitch impulses
 */
export function applySyncMessage(message) {
  if (!canvas?.scene) return;
  if (message.sceneId !== canvas.scene.id) return;

  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  const activeTokens = runtime.state.activeTokens;

  const nextTokenIds = new Set(
    Array.isArray(message.tokenIds)
      ? message.tokenIds
      : []
  );

  const fallbackParams = normaliseParams(
    message.params ??
    buildAnimationParamsFromSettings()
  );

  for (const tokenId of Array.from(activeTokens.keys())) {
    if (nextTokenIds.has(tokenId)) continue;
    stopToken(tokenId);
  }

  for (const tokenId of nextTokenIds) {
    const params = normaliseParams(
      message.tokenParams?.[tokenId] ??
      fallbackParams
    );

    startToken(tokenId, params);
  }

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Sync applied.",
      {
        sceneId: message.sceneId,
        receivedTokenIds: Array.from(nextTokenIds),
        activeCount: activeTokens.size,
        params: fallbackParams,
        tokenParams: message.tokenParams ?? {}
      }
    );
  }

  if (activeTokens.size > 0) {
    ensureTicker();
  } else {
    stopTicker();
  }
}

/**
 * Start or update local render-only animation for one token.
 *
 * Only pivot and rotation are snapshotted.
 * Scale is deliberately not snapshotted, pinned, or restored.
 *
 * Desynchronised token motion:
 * - uses stable deterministic per-token variation
 * - gives each token separate bob, sway, and roll phases
 * - gives each token slight amplitude and frequency variation
 * - gives each token gradual speed drift
 *
 * Condition behaviour:
 * - disabled animation restores and holds the captured baseline
 * - tremor is deterministic and continuous
 * - twitch timing and direction are deterministic per token
 * - no random values are generated every frame
 */
function startToken(tokenId, params) {
  const runtime = globalThis[RUNTIME_KEY];
  if (!runtime?.state?.activeTokens) return;

  const normalisedParams = normaliseParams(params);
  const existing = runtime.state.activeTokens.get(tokenId);

  if (existing) {
    const previousRandomPhase =
      existing.params?.randomPhase;

    const previousConditionEffectId =
      existing.params?.conditionEffectId;

    const previousTwitchChance =
      existing.params?.twitchChancePerSecond;

    existing.params = normalisedParams;

    existing.profile = buildTokenProfile(
      tokenId,
      normalisedParams.randomPhase
    );

    if (
      previousRandomPhase !== normalisedParams.randomPhase ||
      !Number.isFinite(existing.bobPhase) ||
      !Number.isFinite(existing.swayPhase) ||
      !Number.isFinite(existing.rollPhase)
    ) {
      resetTokenPhases(existing);
    }

    if (
      previousConditionEffectId !==
      normalisedParams.conditionEffectId
    ) {
      resetConditionState(existing);
    } else if (
      previousTwitchChance !==
      normalisedParams.twitchChancePerSecond
    ) {
      scheduleNextTwitch(existing);
    }

    if (!normalisedParams.animationEnabled) {
      restoreBase(existing.target, existing.base);
    }

    return;
  }

  const token = canvas?.tokens?.get(tokenId);

  if (!token) {
    if (DEBUG) {
      console.warn(
        "[Idle Token Animation] Token not found.",
        { tokenId }
      );
    }

    return;
  }

  const target = getAnimationTarget(token);

  if (!target) {
    if (DEBUG) {
      console.warn(
        "[Idle Token Animation] No animation target.",
        {
          tokenId,
          token
        }
      );
    }

    return;
  }

  const base = snapshotBase(target);

  if (!base) {
    if (DEBUG) {
      console.warn(
        "[Idle Token Animation] Could not snapshot target.",
        {
          tokenId,
          target
        }
      );
    }

    return;
  }

  const profile = buildTokenProfile(
    tokenId,
    normalisedParams.randomPhase
  );

  const state = {
    tokenId,
    target,
    base,
    params: normalisedParams,
    profile,

    bobPhase: profile.bobPhase,
    swayPhase: profile.swayPhase,
    rollPhase: profile.rollPhase,

    t: 0,
    elapsedMs: 0,

    tremorPhaseX: profile.tremorPhaseX,
    tremorPhaseY: profile.tremorPhaseY,
    tremorPhaseRotation:
      profile.tremorPhaseRotation,

    twitchSequence: 0,
    nextTwitchAtMs: Infinity,
    twitch: null
  };

  resetConditionState(state);

  runtime.state.activeTokens.set(
    tokenId,
    state
  );

  if (!normalisedParams.animationEnabled) {
    restoreBase(target, base);
  }

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Token started.",
      {
        tokenId,
        tokenName: token.name,
        targetName: target.constructor?.name,
        base,
        params: state.params,
        profile: state.profile
      }
    );
  }
}

/**
 * Reset a token state's animated phases from its current motion profile.
 */
function resetTokenPhases(state) {
  state.bobPhase =
    state.profile.bobPhase;

  state.swayPhase =
    state.profile.swayPhase;

  state.rollPhase =
    state.profile.rollPhase;

  state.tremorPhaseX =
    state.profile.tremorPhaseX;

  state.tremorPhaseY =
    state.profile.tremorPhaseY;

  state.tremorPhaseRotation =
    state.profile.tremorPhaseRotation;
}

/**
 * Reset all transient condition-animation state.
 */
function resetConditionState(state) {
  state.twitchSequence = 0;
  state.twitch = null;
  state.nextTwitchAtMs = Infinity;

  if (
    state.params.animationEnabled &&
    state.params.twitchChancePerSecond > 0
  ) {
    scheduleNextTwitch(state);
  }
}

/**
 * Stop local animation for one token and restore captured pivot and rotation.
 */
export function stopToken(tokenId) {
  const runtime = globalThis[RUNTIME_KEY];

  const state =
    runtime?.state?.activeTokens?.get(tokenId);

  if (!state) return;

  if (
    state.target &&
    !state.target.destroyed
  ) {
    restoreBase(
      state.target,
      state.base
    );
  }

  runtime.state.activeTokens.delete(
    tokenId
  );

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Token stopped.",
      { tokenId }
    );
  }

  if (
    runtime.state.activeTokens.size === 0
  ) {
    stopTicker();
  }
}

/**
 * Stop every local animation and restore all captured pivots and rotations.
 */
export function stopAll() {
  const runtime = globalThis[RUNTIME_KEY];

  if (!runtime?.state?.activeTokens) {
    return;
  }

  for (
    const tokenId
    of Array.from(
      runtime.state.activeTokens.keys()
    )
  ) {
    stopToken(tokenId);
  }

  stopTicker();

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] All tokens stopped."
    );
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
 * - token x or y
 * - token.position
 * - scene embedded documents
 * - target.scale
 * - target.visible
 * - target.renderable
 * - target.alpha
 */
function tickAnimations() {
  const runtime = globalThis[RUNTIME_KEY];

  if (!runtime?.state?.activeTokens) {
    return;
  }

  const deltaMS = getSafeDeltaMS();
  const dt = Math.max(0, deltaMS) / 1000;

  if (
    runtime.state.activeTokens.size === 0
  ) {
    stopTicker();
    return;
  }

  for (
    const state
    of Array.from(
      runtime.state.activeTokens.values()
    )
  ) {
    if (
      globalThis.fxbusTokenOscillation
        ?.isActive?.(state.tokenId)
    ) {
      stopToken(state.tokenId);
      continue;
    }

    const token =
      canvas?.tokens?.get(state.tokenId);

    if (!token) {
      stopToken(state.tokenId);
      continue;
    }

    const target =
      getAnimationTarget(token);

    if (
      !target ||
      target !== state.target ||
      target.destroyed
    ) {
      stopToken(state.tokenId);
      continue;
    }

    state.t += dt;
    state.elapsedMs += deltaMS;

    const {
      base,
      params,
      profile
    } = state;

    /*
     * A still condition keeps the token in the active runtime so that it can
     * resume immediately after the next GM sync, but it performs no animated
     * displacement and continuously preserves the captured baseline.
     */
    if (!params.animationEnabled) {
      state.twitch = null;
      state.nextTwitchAtMs = Infinity;

      restoreBase(
        target,
        base
      );

      continue;
    }

    const speedDrift =
      getSpeedDriftMultiplier(state);

    const baseRate =
      TWO_PI *
      params.freqHz *
      profile.frequencyMultiplier *
      speedDrift;

    state.bobPhase = wrapPhase(
      state.bobPhase +
      (
        dt *
        baseRate *
        profile.bobFrequencyMultiplier
      )
    );

    state.swayPhase = wrapPhase(
      state.swayPhase +
      (
        dt *
        baseRate *
        profile.swayFrequencyMultiplier
      )
    );

    state.rollPhase = wrapPhase(
      state.rollPhase +
      (
        dt *
        baseRate *
        profile.rollFrequencyMultiplier
      )
    );

    const bob =
      params.bobPx *
      profile.bobAmplitudeMultiplier *
      Math.sin(state.bobPhase);

    const sway =
      params.swayPx *
      profile.swayAmplitudeMultiplier *
      Math.sin(state.swayPhase);

    const roll =
      params.rollRad *
      profile.rollAmplitudeMultiplier *
      Math.sin(state.rollPhase);

    const organicNoise =
      params.noise > 0
        ? noise1(profile, state.t) *
          params.noise
        : 0;

    const noiseX =
      organicNoise * JITTER_X;

    const noiseY =
      organicNoise * JITTER_Y;

    const noiseRotation =
      organicNoise * JITTER_ROT;

    const tremor =
      calculateTremor(state);

    const twitch =
      calculateTwitch(state);

    /*
     * Pivot offsets are inverted because moving the pivot moves the rendered
     * content in the opposite visual direction.
     *
     * This matches the safe FX Bus token oscillation principle while avoiding
     * scale, visibility, position, and document writes.
     */
    const pivotX =
      base.pivotX -
      (
        sway +
        noiseX +
        tremor.x +
        twitch.x
      );

    const pivotY =
      base.pivotY -
      (
        bob +
        noiseY +
        tremor.y +
        twitch.y
      );

    setTargetPivot(
      target,
      pivotX,
      pivotY
    );

    target.rotation =
      base.rotation +
      roll +
      noiseRotation +
      tremor.rotation +
      twitch.rotation;
  }
}

/**
 * Calculate the current deterministic condition tremor.
 *
 * Tremor is layered over normal idle motion. It uses fixed per-token phases
 * and different frequencies on each axis, avoiding perfectly circular or
 * synchronised vibration.
 */
function calculateTremor(state) {
  const {
    params,
    profile,
    t
  } = state;

  if (
    params.tremorPx <= 0 ||
    params.tremorFrequencyHz <= 0
  ) {
    return {
      x: 0,
      y: 0,
      rotation: 0
    };
  }

  const rate =
    TWO_PI *
    params.tremorFrequencyHz;

  const x =
    params.tremorPx *
    Math.sin(
      (
        t *
        rate *
        profile.tremorFrequencyMultiplierX
      ) +
      state.tremorPhaseX
    );

  const y =
    params.tremorPx *
    0.75 *
    Math.sin(
      (
        t *
        rate *
        profile.tremorFrequencyMultiplierY
      ) +
      state.tremorPhaseY
    );

  const rotation =
    params.tremorPx *
    TREMOR_ROTATION_FACTOR *
    Math.sin(
      (
        t *
        rate *
        profile.tremorFrequencyMultiplierRotation
      ) +
      state.tremorPhaseRotation
    );

  return {
    x,
    y,
    rotation
  };
}

/**
 * Calculate the current deterministic twitch impulse.
 *
 * Twitch events are scheduled from stable per-token hashed values. No random
 * value is generated every frame.
 */
function calculateTwitch(state) {
  const {
    params,
    elapsedMs
  } = state;

  if (
    params.twitchChancePerSecond <= 0 ||
    params.twitchDurationMs <= 0 ||
    (
      params.twitchDistancePx <= 0 &&
      params.twitchRotationRad <= 0
    )
  ) {
    state.twitch = null;
    state.nextTwitchAtMs = Infinity;

    return {
      x: 0,
      y: 0,
      rotation: 0
    };
  }

  if (
    !state.twitch &&
    !Number.isFinite(state.nextTwitchAtMs)
  ) {
    scheduleNextTwitch(state);
  }

  if (
    !state.twitch &&
    elapsedMs >= state.nextTwitchAtMs
  ) {
    beginTwitch(state);
  }

  if (!state.twitch) {
    return {
      x: 0,
      y: 0,
      rotation: 0
    };
  }

  const durationMs =
    Math.max(
      1,
      state.twitch.durationMs
    );

  const progress =
    clampNumber(
      (
        elapsedMs -
        state.twitch.startedAtMs
      ) /
      durationMs,
      0,
      1
    );

  if (progress >= 1) {
    state.twitch = null;
    scheduleNextTwitch(state);

    return {
      x: 0,
      y: 0,
      rotation: 0
    };
  }

  /*
   * A sine pulse moves rapidly away from zero during the first half and
   * returns smoothly during the second half without changing the baseline.
   */
  const pulse =
    Math.sin(progress * Math.PI);

  return {
    x:
      state.twitch.offsetX *
      pulse,

    y:
      state.twitch.offsetY *
      pulse,

    rotation:
      state.twitch.rotation *
      pulse
  };
}

/**
 * Begin one deterministic twitch event.
 */
function beginTwitch(state) {
  const {
    params,
    tokenId,
    twitchSequence
  } = state;

  const seed =
    buildConditionSeed(
      tokenId,
      params.conditionEffectId
    );

  const angle =
    randomRange(
      seed,
      `twitchAngle:${twitchSequence}`,
      0,
      TWO_PI
    );

  const distanceMultiplier =
    randomRange(
      seed,
      `twitchDistance:${twitchSequence}`,
      0.45,
      1
    );

  const rotationDirection =
    randomRange(
      seed,
      `twitchRotationDirection:${twitchSequence}`,
      0,
      1
    ) < 0.5
      ? -1
      : 1;

  const rotationMultiplier =
    randomRange(
      seed,
      `twitchRotationAmount:${twitchSequence}`,
      0.5,
      1
    );

  const durationMultiplier =
    randomRange(
      seed,
      `twitchDuration:${twitchSequence}`,
      0.75,
      1.25
    );

  const distance =
    params.twitchDistancePx *
    distanceMultiplier;

  state.twitch = {
    startedAtMs: state.elapsedMs,

    durationMs:
      params.twitchDurationMs *
      durationMultiplier,

    offsetX:
      Math.cos(angle) *
      distance,

    offsetY:
      Math.sin(angle) *
      distance,

    rotation:
      params.twitchRotationRad *
      rotationDirection *
      rotationMultiplier
  };
}

/**
 * Schedule the next deterministic twitch event.
 *
 * twitchChancePerSecond is interpreted as an average event rate. The resulting
 * interval varies per event but remains stable for the token and condition.
 */
function scheduleNextTwitch(state) {
  const chancePerSecond =
    state.params.twitchChancePerSecond;

  if (
    !state.params.animationEnabled ||
    chancePerSecond <= 0
  ) {
    state.nextTwitchAtMs = Infinity;
    return;
  }

  const seed =
    buildConditionSeed(
      state.tokenId,
      state.params.conditionEffectId
    );

  const sequence =
    state.twitchSequence++;

  const variation =
    randomRange(
      seed,
      `twitchInterval:${sequence}`,
      0.55,
      1.65
    );

  const averageIntervalMs =
    1000 / chancePerSecond;

  const intervalMs =
    clampNumber(
      averageIntervalMs * variation,
      MINIMUM_TWITCH_INTERVAL_MS,
      MAXIMUM_TWITCH_INTERVAL_MS
    );

  state.nextTwitchAtMs =
    state.elapsedMs +
    intervalMs;
}

/**
 * Build the deterministic seed used by condition animation.
 */
function buildConditionSeed(
  tokenId,
  conditionEffectId
) {
  return [
    canvas?.scene?.id ?? "scene",
    tokenId,
    conditionEffectId ?? "normal"
  ].join(":");
}

/**
 * Set the target pivot while supporting both PIXI Point variants.
 */
function setTargetPivot(
  target,
  pivotX,
  pivotY
) {
  if (target.pivot?.set) {
    target.pivot.set(
      pivotX,
      pivotY
    );

    return;
  }

  target.pivot.x = pivotX;
  target.pivot.y = pivotY;
}

/**
 * Ensure the local canvas ticker is running.
 */
function ensureTicker() {
  const runtime = globalThis[RUNTIME_KEY];

  if (!runtime?.state) return;
  if (runtime.state.ticker) return;
  if (!canvas?.app?.ticker) return;

  runtime.state.ticker =
    tickAnimations;

  canvas.app.ticker.add(
    runtime.state.ticker
  );

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Ticker started."
    );
  }
}

/**
 * Stop the local canvas ticker.
 */
function stopTicker() {
  const runtime = globalThis[RUNTIME_KEY];

  if (!runtime?.state?.ticker) {
    return;
  }

  if (canvas?.app?.ticker) {
    canvas.app.ticker.remove(
      runtime.state.ticker
    );
  }

  runtime.state.ticker = null;

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Ticker stopped."
    );
  }
}

/**
 * Resolve the render object to animate.
 *
 * Do not reparent.
 * Do not animate the Token root when mesh or icon exists.
 */
export function getAnimationTarget(token) {
  return token?.mesh ?? token?.icon ?? null;
}

/**
 * Snapshot baseline pivot and rotation only.
 */
function snapshotBase(target) {
  if (!target) return null;

  const pivotX =
    Number.isFinite(target.pivot?.x)
      ? target.pivot.x
      : 0;

  const pivotY =
    Number.isFinite(target.pivot?.y)
      ? target.pivot.y
      : 0;

  const rotation =
    Number.isFinite(target.rotation)
      ? target.rotation
      : 0;

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

  setTargetPivot(
    target,
    base.pivotX,
    base.pivotY
  );

  target.rotation =
    base.rotation;
}

/**
 * Convert a settings or socket payload into complete animation parameters.
 *
 * The GM has already applied condition multipliers to bob, sway, roll,
 * frequency, and noise. The client consumes those final effective values.
 */
function normaliseParams(params) {
  const rollDeg =
    finiteNumber(
      params?.rollDeg,
      0
    );

  const bobPx =
    finiteNonNegativeNumber(
      params?.bobPx,
      2
    );

  const swayPx =
    finiteNonNegativeNumber(
      params?.swayPx,
      2
    );

  const freqHz =
    finiteNonNegativeNumber(
      params?.freqHz,
      0.5
    );

  const noise =
    finiteNonNegativeNumber(
      params?.noise,
      0.01
    );

  const randomPhase =
    typeof params?.randomPhase === "boolean"
      ? params.randomPhase
      : true;

  const animationEnabled =
    params?.animationEnabled !== false &&
    params?.motionEnabled !== false;

  const conditionEffectId =
    String(
      params?.conditionEffectId ??
      "normal"
    )
      .trim()
      .toLowerCase() ||
    "normal";

  const tremorPx =
    finiteNonNegativeNumber(
      params?.tremorPx,
      0
    );

  const tremorFrequencyHz =
    finiteNonNegativeNumber(
      params?.tremorFrequencyHz,
      0
    );

  const twitchChancePerSecond =
    clampNumber(
      params?.twitchChancePerSecond ??
      params?.twitchChance,
      0,
      1,
      0
    );

  const twitchDistancePx =
    finiteNonNegativeNumber(
      params?.twitchDistancePx,
      0
    );

  const twitchRotationDeg =
    finiteNonNegativeNumber(
      params?.twitchRotationDeg,
      0
    );

  const twitchDurationMs =
    finiteNonNegativeNumber(
      params?.twitchDurationMs,
      0
    );

  return {
    amount:
      finiteNonNegativeNumber(
        params?.amount,
        1
      ),

    rollDeg,
    rollRad:
      degreesToRadians(rollDeg),

    bobPx,
    swayPx,

    freqHz:
      Math.max(
        0.01,
        freqHz
      ),

    noise:
      Math.max(
        0,
        Math.min(
          0.5,
          noise
        )
      ),

    randomPhase,

    conditionEffectId,
    animationEnabled,

    conditionAmountMultiplier:
      finiteNonNegativeNumber(
        params?.conditionAmountMultiplier,
        1
      ),

    conditionFrequencyMultiplier:
      finiteNonNegativeNumber(
        params?.conditionFrequencyMultiplier,
        1
      ),

    conditionBobMultiplier:
      finiteNonNegativeNumber(
        params?.conditionBobMultiplier,
        1
      ),

    conditionSwayMultiplier:
      finiteNonNegativeNumber(
        params?.conditionSwayMultiplier,
        1
      ),

    conditionRollMultiplier:
      finiteNonNegativeNumber(
        params?.conditionRollMultiplier,
        1
      ),

    conditionNoiseMultiplier:
      finiteNonNegativeNumber(
        params?.conditionNoiseMultiplier,
        1
      ),

    irregularity:
      finiteNonNegativeNumber(
        params?.irregularity,
        0
      ),

    tremorPx,
    tremorFrequencyHz,

    twitchChancePerSecond,
    twitchDistancePx,
    twitchRotationDeg,

    twitchRotationRad:
      degreesToRadians(
        twitchRotationDeg
      ),

    twitchDurationMs
  };
}

/**
 * Build a stable per-token motion profile.
 *
 * When desynchronisation is disabled:
 * - all ordinary motion multipliers are 1
 * - ordinary speed drift is disabled
 * - bob, sway, and roll use the previous simple relationship
 * - condition tremor still receives separate fixed axis phases
 *
 * When desynchronisation is enabled:
 * - each token receives stable deterministic variation
 * - speed gently accelerates and decelerates over time
 * - axes no longer share one obviously synchronised phase
 */
function buildTokenProfile(
  tokenId,
  randomPhase
) {
  const seed =
    `${canvas?.scene?.id ?? "scene"}:${tokenId}`;

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
      noiseHzC: 0.07,

      tremorPhaseX:
        randomRange(
          seed,
          "tremorPhaseX",
          0,
          TWO_PI
        ),

      tremorPhaseY:
        randomRange(
          seed,
          "tremorPhaseY",
          0,
          TWO_PI
        ),

      tremorPhaseRotation:
        randomRange(
          seed,
          "tremorPhaseRotation",
          0,
          TWO_PI
        ),

      tremorFrequencyMultiplierX: 1,
      tremorFrequencyMultiplierY: 1.17,
      tremorFrequencyMultiplierRotation: 0.83
    };
  }

  return {
    bobPhase:
      randomRange(
        seed,
        "bobPhase",
        0,
        TWO_PI
      ),

    swayPhase:
      randomRange(
        seed,
        "swayPhase",
        0,
        TWO_PI
      ),

    rollPhase:
      randomRange(
        seed,
        "rollPhase",
        0,
        TWO_PI
      ),

    bobAmplitudeMultiplier:
      randomRange(
        seed,
        "bobAmplitudeMultiplier",
        TOKEN_VARIATION.amplitudeMin,
        TOKEN_VARIATION.amplitudeMax
      ),

    swayAmplitudeMultiplier:
      randomRange(
        seed,
        "swayAmplitudeMultiplier",
        TOKEN_VARIATION.amplitudeMin,
        TOKEN_VARIATION.amplitudeMax
      ),

    rollAmplitudeMultiplier:
      randomRange(
        seed,
        "rollAmplitudeMultiplier",
        TOKEN_VARIATION.amplitudeMin,
        TOKEN_VARIATION.amplitudeMax
      ),

    frequencyMultiplier:
      randomRange(
        seed,
        "frequencyMultiplier",
        TOKEN_VARIATION.frequencyMin,
        TOKEN_VARIATION.frequencyMax
      ),

    bobFrequencyMultiplier:
      randomRange(
        seed,
        "bobFrequencyMultiplier",
        TOKEN_VARIATION.axisFrequencyMin,
        TOKEN_VARIATION.axisFrequencyMax
      ),

    swayFrequencyMultiplier:
      randomRange(
        seed,
        "swayFrequencyMultiplier",
        TOKEN_VARIATION.axisFrequencyMin,
        TOKEN_VARIATION.axisFrequencyMax
      ),

    rollFrequencyMultiplier:
      randomRange(
        seed,
        "rollFrequencyMultiplier",
        TOKEN_VARIATION.axisFrequencyMin,
        TOKEN_VARIATION.axisFrequencyMax
      ),

    speedDriftAmount:
      randomRange(
        seed,
        "speedDriftAmount",
        TOKEN_VARIATION.speedDriftAmountMin,
        TOKEN_VARIATION.speedDriftAmountMax
      ),

    speedDriftHz:
      randomRange(
        seed,
        "speedDriftHz",
        TOKEN_VARIATION.speedDriftHzMin,
        TOKEN_VARIATION.speedDriftHzMax
      ),

    speedDriftPhase:
      randomRange(
        seed,
        "speedDriftPhase",
        0,
        TWO_PI
      ),

    noisePhaseA:
      randomRange(
        seed,
        "noisePhaseA",
        0,
        TWO_PI
      ),

    noisePhaseB:
      randomRange(
        seed,
        "noisePhaseB",
        0,
        TWO_PI
      ),

    noisePhaseC:
      randomRange(
        seed,
        "noisePhaseC",
        0,
        TWO_PI
      ),

    noiseHzA:
      randomRange(
        seed,
        "noiseHzA",
        0.08,
        0.16
      ),

    noiseHzB:
      randomRange(
        seed,
        "noiseHzB",
        0.16,
        0.28
      ),

    noiseHzC:
      randomRange(
        seed,
        "noiseHzC",
        0.035,
        0.09
      ),

    tremorPhaseX:
      randomRange(
        seed,
        "tremorPhaseX",
        0,
        TWO_PI
      ),

    tremorPhaseY:
      randomRange(
        seed,
        "tremorPhaseY",
        0,
        TWO_PI
      ),

    tremorPhaseRotation:
      randomRange(
        seed,
        "tremorPhaseRotation",
        0,
        TWO_PI
      ),

    tremorFrequencyMultiplierX:
      randomRange(
        seed,
        "tremorFrequencyMultiplierX",
        0.92,
        1.08
      ),

    tremorFrequencyMultiplierY:
      randomRange(
        seed,
        "tremorFrequencyMultiplierY",
        1.08,
        1.28
      ),

    tremorFrequencyMultiplierRotation:
      randomRange(
        seed,
        "tremorFrequencyMultiplierRotation",
        0.76,
        0.94
      )
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

  if (
    !profile.speedDriftAmount ||
    !profile.speedDriftHz
  ) {
    return 1;
  }

  return 1 + (
    Math.sin(
      (
        state.t *
        profile.speedDriftHz *
        TWO_PI
      ) +
      profile.speedDriftPhase
    ) *
    profile.speedDriftAmount
  );
}

/**
 * Get a safe ticker delta in milliseconds.
 */
function getSafeDeltaMS() {
  const deltaMS =
    Number(
      canvas?.app?.ticker?.deltaMS
    );

  if (
    Number.isFinite(deltaMS) &&
    deltaMS > 0 &&
    deltaMS < 1000
  ) {
    return deltaMS;
  }

  return 1000 / 60;
}

/**
 * Deterministic smooth pseudo-noise in [-1, 1].
 *
 * This remains deliberately slow. It should read as organic irregularity
 * rather than twitching or frame jitter.
 */
function noise1(profile, tSeconds) {
  const a =
    Math.sin(
      (
        tSeconds *
        profile.noiseHzA *
        TWO_PI
      ) +
      profile.noisePhaseA
    );

  const b =
    Math.sin(
      (
        tSeconds *
        profile.noiseHzB *
        TWO_PI
      ) +
      profile.noisePhaseB
    );

  const c =
    Math.sin(
      (
        tSeconds *
        profile.noiseHzC *
        TWO_PI
      ) +
      profile.noisePhaseC
    );

  return (
    (
      1.0 * a +
      0.6 * b +
      0.3 * c
    ) /
    1.9
  );
}

/**
 * Keep a phase in a small stable range.
 */
function wrapPhase(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (
    value >= TWO_PI ||
    value <= -TWO_PI
  ) {
    return value % TWO_PI;
  }

  return value;
}

/**
 * Return a deterministic pseudo-random number in a range.
 */
function randomRange(
  seed,
  salt,
  minimum,
  maximum
) {
  return minimum + (
    (
      maximum -
      minimum
    ) *
    hashStringToUnit(
      `${seed}:${salt}`
    )
  );
}

/**
 * FNV-1a 32-bit hash converted to the unit interval.
 */
function hashStringToUnit(str) {
  let hash = 0x811c9dc5;

  for (
    let index = 0;
    index < str.length;
    index++
  ) {
    hash ^= str.charCodeAt(index);

    hash = Math.imul(
      hash,
      0x01000193
    );
  }

  return (
    hash >>> 0
  ) / (
    2 ** 32
  );
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
function finiteNonNegativeNumber(
  value,
  fallback
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(
    0,
    number
  );
}

/**
 * Return a finite number constrained to the supplied range.
 */
function clampNumber(
  value,
  minimum,
  maximum,
  fallback = minimum
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