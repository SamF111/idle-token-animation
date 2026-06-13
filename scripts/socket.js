// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\socket.js

import { MODULE_ID, SOCKET_NAME } from "./constants.js";
import { buildAnimationParamsFromSettings } from "./settings.js";
import { getEligibleTokens } from "./eligibility.js";
import { buildAnimationParamsForToken } from "./overrides.js";
import { applySyncMessage } from "./animation.js";

const DEBUG = true;

const DELAYED_SYNC_MS = [
  250,
  1000
];

/**
 * Register the module socket listener.
 */
export function registerSocket() {
  game.socket.on(
    SOCKET_NAME,
    handleSocketMessage
  );

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Socket registered.",
      {
        socketName: SOCKET_NAME
      }
    );
  }
}

/**
 * Request a GM-authoritative animation-state synchronisation.
 *
 * Behaviour:
 * - GM caller: builds and broadcasts the authoritative state.
 * - Player caller: asks the GM to build and broadcast the state.
 *
 * The authoritative state includes:
 * - eligible token ids
 * - global animation parameters
 * - final per-token animation parameters
 * - GM-resolved neutral condition effects
 *
 * Options:
 * - delayed: repeat the request after short delays
 *
 * Delayed requests are useful after token flag writes because other clients
 * may not yet have received the document update when the local promise
 * resolves.
 */
export function requestSync(options = {}) {
  const delayed =
    typeof options === "object" &&
    options?.delayed === true;

  requestSyncOnce();

  if (!delayed) {
    return;
  }

  for (const delayMs of DELAYED_SYNC_MS) {
    window.setTimeout(() => {
      requestSyncOnce();
    }, delayMs);
  }
}

/**
 * Perform one synchronisation request.
 */
function requestSyncOnce() {
  if (!game.ready) {
    return;
  }

  if (!canvas?.scene) {
    return;
  }

  if (game.user?.isGM) {
    broadcastSync("gmRequest");
    return;
  }

  const message = {
    action: "idleTokenAnimation.requestSync",
    sceneId: canvas.scene.id,
    requesterUserId: game.user.id
  };

  game.socket.emit(
    SOCKET_NAME,
    message
  );

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Sync requested from GM.",
      {
        sceneId: message.sceneId,
        requesterUserId: message.requesterUserId
      }
    );
  }
}

/**
 * Handle an incoming module socket message.
 */
function handleSocketMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (
    message.action ===
    "idleTokenAnimation.requestSync"
  ) {
    handleSyncRequest(message);
    return;
  }

  if (
    message.action ===
    "idleTokenAnimation.sync"
  ) {
    applySyncMessage(message);
  }
}

/**
 * Handle a player's request for an authoritative state sync.
 */
function handleSyncRequest(message) {
  if (!game.user?.isGM) {
    return;
  }

  if (
    message.sceneId !== canvas.scene?.id
  ) {
    return;
  }

  broadcastSync(
    "playerRequest",
    message.requesterUserId
  );
}

/**
 * Build and broadcast the current authoritative animation state.
 *
 * The GM determines:
 * - whether the module is enabled
 * - which tokens are eligible
 * - the current global motion parameters
 * - placed-token motion overrides
 * - active condition effects
 * - final effective parameters for each token
 *
 * `buildAnimationParamsForToken()` performs both placed-token override
 * resolution and neutral condition-effect resolution. Clients receive only
 * the final serialisable parameters and do not inspect actor conditions.
 *
 * Players never author the final animation state. A player request only asks
 * the GM to produce and broadcast a fresh authoritative message.
 */
function broadcastSync(
  reason = "unknown",
  requesterUserId = null
) {
  if (!game.user?.isGM) {
    return;
  }

  if (!canvas?.scene) {
    return;
  }

  const enabled = Boolean(
    game.settings.get(
      MODULE_ID,
      "enabled"
    )
  );

  const globalParams =
    buildAnimationParamsFromSettings();

  const eligibleTokens =
    enabled && globalParams.amount > 0
      ? getEligibleTokens()
      : [];

  const tokenIds = [];
  const tokenParams = {};

  for (const token of eligibleTokens) {
    const tokenId = token?.id;

    if (!tokenId) {
      continue;
    }

    tokenIds.push(tokenId);

    /*
     * This is resolved exclusively by the GM.
     *
     * The returned object includes:
     * - global or overridden base motion
     * - conditionEffectId
     * - animationEnabled
     * - condition-adjusted bob, sway, roll, frequency, and noise
     * - tremor parameters
     * - twitch parameters
     */
    tokenParams[tokenId] =
      buildAnimationParamsForToken(
        token,
        globalParams
      );
  }

  const message = {
    action: "idleTokenAnimation.sync",
    sceneId: canvas.scene.id,
    tokenIds,
    params: globalParams,
    tokenParams
  };

  if (DEBUG) {
    console.log(
      "[Idle Token Animation] Sync broadcast.",
      {
        reason,
        requesterUserId,
        enabled,
        sceneId: message.sceneId,
        eligibleTokenIds: tokenIds,
        params: globalParams,
        tokenParams,
        conditionEffects:
          buildConditionEffectDebugData(
            tokenParams
          )
      }
    );
  }

  game.socket.emit(
    SOCKET_NAME,
    message
  );

  /*
   * Socket emission does not return the message to the sending client.
   * Apply the same authoritative payload directly on the GM client.
   */
  applySyncMessage(message);
}

/**
 * Build concise condition information for debug logging.
 *
 * This information is not included as a separate socket field because the
 * resolved condition data already exists inside tokenParams.
 */
function buildConditionEffectDebugData(
  tokenParams
) {
  const conditionEffects = {};

  for (
    const [tokenId, params]
    of Object.entries(tokenParams)
  ) {
    conditionEffects[tokenId] = {
      conditionEffectId:
        params?.conditionEffectId ??
        "normal",

      animationEnabled:
        params?.animationEnabled !== false,

      tremorPx:
        Number(params?.tremorPx) || 0,

      twitchChancePerSecond:
        Number(
          params?.twitchChancePerSecond
        ) || 0
    };
  }

  return conditionEffects;
}