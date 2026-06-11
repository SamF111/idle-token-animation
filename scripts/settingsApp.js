// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\settingsApp.js

import { MODULE_ID } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Idle Token Animation - Motion Settings App
 *
 * Purpose:
 * - Provide a compact popup for motion tuning only.
 * - Use ApplicationV2 for Foundry v13/v14 compatibility.
 * - Leave general eligibility and HP settings in Foundry's normal settings UI.
 */
export class IdleTokenAnimationMotionSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
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
      handler: IdleTokenAnimationMotionSettingsApp.onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/motion-settings.hbs`
    }
  };

  /**
   * Prepare template context.
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.settings = {
      amount: game.settings.get(MODULE_ID, "amount"),
      bobPx: game.settings.get(MODULE_ID, "bobPx"),
      swayPx: game.settings.get(MODULE_ID, "swayPx"),
      rollDeg: game.settings.get(MODULE_ID, "rollDeg"),
      freqHz: game.settings.get(MODULE_ID, "freqHz"),
      noise: game.settings.get(MODULE_ID, "noise"),
      randomPhase: game.settings.get(MODULE_ID, "randomPhase")
    };

    return context;
  }

  /**
   * Save motion settings.
   *
   * @this {IdleTokenAnimationMotionSettingsApp}
   * @param {SubmitEvent|Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async onSubmit(event, form, formData) {
    const values = {
      amount: readNumber(form, "amount", 1),
      bobPx: readNumber(form, "bobPx", 2),
      swayPx: readNumber(form, "swayPx", 2),
      rollDeg: readNumber(form, "rollDeg", 0),
      freqHz: readNumber(form, "freqHz", 0.5),
      noise: readNumber(form, "noise", 0.01),
      randomPhase: readBoolean(form, "randomPhase")
    };

    for (const [key, value] of Object.entries(values)) {
      await game.settings.set(MODULE_ID, key, value);
    }

    globalThis.idleTokenAnimation?.api?.requestSync?.();
  }
}

/**
 * Read a checkbox value.
 */
function readBoolean(form, name) {
  return Boolean(form.elements[name]?.checked);
}

/**
 * Read a numeric input value.
 */
function readNumber(form, name, fallback) {
  const value = Number(form.elements[name]?.value);
  return Number.isFinite(value) ? value : fallback;
}