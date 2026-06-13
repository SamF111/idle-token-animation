// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\settings.js

import {
  DEFAULT_SETTINGS,
  MODULE_ID
} from "./constants.js";

import {
  IdleTokenAnimationMotionSettingsApp
} from "./settingsApp.js";

import {
  requestSync
} from "./socket.js";

import {
  clamp
} from "./utils.js";

/**
 * Register GM-owned world settings.
 *
 * Motion settings are hidden from the default settings list and exposed through
 * a compact popup.
 *
 * Eligibility, HP, and condition-response settings remain normal Foundry world
 * settings.
 */
export function registerSettings() {
  game.settings.registerMenu(
    MODULE_ID,
    "motionSettings",
    {
      name: "Motion Settings",
      label: "Configure Motion",
      hint: "Configure motion strength, speed, bob, sway, tilt, irregularity, and phase.",
      icon: "fas fa-wave-square",
      type: IdleTokenAnimationMotionSettingsApp,
      restricted: true
    }
  );

  game.settings.register(
    MODULE_ID,
    "enabled",
    {
      name: "Enable Idle Token Animation",
      hint: "Apply subtle ambient animation to viable tokens.",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS.enabled,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "conditionAnimationsEnabled",
    {
      name: "Enable Condition-Based Animation",
      hint: "Allow recognised actor conditions to modify idle animation. Unsupported systems and unrecognised conditions continue using normal idle motion.",
      scope: "world",
      config: true,
      type: Boolean,
      default:
        DEFAULT_SETTINGS.conditionAnimationsEnabled,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "amount",
    {
      name: "Motion Strength",
      hint: "Master multiplier. 0 = off, 1 = configured values, 2+ = exaggerated.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.amount,
      range: {
        min: 0,
        max: 5,
        step: 0.1
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "bobPx",
    {
      name: "Vertical Bob",
      hint: "Vertical bob distance in pixels before the Motion Strength multiplier.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.bobPx,
      range: {
        min: 0,
        max: 10,
        step: 0.05
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "swayPx",
    {
      name: "Horizontal Sway",
      hint: "Horizontal sway distance in pixels before the Motion Strength multiplier.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.swayPx,
      range: {
        min: 0,
        max: 10,
        step: 0.05
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "rollDeg",
    {
      name: "Tilt Angle",
      hint: "Maximum visual tilt in degrees before the Motion Strength multiplier.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.rollDeg,
      range: {
        min: 0,
        max: 15,
        step: 0.05
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "freqHz",
    {
      name: "Motion Speed",
      hint: "Idle animation speed in cycles per second.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.freqHz,
      range: {
        min: 0.01,
        max: 3,
        step: 0.01
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "noise",
    {
      name: "Irregularity",
      hint: "Small irregular motion amount before the Motion Strength multiplier.",
      scope: "world",
      config: false,
      type: Number,
      default: DEFAULT_SETTINGS.noise,
      range: {
        min: 0,
        max: 0.5,
        step: 0.01
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "randomPhase",
    {
      name: "Desynchronise Token Motion",
      hint: "Offset each token animation so all tokens do not move in unison.",
      scope: "world",
      config: false,
      type: Boolean,
      default: DEFAULT_SETTINGS.randomPhase,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "respectHidden",
    {
      name: "Do Not Animate Hidden Tokens",
      hint: "Hidden tokens are excluded when this is enabled.",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS.respectHidden,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "respectCombat",
    {
      name: "Do Not Animate Tokens In Combat",
      hint: "Tokens currently in combat are excluded when this is enabled.",
      scope: "world",
      config: true,
      type: Boolean,
      default: DEFAULT_SETTINGS.respectCombat,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "filterZeroHpTokens",
    {
      name: "Filter 0 HP Tokens",
      hint: "Only animate tokens whose actor HP resolves above 0. Disable this to ignore HP entirely.",
      scope: "world",
      config: true,
      type: Boolean,
      default:
        DEFAULT_SETTINGS.filterZeroHpTokens,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "hpDetectionMode",
    {
      name: "HP Detection Mode",
      hint: "Use automatic HP detection or a custom actor system path. Only used when 0 HP filtering is enabled.",
      scope: "world",
      config: true,
      type: String,
      default:
        DEFAULT_SETTINGS.hpDetectionMode,
      choices: {
        auto: "Automatic",
        custom: "Custom Path"
      },
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "customHpPath",
    {
      name: "Custom HP Path",
      hint: "Actor system path used when HP Detection Mode is Custom. Example: system.attributes.hp.value. Only used when 0 HP filtering is enabled.",
      scope: "world",
      config: true,
      type: String,
      default:
        DEFAULT_SETTINGS.customHpPath,
      restricted: true,
      onChange: requestSync
    }
  );

  game.settings.register(
    MODULE_ID,
    "defaultActorOptOut",
    {
      name: "Default Actor Opt-Out",
      hint: "Treat actors as opted out unless explicitly enabled later. Leave off for normal behaviour.",
      scope: "world",
      config: true,
      type: Boolean,
      default:
        DEFAULT_SETTINGS.defaultActorOptOut,
      restricted: true,
      onChange: requestSync
    }
  );
}

/**
 * Return whether the GM wants condition-based animation enabled.
 *
 * When disabled:
 * - token conditions must not modify animation
 * - tokens continue using their ordinary global or placed-token motion
 * - condition hooks may still request synchronisation safely
 */
export function getConditionAnimationsEnabled() {
  return game.settings.get(
    MODULE_ID,
    "conditionAnimationsEnabled"
  ) !== false;
}

/**
 * Return whether the GM wants 0 HP tokens excluded.
 *
 * Enabled preserves the original living-token behaviour:
 * - HP must resolve
 * - HP must be above 0
 *
 * Disabled means HP is ignored during eligibility checks.
 */
export function getFilterZeroHpTokens() {
  return game.settings.get(
    MODULE_ID,
    "filterZeroHpTokens"
  ) !== false;
}

/**
 * Convert GM settings into internal animation parameters.
 *
 * Motion Strength is the master multiplier.
 * Frequency is direct and is not multiplied by Motion Strength.
 *
 * Base values are included so placed-token overrides can inherit or replace
 * raw motion values before Motion Strength is applied.
 *
 * The condition-animation toggle is included in the authoritative parameter
 * payload so per-token resolution can bypass condition effects when disabled.
 */
export function buildAnimationParamsFromSettings() {
  const amount = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "amount"
      )
    ),
    0,
    5
  );

  const bobPx = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "bobPx"
      )
    ),
    0,
    10
  );

  const swayPx = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "swayPx"
      )
    ),
    0,
    10
  );

  const rollDeg = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "rollDeg"
      )
    ),
    0,
    15
  );

  const freqHz = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "freqHz"
      )
    ),
    0.01,
    3
  );

  const noise = clamp(
    Number(
      game.settings.get(
        MODULE_ID,
        "noise"
      )
    ),
    0,
    0.5
  );

  const randomPhase = Boolean(
    game.settings.get(
      MODULE_ID,
      "randomPhase"
    )
  );

  const conditionAnimationsEnabled =
    getConditionAnimationsEnabled();

  return {
    amount,

    baseBobPx: bobPx,
    baseSwayPx: swayPx,
    baseRollDeg: rollDeg,
    baseNoise: noise,

    bobPx: bobPx * amount,
    swayPx: swayPx * amount,
    rollDeg: rollDeg * amount,
    freqHz,
    noise: noise * amount,

    randomPhase,
    conditionAnimationsEnabled
  };
}