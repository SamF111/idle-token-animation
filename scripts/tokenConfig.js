// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\tokenConfig.js

import { MODULE_ID } from "./constants.js";
import { requestSync } from "./socket.js";

const TAB_ID = "idle-animation";
const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/token-config-idle-animation.hbs`;

/**
 * Register Token Configuration integration.
 *
 * Adds an Idle Animation tab to the placed-token configuration window.
 *
 * This UI edits persistent placed-token flags only:
 * - flags.idle-token-animation.disabled
 * - flags.idle-token-animation.motionOverride
 *
 * It does not animate anything directly.
 * It does not touch token position, coordinates, scale, scene data, or actor data.
 *
 * Save behaviour:
 * - The native Token Configuration Update Token button remains the only save action.
 * - The injected fields are read when the native form submits.
 * - Idle animation flags are written explicitly after native TokenConfig submit.
 */
export function registerTokenConfigHooks() {
  Hooks.on("renderTokenConfig", (app, html, data) => {
    injectIdleAnimationTab(app, html, data);
  });
}

/**
 * Inject the Idle Animation tab into a rendered Token Configuration window.
 */
async function injectIdleAnimationTab(app, html, _data) {
  const root = getRootElement(html);
  if (!root) return;

  const tokenDocument = getTokenDocument(app);
  if (!tokenDocument) return;

  const nav = findTabNavigation(root);
  const tabParent = findTabParent(root);

  if (!nav || !tabParent) {
    console.warn("[Idle Token Animation] Could not find Token Configuration tab structure.");
    return;
  }

  removeExistingIdleTab(root);
  insertNavigationTab(nav);

  const tabHtml = await renderIdleAnimationTab(tokenDocument);
  const tabElement = htmlToElement(tabHtml);

  if (!tabElement) {
    console.warn("[Idle Token Animation] Could not render Idle Animation token tab.");
    return;
  }

  insertIdleTabElement(root, tabParent, tabElement);

  bindTabNavigation(root, nav);
  bindIdleAnimationControls(root);
  bindNativeSubmitBridge(root, tokenDocument);
}

/**
 * Render the Idle Animation tab template.
 */
async function renderIdleAnimationTab(tokenDocument) {
  const context = buildTemplateContext(tokenDocument);
  const renderer = globalThis.renderTemplate ?? foundry.applications?.handlebars?.renderTemplate;

  if (!renderer) {
    throw new Error("[Idle Token Animation] No Handlebars template renderer available.");
  }

  return renderer(TEMPLATE_PATH, context);
}

/**
 * Build template context for one placed-token document.
 */
function buildTemplateContext(tokenDocument) {
  const motionOverride = getMotionOverride(tokenDocument);

  return {
    moduleId: MODULE_ID,
    tabId: TAB_ID,
    disabled: tokenDocument.getFlag(MODULE_ID, "disabled") === true,
    overrideEnabled: motionOverride?.enabled === true,
    values: {
      amount: finiteNumber(motionOverride?.amount, game.settings.get(MODULE_ID, "amount")),
      bobPx: finiteNumber(motionOverride?.bobPx, game.settings.get(MODULE_ID, "bobPx")),
      swayPx: finiteNumber(motionOverride?.swayPx, game.settings.get(MODULE_ID, "swayPx")),
      rollDeg: finiteNumber(motionOverride?.rollDeg, game.settings.get(MODULE_ID, "rollDeg")),
      freqHz: finiteNumber(motionOverride?.freqHz, game.settings.get(MODULE_ID, "freqHz")),
      noise: finiteNumber(motionOverride?.noise, game.settings.get(MODULE_ID, "noise")),
      randomPhase: typeof motionOverride?.randomPhase === "boolean"
        ? motionOverride.randomPhase
        : game.settings.get(MODULE_ID, "randomPhase")
    }
  };
}

/**
 * Insert the Idle Animation tab button into the token configuration tab strip.
 */
function insertNavigationTab(nav) {
  if (nav.querySelector(`[data-tab="${TAB_ID}"]`)) return;

  const link = document.createElement("a");
  link.classList.add("item");
  link.dataset.tab = TAB_ID;
  link.innerHTML = `<i class="fas fa-wave-square"></i> Idle Animation`;

  nav.appendChild(link);
}

/**
 * Insert the Idle Animation tab before the native Token Configuration footer.
 */
function insertIdleTabElement(root, tabParent, tabElement) {
  const nativeFooter = (
    root.querySelector("footer.sheet-footer") ??
    root.querySelector("footer.form-footer") ??
    root.querySelector(".sheet-footer") ??
    root.querySelector(".form-footer")
  );

  if (nativeFooter?.parentElement === tabParent) {
    tabParent.insertBefore(tabElement, nativeFooter);
    return;
  }

  tabParent.appendChild(tabElement);
}

/**
 * Bind tab navigation so the injected tab behaves like a normal Token
 * Configuration tab without modifying Foundry core templates.
 */
function bindTabNavigation(root, nav) {
  const idleNav = nav.querySelector(`[data-tab="${TAB_ID}"]`);
  const allNavItems = Array.from(nav.querySelectorAll("[data-tab]"));

  if (!idleNav) return;

  idleNav.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    activateIdleTab(root, allNavItems);
  });

  for (const navItem of allNavItems) {
    if (navItem.dataset.tab === TAB_ID) continue;

    navItem.addEventListener("click", () => {
      deactivateIdleTab(root, idleNav);
    });
  }
}

/**
 * Activate the injected Idle Animation tab.
 */
function activateIdleTab(root, allNavItems) {
  for (const navItem of allNavItems) {
    navItem.classList.toggle("active", navItem.dataset.tab === TAB_ID);
  }

  const tabs = getTabContentElements(root);

  for (const tab of tabs) {
    const isIdleTab = tab.dataset.tab === TAB_ID;

    tab.classList.toggle("active", isIdleTab);
    tab.hidden = !isIdleTab;
  }
}

/**
 * Deactivate the injected Idle Animation tab.
 */
function deactivateIdleTab(root, idleNav) {
  idleNav.classList.remove("active");

  const idleTab = root.querySelector(`[data-tab="${TAB_ID}"].idle-token-animation-token-tab`);
  if (idleTab) {
    idleTab.classList.remove("active");
    idleTab.hidden = true;
  }
}

/**
 * Bind local UI behaviour inside the Idle Animation tab.
 *
 * These listeners do not write documents. They only enable or disable visible
 * fields before native Update Token submission.
 */
function bindIdleAnimationControls(root) {
  const overrideCheckbox = root.querySelector(
    `input[name="flags.${MODULE_ID}.motionOverride.enabled"]`
  );

  const motionFieldset = root.querySelector("[data-idle-animation-motion-fields]");

  preventEnterSubmittingFromIdleTab(root);

  if (overrideCheckbox && motionFieldset) {
    const updateMotionFieldState = () => {
      motionFieldset.disabled = !overrideCheckbox.checked;
    };

    overrideCheckbox.addEventListener("change", updateMotionFieldState);
    updateMotionFieldState();
  }
}

/**
 * Bind the native Token Configuration submit.
 *
 * Do not prevent native submit. The native Update Token button still saves
 * normal token configuration. This listener captures idle animation values and
 * writes them explicitly afterwards.
 */
function bindNativeSubmitBridge(root, tokenDocument) {
  const form = getFormElement(root);

  if (!form || form.dataset.idleTokenAnimationSubmitBridge === "true") {
    return;
  }

  form.dataset.idleTokenAnimationSubmitBridge = "true";

  form.addEventListener("submit", () => {
    const idlePayload = readIdleAnimationPayload(root);

    window.setTimeout(() => {
      writeIdleAnimationFlags(tokenDocument, idlePayload);
    }, 250);
  }, { capture: true });
}

/**
 * Read idle animation form values before the native form closes.
 */
function readIdleAnimationPayload(root) {
  return {
    disabled: readCheckbox(root, `flags.${MODULE_ID}.disabled`),
    overrideEnabled: readCheckbox(root, `flags.${MODULE_ID}.motionOverride.enabled`),
    amount: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.amount`, 1, 0, 5),
    bobPx: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.bobPx`, 2, 0, 10),
    swayPx: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.swayPx`, 2, 0, 10),
    rollDeg: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.rollDeg`, 0, 0, 15),
    freqHz: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.freqHz`, 0.5, 0.01, 3),
    noise: readClampedNumber(root, `flags.${MODULE_ID}.motionOverride.noise`, 0.01, 0, 0.5),
    randomPhase: readCheckbox(root, `flags.${MODULE_ID}.motionOverride.randomPhase`)
  };
}

