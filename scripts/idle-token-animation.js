// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\idle-token-animation.js

/**
 * Idle Token Animation
 *
 * Entry point.
 *
 * Core guarantees:
 * - Does not move TokenDocuments.
 * - Does not update token x or y.
 * - Does not affect attacks, ranges, targeting, walls, automation, or grid position.
 * - Animation is render-only and client-local.
 * - GM determines eligibility and broadcasts sync state.
 */

import { initialiseRuntime } from "./runtime.js";
import { registerSettings } from "./settings.js";
import { registerSocket, requestSync } from "./socket.js";
import { registerHooks } from "./hooks.js";

Hooks.once("init", () => {
  initialiseRuntime();
  registerSettings();
  registerSocket();
});

Hooks.once("ready", () => {
  registerHooks();

  /**
   * Large comment:
   * Every client requests sync when ready.
   *
   * - If this user is the GM, requestSync broadcasts immediately.
   * - If this user is a player, requestSync asks the GM to broadcast.
   *
   * Later scene changes are handled by hooks.js via canvasReady.
   */
  requestSync();

  window.setTimeout(() => {
    requestSync();
  }, 1000);
});