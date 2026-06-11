// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\runtime.js

import { MODULE_ID, RUNTIME_KEY } from "./constants.js";
import { requestSync } from "./socket.js";
import { stopAll, stopToken } from "./animation.js";
import {
  clearTokenMotionOverride,
  getTokenMotionOverride,
  setTokenMotionOverride
} from "./overrides.js";

/**
 * Create the public runtime object.
 *
 * Exposes:
 * globalThis.idleTokenAnimation
 *
 * Public API:
 * - requestSync()
 * - stopToken(tokenId)
 * - stopAll()
 * - getTokenMotionOverride(tokenOrDocument)
 * - setTokenMotionOverride(tokenOrDocument, override)
 * - clearTokenMotionOverride(tokenOrDocument)
 */
export function initialiseRuntime() {
  const runtime = {
    moduleId: MODULE_ID,
    api: {
      requestSync,
      stopToken,
      stopAll,
      getTokenMotionOverride,
      setTokenMotionOverride,
      clearTokenMotionOverride
    },
    state: {
      activeTokens: new Map(),
      ticker: null
    }
  };

  globalThis[RUNTIME_KEY] = runtime;
}

/**
 * Return the module runtime.
 */
export function getRuntime() {
  return globalThis[RUNTIME_KEY];
}