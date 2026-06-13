// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\pf2eConditionResolver.js

import {
  CONDITION_EFFECT_IDS
} from "./constants.js";

import {
  registerSystemConditionResolver
} from "./conditionResolver.js";

/**
 * Register Pathfinder Second Edition condition mappings.
 *
 * PF2e exposes prepared actor conditions through actor.conditions.
 * This includes active stored conditions and prepared in-memory conditions.
 *
 * PF2e-specific condition identifiers remain isolated from the neutral
 * animation engine.
 */
export function registerPf2eConditionResolver() {
  registerSystemConditionResolver(
    "pf2e",
    resolvePf2eConditionEffect
  );
}

/**
 * Resolve active PF2e conditions into one neutral animation effect.
 *
 * Priority:
 * 1. Conditions that prevent movement.
 * 2. Conditions that substantially suppress movement.
 * 3. Conditions that introduce involuntary movement.
 * 4. Conditions that introduce visible trembling.
 */
function resolvePf2eConditionEffect({
  actor
}) {
  const conditions = actor?.conditions;

  if (!conditions) {
    return CONDITION_EFFECT_IDS.NORMAL;
  }

  /*
   * Complete movement suppression.
   */
  if (
    hasCondition(conditions, "petrified") ||
    hasCondition(conditions, "paralyzed")
  ) {
    return CONDITION_EFFECT_IDS.STILL;
  }

  /*
   * Slow, shallow movement.
   */
  if (
    hasCondition(conditions, "unconscious")
  ) {
    return CONDITION_EFFECT_IDS.SUBDUED;
  }

  /*
   * Reduced ordinary motion with occasional involuntary impulses.
   */
  if (
    hasCondition(conditions, "stunned")
  ) {
    return CONDITION_EFFECT_IDS.TWITCHING;
  }

  /*
   * Ordinary movement with a rapid subtle tremor.
   */
  if (
    hasCondition(conditions, "frightened")
  ) {
    return CONDITION_EFFECT_IDS.TREMBLING;
  }

  return CONDITION_EFFECT_IDS.NORMAL;
}

/**
 * Return whether the prepared PF2e actor condition collection contains an
 * active condition with the supplied slug.
 *
 * PF2e condition slugs are stable programmatic identifiers and must be used
 * instead of displayed or localised condition names.
 */
function hasCondition(
  conditions,
  slug
) {
  if (
    typeof conditions?.hasType === "function"
  ) {
    return conditions.hasType(slug);
  }

  /*
   * Defensive fallback for PF2e versions or test environments where the
   * prepared ActorConditions helper is unavailable.
   */
  const activeConditions =
    Array.isArray(conditions?.active)
      ? conditions.active
      : [];

  return activeConditions.some(
    (condition) =>
      normaliseSlug(condition?.slug) === slug
  );
}

/**
 * Convert an arbitrary condition slug into a stable lowercase identifier.
 */
function normaliseSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}