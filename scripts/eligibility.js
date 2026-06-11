// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\eligibility.js

import { MODULE_ID } from "./constants.js";
import { getAnimationTarget } from "./animation.js";
import { getFilterZeroHpTokens } from "./settings.js";

/**
 * Return tokens that should be animated.
 *
 * GM-side eligibility scan.
 */
export function getEligibleTokens() {
  const tokens = [];

  for (const token of canvas.tokens?.placeables ?? []) {
    if (!isTokenEligible(token)) continue;
    tokens.push(token);
  }

  return tokens;
}

/**
 * Return token ids that should be animated.
 */
export function getEligibleTokenIds() {
  return getEligibleTokens().map((token) => token.id);
}

/**
 * Determine whether a token is eligible for idle animation.
 *
 * HP filtering is optional:
 * - enabled: actor HP must resolve and be above 0
 * - disabled: HP is ignored entirely
 */
function isTokenEligible(token) {
  if (!token?.document) return false;
  if (!token.actor) return false;

  const target = getAnimationTarget(token);
  if (!target) return false;

  if (isPlacedTokenDisabled(token)) return false;
  if (isActorPrototypeDisabled(token.actor)) return false;

  if (Boolean(game.settings.get(MODULE_ID, "respectHidden")) && token.document.hidden) {
    return false;
  }

  if (Boolean(game.settings.get(MODULE_ID, "respectCombat")) && isTokenInCombat(token)) {
    return false;
  }

  if (getFilterZeroHpTokens()) {
    const hp = resolveActorHp(token.actor);
    if (!Number.isFinite(hp)) return false;
    if (hp <= 0) return false;
  }

  return true;
}

/**
 * Resolve actor HP using automatic or custom detection.
 */
function resolveActorHp(actor) {
  const mode = String(game.settings.get(MODULE_ID, "hpDetectionMode") ?? "auto");

  if (mode === "custom") {
    const path = String(game.settings.get(MODULE_ID, "customHpPath") ?? "").trim();
    if (!path) return Number.NaN;

    return Number(foundry.utils.getProperty(actor, path));
  }

  const candidatePaths = [
    "system.attributes.hp.value",
    "system.hp.value",
    "system.health.value",
    "system.resources.hp.value"
  ];

  for (const path of candidatePaths) {
    const value = Number(foundry.utils.getProperty(actor, path));
    if (Number.isFinite(value)) return value;
  }

  return Number.NaN;
}

/**
 * Check whether an actor prototype token has opted out.
 */
function isActorPrototypeDisabled(actor) {
  const explicitDisabled = foundry.utils.getProperty(
    actor,
    `prototypeToken.flags.${MODULE_ID}.disabled`
  );

  if (explicitDisabled === true) return true;

  const defaultOptOut = Boolean(game.settings.get(MODULE_ID, "defaultActorOptOut"));
  if (!defaultOptOut) return false;

  const explicitEnabled = foundry.utils.getProperty(
    actor,
    `prototypeToken.flags.${MODULE_ID}.enabled`
  );

  return explicitEnabled !== true;
}

/**
 * Check whether an individual placed token has opted out.
 */
function isPlacedTokenDisabled(token) {
  return token.document.getFlag(MODULE_ID, "disabled") === true;
}

/**
 * Check whether a token is currently represented in combat.
 */
function isTokenInCombat(token) {
  const combat = game.combat;
  if (!combat) return false;

  return combat.combatants.some((combatant) => {
    return combatant.tokenId === token.id && combatant.sceneId === canvas.scene?.id;
  });
}