export const TARGET_VALUES = { core: 0, crate: 10, asteroid: 25, drone: 50, popup: 50, weakpoint: 100 };

export function createScore() {
  let score = 0, streak = 0;
  const multiplier = () => Math.min(4, 1 + Math.floor(streak / 5));
  return {
    hit(type) {
      const points = (TARGET_VALUES[type] ?? 0) * multiplier();
      score += points;
      streak += 1;
      return points;
    },
    miss() { streak = 0; },
    score: () => score,
    multiplier,
    streak: () => streak,
    reset() { score = 0; streak = 0; },
  };
}

const KEY = 'starthrower.best';
export function loadBest(storage) {
  const v = Number(storage.getItem(KEY));
  return Number.isFinite(v) && v > 0 ? v : 0;
}
export function saveBest(storage, score) {
  if (score <= loadBest(storage)) return false;
  storage.setItem(KEY, String(score));
  return true;
}
