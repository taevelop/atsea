// Allocation and UI limits are shared so stored values cannot raise the budget.
export const LIMITS = Object.freeze({
  fish: Object.freeze([0, 1000]),
  sharks: Object.freeze([0, 24]),
  coral: Object.freeze([0, 28]),
  starfish: Object.freeze([0, 28]),
  seaweed: Object.freeze([0, 100]),
  speed: Object.freeze([6, 60]),
  megalodon: Object.freeze([0, 1]),
});

export function normalizeSetting(key, value, fallback = key === 'speed' ? 20 : 0) {
  const range = Object.hasOwn(LIMITS, key) ? LIMITS[key] : undefined;
  if (!range) return undefined;
  const [min, max] = range;
  const number = Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback : min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

export function normalizePopulation(kind, value, fallback = 0) {
  return normalizeSetting(kind === 'shark' ? 'sharks' : kind === 'megalodon' ? kind : 'fish', value, fallback);
}
