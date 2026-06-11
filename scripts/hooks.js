// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\hooks.js

import { requestSync } from "./socket.js";
import { stopAll, stopToken } from "./animation.js";
import { registerTokenConfigHooks } from "./tokenConfig.js";

/**
 * Register Foundry and compatibility hooks.
 *
 * Scene changes must:
 * - restore old-scene render offsets
 * - wait for the new canvas/token render objects to exist
 * - request a fresh GM eligibility sync
 *
 * Token Configuration integration:
 * - adds the Idle Animation tab to placed-token configuration windows
 * - edits only placed-token flags
 */
export function registerHooks() {
  registerTokenConfigHooks();

  Hooks.on("canvasTearDown", () => {
    stopAll();
  });

  Hooks.on("canvasReady", () => {
    resyncNowAndSoon();
  });

  Hooks.on("deleteToken", () => {
    resyncNowAndSoon();
  });

  Hooks.on("updateToken", () => {
    resyncNowAndSoon();
  });

  Hooks.on("createToken", () => {
    resyncNowAndSoon();
  });

  Hooks.on("updateActor", () => {
    resyncNowAndSoon();
  });

  Hooks.on("combatStart", () => {
    resyncNowAndSoon();
  });

  Hooks.on("combatRound", () => {
    resyncNowAndSoon();
  });

  Hooks.on("combatTurn", () => {
    resyncNowAndSoon();
  });

  Hooks.on("deleteCombat", () => {
    resyncNowAndSoon();
  });

  Hooks.on("fxbusTokenOscillationWillStart", ({ tokenId }) => {
    stopToken(tokenId);
  });

  Hooks.on("fxbusTokenOscillationStopped", () => {
    resyncNowAndSoon();
  });
}

/**
 * Request sync immediately and again after the canvas has settled.
 *
 * Foundry scene changes can fire lifecycle hooks before every token render
 * target is fully ready. The delayed pass catches the stable state.
 */
function resyncNowAndSoon() {
  requestSync();

  window.setTimeout(() => {
    requestSync();
  }, 250);

  window.setTimeout(() => {
    requestSync();
  }, 1000);
}