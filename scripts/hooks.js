// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\hooks.js

import { requestSync } from "./socket.js";
import { stopAll, stopToken } from "./animation.js";
import { registerTokenConfigHooks } from "./tokenConfig.js";

const CONDITION_SYNC_DEBOUNCE_MS = 100;

const PF2E_CONDITION_RELEVANT_ITEM_TYPES = new Set([
  "condition",
  "effect",
  "affliction"
]);

let conditionSyncTimeout = null;

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
 *
 * Condition integration:
 * - D&D 5e and similar systems use Active Effect hooks
 * - PF2e uses embedded condition, effect, and affliction Items
 * - only actors represented on the current canvas trigger synchronisation
 * - bursts of condition changes are debounced into one sync request
 */
export function registerHooks() {
  registerTokenConfigHooks();

  Hooks.on("canvasTearDown", () => {
    clearConditionSyncTimeout();
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

  Hooks.on("updateActor", (actor, changes) => {
    if (!actorHasTokenOnCurrentCanvas(actor)) {
      return;
    }

    /*
     * Embedded Active Effect and Item hooks handle their own condition
     * changes. Ignore actor updates that contain only embedded-document
     * bookkeeping to avoid duplicate synchronisation bursts.
     *
     * Ordinary actor changes remain relevant because they may alter:
     * - HP eligibility
     * - prototype-token flags
     * - system-specific prepared conditions
     * - other animation eligibility data
     */
    if (isOnlyEmbeddedDocumentActorUpdate(changes)) {
      return;
    }

    resyncNowAndSoon();
  });

  /*
   * Active Effect conditions.
   *
   * Used by D&D 5e and other systems that represent statuses through Foundry
   * Active Effects.
   */
  Hooks.on("createActiveEffect", (effect) => {
    if (!shouldSyncForActiveEffect(effect)) {
      return;
    }

    scheduleConditionSync();
  });

  Hooks.on(
    "updateActiveEffect",
    (effect, changes) => {
      if (!shouldSyncForActiveEffect(effect)) {
        return;
      }

      if (
        !activeEffectUpdateCanChangeCondition(
          changes
        )
      ) {
        return;
      }

      scheduleConditionSync();
    }
  );

  Hooks.on("deleteActiveEffect", (effect) => {
    if (!shouldSyncForActiveEffect(effect)) {
      return;
    }

    scheduleConditionSync();
  });

  /*
   * PF2e condition Items.
   *
   * PF2e represents stored conditions as embedded Items and exposes the
   * prepared result through actor.conditions.
   *
   * Effects and afflictions are included because they may indirectly add,
   * suppress, or alter prepared PF2e conditions.
   */
  Hooks.on("createItem", (item) => {
    if (!shouldSyncForPf2eItem(item)) {
      return;
    }

    scheduleConditionSync();
  });

  Hooks.on("updateItem", (item) => {
    if (!shouldSyncForPf2eItem(item)) {
      return;
    }

    /*
     * All updates to PF2e condition-relevant Item types are accepted.
     *
     * PF2e may derive prepared condition state from several Item fields and
     * rule elements. Filtering individual update paths here would risk missing
     * legitimate condition changes.
     */
    scheduleConditionSync();
  });

  Hooks.on("deleteItem", (item) => {
    if (!shouldSyncForPf2eItem(item)) {
      return;
    }

    scheduleConditionSync();
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

  Hooks.on(
    "fxbusTokenOscillationWillStart",
    ({ tokenId }) => {
      stopToken(tokenId);
    }
  );

  Hooks.on(
    "fxbusTokenOscillationStopped",
    () => {
      resyncNowAndSoon();
    }
  );
}

/**
 * Determine whether an Active Effect can affect animation on the current
 * canvas.
 *
 * An effect is relevant only when:
 * - its parent is an Actor
 * - that actor is represented on the current canvas
 * - the effect contains status metadata
 */
function shouldSyncForActiveEffect(effect) {
  const actor =
    getEmbeddedDocumentActor(effect);

  if (!actor) {
    return false;
  }

  if (!actorHasTokenOnCurrentCanvas(actor)) {
    return false;
  }

  return activeEffectHasStatusMetadata(effect);
}

/**
 * Determine whether a PF2e embedded Item may alter prepared conditions.
 *
 * Relevant Item types:
 * - condition
 * - effect
 * - affliction
 */
function shouldSyncForPf2eItem(item) {
  if (game.system.id !== "pf2e") {
    return false;
  }

  if (!item) {
    return false;
  }

  const itemType =
    normaliseIdentifier(item.type);

  if (
    !PF2E_CONDITION_RELEVANT_ITEM_TYPES.has(
      itemType
    )
  ) {
    return false;
  }

  const actor =
    getEmbeddedDocumentActor(item);

  if (!actor) {
    return false;
  }

  return actorHasTokenOnCurrentCanvas(actor);
}

/**
 * Resolve the actor owning an embedded document.
 *
 * Supports Active Effects and actor-owned Items.
 */
function getEmbeddedDocumentActor(document) {
  const parent = document?.parent;

  if (!parent) {
    return null;
  }

  if (parent.documentName === "Actor") {
    return parent;
  }

  if (parent.constructor?.name === "Actor") {
    return parent;
  }

  return null;
}

/**
 * Return whether an actor is represented on the current canvas.
 *
 * Supports:
 * - linked actors
 * - unlinked synthetic token actors
 * - actor identity by object reference, UUID, or actor id
 */
function actorHasTokenOnCurrentCanvas(actor) {
  if (!actor || !canvas?.scene) {
    return false;
  }

  for (
    const token
    of canvas.tokens?.placeables ?? []
  ) {
    const tokenActor = token?.actor;

    if (!tokenActor) {
      continue;
    }

    if (tokenActor === actor) {
      return true;
    }

    if (
      actor.uuid &&
      tokenActor.uuid === actor.uuid
    ) {
      return true;
    }

    if (
      actor.id &&
      token.document?.actorId === actor.id
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Return whether an Active Effect contains status metadata.
 *
 * The generic condition resolver reads:
 * - effect.statuses
 * - flags.core.statusId
 *
 * Effects without either value cannot change the neutral condition effect.
 */
function activeEffectHasStatusMetadata(effect) {
  if (!effect) {
    return false;
  }

  const statuses = effect.statuses;

  if (
    typeof statuses === "string" &&
    statuses.trim()
  ) {
    return true;
  }

  if (
    statuses &&
    typeof statuses[Symbol.iterator] ===
      "function"
  ) {
    for (const statusId of statuses) {
      if (
        String(statusId ?? "").trim()
      ) {
        return true;
      }
    }
  }

  const coreStatusId =
    effect.getFlag?.(
      "core",
      "statusId"
    ) ??
    foundry.utils.getProperty(
      effect,
      "flags.core.statusId"
    );

  return Boolean(
    String(coreStatusId ?? "").trim()
  );
}

/**
 * Determine whether an Active Effect update can change condition resolution.
 *
 * Relevant changes include:
 * - enabling or disabling an effect
 * - changing its status identifiers
 * - changing the legacy core status id
 * - changing suppression state
 *
 * Cosmetic changes such as name, icon, description, sort order, and timestamps
 * do not trigger synchronisation.
 */
function activeEffectUpdateCanChangeCondition(
  changes
) {
  if (
    !changes ||
    typeof changes !== "object"
  ) {
    return false;
  }

  const flattenedChanges =
    foundry.utils.flattenObject(changes);

  const relevantPaths = [
    "disabled",
    "isSuppressed",
    "statuses",
    "flags.core.statusId"
  ];

  return Object.keys(
    flattenedChanges
  ).some(
    (path) =>
      relevantPaths.some(
        (relevantPath) =>
          path === relevantPath ||
          path.startsWith(
            `${relevantPath}.`
          )
      )
  );
}

/**
 * Detect actor updates caused solely by embedded-document bookkeeping.
 *
 * Active Effect and Item hooks already schedule condition synchronisation.
 * Ignoring these actor updates prevents duplicate requests while preserving
 * ordinary actor changes such as HP and system-data updates.
 */
function isOnlyEmbeddedDocumentActorUpdate(
  changes
) {
  if (
    !changes ||
    typeof changes !== "object"
  ) {
    return false;
  }

  const paths = Object.keys(
    foundry.utils.flattenObject(changes)
  );

  if (paths.length === 0) {
    return false;
  }

  return paths.every(
    (path) =>
      path === "effects" ||
      path.startsWith("effects.") ||
      path === "items" ||
      path.startsWith("items.")
  );
}

/**
 * Debounce condition changes into one delayed authoritative sync.
 *
 * Automation and game systems may create, update, and delete several embedded
 * documents during one action. Restarting this timer collapses that burst into
 * one synchronisation request.
 *
 * requestSync({ delayed: true }) performs the immediate synchronisation and
 * the existing delayed consistency passes.
 */
function scheduleConditionSync() {
  clearConditionSyncTimeout();

  conditionSyncTimeout =
    window.setTimeout(() => {
      conditionSyncTimeout = null;

      requestSync({
        delayed: true
      });
    }, CONDITION_SYNC_DEBOUNCE_MS);
}

/**
 * Clear a pending condition synchronisation timer.
 */
function clearConditionSyncTimeout() {
  if (conditionSyncTimeout === null) {
    return;
  }

  window.clearTimeout(
    conditionSyncTimeout
  );

  conditionSyncTimeout = null;
}

/**
 * Request synchronisation immediately and again after the canvas has settled.
 *
 * Foundry scene changes can fire lifecycle hooks before every token render
 * target is fully ready. The delayed passes catch the stable state.
 */
function resyncNowAndSoon() {
  requestSync({
    delayed: true
  });
}

/**
 * Convert an arbitrary identifier into a stable lowercase key.
 */
function normaliseIdentifier(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}