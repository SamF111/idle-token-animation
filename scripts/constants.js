// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\constants.js

export const MODULE_ID = "idle-token-animation";
export const RUNTIME_KEY = "idleTokenAnimation";
export const SOCKET_NAME = `module.${MODULE_ID}`;

export const DEFAULT_SETTINGS = {
  enabled: true,

  amount: 1.0,
  bobPx: 2,
  swayPx: 2,
  rollDeg: 0,
  freqHz: 0.5,
  noise: 0.01,
  randomPhase: true,

  respectHidden: true,
  respectCombat: false,
  filterZeroHpTokens: true,
  hpDetectionMode: "auto",
  customHpPath: "",
  defaultActorOptOut: false
};