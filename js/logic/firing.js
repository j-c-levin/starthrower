export function throwThreshold(heightMetres) {
  if (!heightMetres) return 0.25;
  return Math.min(0.4, Math.max(0.15, 0.18 * heightMetres));
}

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function createHandTracker({ threshold, cooldownMs = 250 }) {
  let state = 'armed';
  let baseline = Infinity;
  let fireDist = 0;
  let lastFire = -Infinity;
  const good = [];

  function smoothed() {
    if (!good.length) return null;
    const s = { x: 0, y: 0, z: 0 };
    for (const p of good) { s.x += p.x; s.y += p.y; s.z += p.z; }
    return { x: s.x / good.length, y: s.y / good.length, z: s.z / good.length };
  }

  return {
    state: () => state,
    baseline: () => baseline,
    update({ headPos, handPos, confident = true, t }) {
      const d = dist3(headPos, handPos);
      if (confident) {
        good.push({ ...handPos });
        if (good.length > 3) good.shift();
        if (state === 'armed') baseline = Math.min(baseline, d);
      }
      if (state === 'recovering') {
        if (d <= fireDist - threshold / 2) {
          state = 'armed';
          baseline = d;
        }
        return null;
      }
      if (d - baseline > threshold && t - lastFire >= cooldownMs) {
        const through = confident ? { ...handPos } : smoothed();
        if (!through) return null;
        state = 'recovering';
        fireDist = d;
        lastFire = t;
        return { origin: headPos, through };
      }
      return null;
    },
  };
}