/**
 * Write idle animation flags after native TokenConfig submit.
 *
 * This keeps the native Update Token button as the single commit action while
 * avoiding unreliable persistence of injected flag-path fields.
 */
async function writeIdleAnimationFlags(tokenDocument, idlePayload) {
  if (!tokenDocument?.setFlag) return;

  if (idlePayload.disabled) {
    await tokenDocument.setFlag(MODULE_ID, "disabled", true);
  } else {
    await tokenDocument.unsetFlag(MODULE_ID, "disabled");
  }

  if (idlePayload.overrideEnabled) {
    await tokenDocument.setFlag(MODULE_ID, "motionOverride", {
      enabled: true,
      amount: idlePayload.amount,
      bobPx: idlePayload.bobPx,
      swayPx: idlePayload.swayPx,
      rollDeg: idlePayload.rollDeg,
      freqHz: idlePayload.freqHz,
      noise: idlePayload.noise,
      randomPhase: idlePayload.randomPhase
    });
  } else {
    await tokenDocument.unsetFlag(MODULE_ID, "motionOverride");
  }

  requestSync({ delayed: true });
}

/**
 * Prevent Enter in a number input from accidentally submitting the full native
 * Token Configuration form.
 */
function preventEnterSubmittingFromIdleTab(root) {
  const idleTab = root.querySelector(`[data-tab="${TAB_ID}"].idle-token-animation-token-tab`);
  if (!idleTab) return;

  idleTab.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();
  });
}

