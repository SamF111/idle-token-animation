// D:\FoundryVTT\Data\modules\idle-token-animation\scripts\utils.js

/**
 * Clamp a number to a finite range.
 */
export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert degrees to radians.
 */
export function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}