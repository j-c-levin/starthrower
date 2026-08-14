export const TUNING_DEFAULTS = Object.freeze({
  thrFactor: 0.18,
  thrMin: 0.15,
  thrMax: 0.40,
  cooldownMs: 250,
  rearmFrac: 0.5,
  shoulderDownFrac: 0.13,
  shoulderDownMin: 0.15,
  shoulderDownMax: 0.28,
  shoulderLatFrac: 0.09,
  shoulderLatMin: 0.08,
  shoulderLatMax: 0.18,
  boltSpeed: 40,
  boltRange: 60,
});

export function createTuning(search) {
  const q = new URLSearchParams(search || '');
  const values = {};
  const applied = [];
  for (const key of Object.keys(TUNING_DEFAULTS)) {
    const v = Number(q.get(key));
    if (Number.isFinite(v) && v > 0) {
      values[key] = v;
      applied.push({ key, value: v });
    } else {
      values[key] = TUNING_DEFAULTS[key];
    }
  }
  return {
    get(key) { return values[key]; },
    overrides() { return applied; },
  };
}