/**
 * Remove a previously injected tab during re-render.
 */
function removeExistingIdleTab(root) {
  root.querySelector(`[data-tab="${TAB_ID}"].idle-token-animation-token-tab`)?.remove();

  const navItem = root.querySelector(`.tabs [data-tab="${TAB_ID}"]`);
  navItem?.remove();
}

/**
 * Find the rendered Token Configuration root element.
 */
function getRootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (Array.isArray(html) && html[0] instanceof HTMLElement) return html[0];

  return null;
}

/**
 * Resolve the TokenDocument from a Token Configuration app instance.
 */
function getTokenDocument(app) {
  const candidates = [
    app?.document,
    app?.object,
    app?.token?.document,
    app?.object?.document
  ];

  for (const candidate of candidates) {
    if (candidate?.documentName === "Token") return candidate;
  }

  return null;
}

/**
 * Find the Token Configuration tab navigation element.
 */
function findTabNavigation(root) {
  return (
    root.querySelector("nav.tabs[data-group]") ??
    root.querySelector("nav.tabs") ??
    root.querySelector(".tabs[data-group]") ??
    root.querySelector(".tabs")
  );
}

/**
 * Find the parent element that contains Token Configuration tab panes.
 */
function findTabParent(root) {
  const existingTab = root.querySelector(".tab[data-tab]");
  return existingTab?.parentElement ?? null;
}

/**
 * Return all tab content elements in the token config window.
 */
function getTabContentElements(root) {
  return Array.from(root.querySelectorAll(".tab[data-tab]"));
}

/**
 * Return the form element that owns the Token Configuration window.
 */
function getFormElement(root) {
  if (root instanceof HTMLFormElement) return root;

  return (
    root.closest?.("form") ??
    root.querySelector?.("form") ??
    null
  );
}

/**
 * Convert a rendered HTML string to one element.
 */
function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html ?? "").trim();

  return template.content.firstElementChild;
}

/**
 * Read the placed-token motion override flag.
 */
function getMotionOverride(tokenDocument) {
  const value = tokenDocument.getFlag(MODULE_ID, "motionOverride");

  if (!value || typeof value !== "object") return null;

  return value;
}

/**
 * Read a checkbox by name.
 */
function readCheckbox(root, name) {
  const checkbox = root.querySelector(`input[type="checkbox"][name="${cssEscape(name)}"]`);
  return Boolean(checkbox?.checked);
}

/**
 * Read and clamp a number from the injected token tab.
 */
function readClampedNumber(root, name, fallback, min, max) {
  const value = Number(root.querySelector(`[name="${cssEscape(name)}"]`)?.value);

  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, value));
}

/**
 * Escape a string for CSS query selectors.
 */
function cssEscape(value) {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

/**
 * Return a finite number or fallback.
 */
function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}