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
  game.socket.on(SOCKET_NAME, handleSocketMessage);

  if (DEBUG) {
    console.log("[Idle Token Animation] Socket registered.", { socketName: SOCKET_NAME });
  }
}

/**
 * Request a GM-authoritative eligibility sync.
 *
 * Behaviour:
 * - GM caller: builds and broadcasts sync to all clients.
 * - Player caller: asks the GM to build and broadcast sync to all clients.
 *
 * Options:
 * - delayed: also repeats the sync request after short delays. Use this after
 *   token flag writes, because other clients may not have received the document
 *   update at the exact moment the local setFlag promise resolves.
 */
export function requestSync(options = {}) {
  const delayed = typeof options === "object" && options?.delayed === true;

  requestSyncOnce();

  if (!delayed) return;

  for (const delayMs of DELAYED_SYNC_MS) {
    window.setTimeout(() => {
      requestSyncOnce();
    }, delayMs);
  }
}

/**
 * Perform one sync request.
 */
function requestSyncOnce() {
  if (!game.ready) return;
  if (!canvas?.scene) return;

  if (game.user?.isGM) {
    broadcastSync("gmRequest");
    return;
  }

  game.socket.emit(SOCKET_NAME, {
    action: "idleTokenAnimation.requestSync",
    sceneId: canvas.scene.id,
    requesterUserId: game.user.id
  });

  if (DEBUG) {
    console.log("[Idle Token Animation] Sync requested from GM.", {
      sceneId: canvas.scene.id,
      requesterUserId: game.user.id
    });
  }
}

/**
 * Handle incoming socket messages.
 */
function handleSocketMessage(message) {
  if (!message || typeof message !== "object") return;

  if (message.action === "idleTokenAnimation.requestSync") {
    if (!game.user?.isGM) return;
    if (message.sceneId !== canvas.scene?.id) return;

    broadcastSync("playerRequest", message.requesterUserId);
    return;
  }

  if (message.action === "idleTokenAnimation.sync") {
    applySyncMessage(message);
  }
}

/**
 * Build and broadcast the current token eligibility state.
 *
 * The GM sends:
 * - tokenIds for active animation state
 * - global params
 * - per-token params for placed-token motion overrides
 *
 * Players never author the final animation state. A player request only asks
 * the GM to produce and broadcast the authoritative sync message.
 */
function broadcastSync(reason = "unknown", requesterUserId = null) {
  if (!game.user?.isGM) return;
  if (!canvas?.scene) return;

  const enabled = Boolean(game.settings.get(MODULE_ID, "enabled"));
  const globalParams = buildAnimationParamsFromSettings();

  const eligibleTokens = enabled && globalParams.amount > 0
    ? getEligibleTokens()
    : [];

  const tokenIds = eligibleTokens.map((token) => token.id);
  const tokenParams = {};

  for (const token of eligibleTokens) {
    tokenParams[token.id] = buildAnimationParamsForToken(token, globalParams);
  }

  const message = {
    action: "idleTokenAnimation.sync",
    sceneId: canvas.scene.id,
    tokenIds,
    params: globalParams,
    tokenParams
  };

  if (DEBUG) {
    console.log("[Idle Token Animation] Sync broadcast.", {
      reason,
      requesterUserId,
      enabled,
      sceneId: canvas.scene.id,
      eligibleTokenIds: tokenIds,
      params: globalParams,
      tokenParams
    });
  }

  game.socket.emit(SOCKET_NAME, message);
  applySyncMessage(message);
}