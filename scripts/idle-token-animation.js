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
import { registerDnd5eConditionResolver } from "./dnd5eConditionResolver.js";
import { registerPf2eConditionResolver } from "./pf2eConditionResolver.js";

Hooks.once("init", () => {
  initialiseRuntime();
  registerSettings();
  registerSocket();

  switch (game.system.id) {
    case "dnd5e":
      registerDnd5eConditionResolver();
      break;

    case "pf2e":
      registerPf2eConditionResolver();
      break;
  }
});

Hooks.once("ready", () => {
  registerHooks();

  /**
   * Every client requests sync when ready.
   *
   * - If this user is the GM, requestSync broadcasts immediately.
   * - If this user is a player, requestSync asks the GM to broadcast.
   *
   * Later scene changes are handled by hooks.js through canvasReady.
   */
  requestSync();

  window.setTimeout(() => {
    requestSync();
  }, 1000);
});