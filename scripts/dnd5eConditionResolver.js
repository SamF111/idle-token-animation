// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\dnd5eConditionResolver.js

import {
  CONDITION_EFFECT_IDS
} from "./constants.js";

import {
  registerSystemConditionResolver
} from "./conditionResolver.js";

/**
 * Register D&D 5e condition mappings.
 *
 * D&D-specific status identifiers remain isolated from the neutral animation
 * engine.
 */
export function registerDnd5eConditionResolver() {
  registerSystemConditionResolver(
    "dnd5e",
    resolveDnd5eConditionEffect
  );
}

/**
 * Resolve active D&D 5e statuses into one neutral animation effect.
 *
 * Priority matters. Conditions that prevent movement take precedence over
 * conditions that merely alter movement.
 */
function resolveDnd5eConditionEffect({
  statusIds
}) {
  if (
    statusIds.has("dead") ||
    statusIds.has("petrified") ||
    statusIds.has("paralyzed")
  ) {
    return CONDITION_EFFECT_IDS.STILL;
  }

  if (statusIds.has("unconscious")) {
    return CONDITION_EFFECT_IDS.SUBDUED;
  }

  if (statusIds.has("stunned")) {
    return CONDITION_EFFECT_IDS.TWITCHING;
  }

  if (statusIds.has("frightened")) {
    return CONDITION_EFFECT_IDS.TREMBLING;
  }

  return CONDITION_EFFECT_IDS.NORMAL;
}