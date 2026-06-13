// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\conditionResolver.js

import {
  CONDITION_EFFECT_IDS,
  getConditionEffect,
  isConditionEffectId
} from "./conditionEffects.js";

/**
 * Resolve active game-system conditions into neutral animation effects.
 *
 * Responsibilities:
 * - collect active Foundry status identifiers from a token's actor
 * - delegate interpretation to the current game-system resolver
 * - provide the full actor to adapters with native condition structures
 * - validate the resolver's neutral effect identifier
 * - fall back safely to normal idle animation
 *
 * D&D 5e adapters primarily use statusIds.
 * PF2e adapters use actor.conditions.
 *
 * This file does not:
 * - define condition animation behaviour
 * - contain game-system condition names
 * - modify actors, tokens, Active Effects, Items, or render objects
 * - inspect hit points
 * - decide token eligibility
 *
 * Game-system-specific mappings must be registered separately.
 */

const SYSTEM_RESOLVERS = new Map();

/**
 * Register a condition resolver for one Foundry game system.
 *
 * The resolver receives:
 *
 * {
 *   systemId,
 *   token,
 *   actor,
 *   statusIds
 * }
 *
 * The actor is supplied so system adapters can use native prepared structures,
 * such as PF2e's actor.conditions collection.
 *
 * The resolver must return:
 * - a registered neutral condition-effect identifier
 * - null
 * - undefined
 *
 * Returning null or undefined preserves normal idle animation.
 */
export function registerSystemConditionResolver(
  systemId,
  resolver
) {
  const normalisedSystemId =
    normaliseIdentifier(systemId);

  if (!normalisedSystemId) {
    throw new Error(
      "[Idle Token Animation] Cannot register a condition resolver without a system id."
    );
  }

  if (typeof resolver !== "function") {
    throw new TypeError(
      `[Idle Token Animation] Condition resolver for "${normalisedSystemId}" must be a function.`
    );
  }

  SYSTEM_RESOLVERS.set(
    normalisedSystemId,
    resolver
  );
}

/**
 * Remove a previously registered game-system condition resolver.
 *
 * Returns true when a resolver was removed.
 */
export function unregisterSystemConditionResolver(
  systemId
) {
  const normalisedSystemId =
    normaliseIdentifier(systemId);

  if (!normalisedSystemId) {
    return false;
  }

  return SYSTEM_RESOLVERS.delete(
    normalisedSystemId
  );
}

/**
 * Return whether the specified game system has a registered resolver.
 */
export function hasSystemConditionResolver(
  systemId
) {
  const normalisedSystemId =
    normaliseIdentifier(systemId);

  if (!normalisedSystemId) {
    return false;
  }

  return SYSTEM_RESOLVERS.has(
    normalisedSystemId
  );
}

/**
 * Resolve the neutral condition effect for a token.
 *
 * Unsupported systems and tokens without recognised conditions receive the
 * normal effect. Resolver failures are contained and also fall back to normal.
 */
export function resolveConditionEffect(token) {
  const effectId =
    resolveConditionEffectId(token);

  return getConditionEffect(effectId);
}

/**
 * Resolve only the neutral condition-effect identifier for a token.
 *
 * This is useful when building socket payloads that should contain serialisable
 * data rather than references to frozen registry objects.
 */
export function resolveConditionEffectId(token) {
  const actor =
    token?.actor ??
    token?.document?.actor ??
    null;

  if (!actor) {
    return CONDITION_EFFECT_IDS.NORMAL;
  }

  const systemId =
    normaliseIdentifier(
      globalThis.game?.system?.id
    );

  const resolver =
    SYSTEM_RESOLVERS.get(systemId);

  if (!resolver) {
    return CONDITION_EFFECT_IDS.NORMAL;
  }

  const statusIds =
    getActiveStatusIds(token);

  try {
    const resolvedEffectId =
      resolver({
        systemId,
        token,
        actor,
        statusIds
      });

    if (!resolvedEffectId) {
      return CONDITION_EFFECT_IDS.NORMAL;
    }

    if (!isConditionEffectId(resolvedEffectId)) {
      console.warn(
        `[Idle Token Animation] Condition resolver for "${systemId}" returned unknown effect "${String(
          resolvedEffectId
        )}". Using normal motion.`
      );

      return CONDITION_EFFECT_IDS.NORMAL;
    }

    return normaliseIdentifier(
      resolvedEffectId
    );
  } catch (error) {
    console.error(
      `[Idle Token Animation] Condition resolver for "${systemId}" failed. Using normal motion.`,
      error
    );

    return CONDITION_EFFECT_IDS.NORMAL;
  }
}

/**
 * Collect normalised active Foundry status identifiers for a token.
 *
 * Foundry normally exposes consolidated statuses through actor.statuses.
 * Active Effect statuses are also inspected as a defensive fallback.
 *
 * PF2e adapters do not depend on this collection. They read the prepared
 * actor.conditions collection from the actor supplied to the resolver.
 *
 * The returned Set is newly created and may be safely read by a resolver.
 */
export function getActiveStatusIds(token) {
  const actor =
    token?.actor ??
    token?.document?.actor ??
    null;

  const statusIds = new Set();

  if (!actor) {
    return statusIds;
  }

  addStatusCollection(
    statusIds,
    actor.statuses
  );

  for (const effect of actor.effects ?? []) {
    if (!isEffectActive(effect)) {
      continue;
    }

    addStatusCollection(
      statusIds,
      effect.statuses
    );

    const coreStatusId =
      effect.getFlag?.(
        "core",
        "statusId"
      );

    addStatusId(
      statusIds,
      coreStatusId
    );
  }

  return statusIds;
}

/**
 * Return a serialisable snapshot of the token's active Foundry status
 * identifiers.
 *
 * PF2e conditions may not appear here because they are exposed through
 * actor.conditions rather than ordinary Active Effect statuses.
 */
export function getActiveStatusIdList(token) {
  return Array.from(
    getActiveStatusIds(token)
  ).sort();
}

/**
 * Remove all registered system resolvers.
 *
 * Intended for testing and module teardown.
 */
export function clearSystemConditionResolvers() {
  SYSTEM_RESOLVERS.clear();
}

/**
 * Add every valid identifier from an iterable status collection.
 */
function addStatusCollection(
  target,
  statuses
) {
  if (!statuses) {
    return;
  }

  if (typeof statuses === "string") {
    addStatusId(
      target,
      statuses
    );

    return;
  }

  if (
    typeof statuses[Symbol.iterator] !==
    "function"
  ) {
    return;
  }

  for (const statusId of statuses) {
    addStatusId(
      target,
      statusId
    );
  }
}

/**
 * Add one normalised status identifier to a Set.
 */
function addStatusId(
  target,
  statusId
) {
  const normalisedStatusId =
    normaliseIdentifier(statusId);

  if (normalisedStatusId) {
    target.add(
      normalisedStatusId
    );
  }
}

/**
 * Determine whether an Active Effect should contribute statuses.
 */
function isEffectActive(effect) {
  if (!effect) {
    return false;
  }

  if (effect.disabled === true) {
    return false;
  }

  if (effect.isSuppressed === true) {
    return false;
  }

  return true;
}

/**
 * Convert an arbitrary identifier into a stable lowercase key.
 */
function normaliseIdentifier(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}