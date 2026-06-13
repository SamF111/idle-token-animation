// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\settingsApp.js

import {
  DEFAULT_SETTINGS,
  MODULE_ID
} from "./constants.js";

const {
  ApplicationV2,
  HandlebarsApplicationMixin
} = foundry.applications.api;

/**
 * Idle Token Animation - Motion Settings App
 *
 * Purpose:
 * - Provide a compact popup for motion and condition-response settings.
 * - Use ApplicationV2 for Foundry v13 and v14 compatibility.
 * - Leave general eligibility and HP settings in Foundry's normal settings UI.
 */
export class IdleTokenAnimationMotionSettingsApp extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "idle-token-animation-motion-settings",
    tag: "form",
    classes: [
      "idle-token-animation-motion-settings-app"
    ],
    window: {
      title: "Idle Token Animation - Motion"
    },
    position: {
      width: 520,
      height: "auto"
    },
    form: {
      handler:
        IdleTokenAnimationMotionSettingsApp.onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: {
      template:
        `modules/${MODULE_ID}/templates/motion-settings.hbs`
    }
  };

  /**
   * Prepare template context.
   */
  async _prepareContext(options) {
    const context =
      await super._prepareContext(options);

    context.settings = {
      conditionAnimationsEnabled:
        game.settings.get(
          MODULE_ID,
          "conditionAnimationsEnabled"
        ),

      amount:
        game.settings.get(
          MODULE_ID,
          "amount"
        ),

      bobPx:
        game.settings.get(
          MODULE_ID,
          "bobPx"
        ),

      swayPx:
        game.settings.get(
          MODULE_ID,
          "swayPx"
        ),

      rollDeg:
        game.settings.get(
          MODULE_ID,
          "rollDeg"
        ),

      freqHz:
        game.settings.get(
          MODULE_ID,
          "freqHz"
        ),

      noise:
        game.settings.get(
          MODULE_ID,
          "noise"
        ),

      randomPhase:
        game.settings.get(
          MODULE_ID,
          "randomPhase"
        )
    };

    return context;
  }

  /**
   * Save motion and condition-response settings.
   *
   * @this {IdleTokenAnimationMotionSettingsApp}
   * @param {SubmitEvent|Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async onSubmit(
    event,
    form,
    formData
  ) {
    const values = {
      conditionAnimationsEnabled:
        readBoolean(
          form,
          "conditionAnimationsEnabled",
          DEFAULT_SETTINGS.conditionAnimationsEnabled
        ),

      amount:
        readNumber(
          form,
          "amount",
          DEFAULT_SETTINGS.amount
        ),

      bobPx:
        readNumber(
          form,
          "bobPx",
          DEFAULT_SETTINGS.bobPx
        ),

      swayPx:
        readNumber(
          form,
          "swayPx",
          DEFAULT_SETTINGS.swayPx
        ),

      rollDeg:
        readNumber(
          form,
          "rollDeg",
          DEFAULT_SETTINGS.rollDeg
        ),

      freqHz:
        readNumber(
          form,
          "freqHz",
          DEFAULT_SETTINGS.freqHz
        ),

      noise:
        readNumber(
          form,
          "noise",
          DEFAULT_SETTINGS.noise
        ),

      randomPhase:
        readBoolean(
          form,
          "randomPhase",
          DEFAULT_SETTINGS.randomPhase
        )
    };

    for (
      const [key, value]
      of Object.entries(values)
    ) {
      await game.settings.set(
        MODULE_ID,
        key,
        value
      );
    }

    globalThis.idleTokenAnimation
      ?.api
      ?.requestSync?.();
  }
}

/**
 * Read a checkbox value.
 *
 * When the named form control does not exist, return the supplied fallback.
 * This prevents an older cached template from silently disabling a setting.
 */
function readBoolean(
  form,
  name,
  fallback = false
) {
  const element =
    form?.elements?.[name];

  if (!element) {
    return fallback;
  }

  return Boolean(
    element.checked
  );
}

/**
 * Read a numeric input value.
 */
function readNumber(
  form,
  name,
  fallback
) {
  const value =
    Number(
      form?.elements?.[name]?.value
    );

  return Number.isFinite(value)
    ? value
    : fallback;
}