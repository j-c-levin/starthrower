export function throwThreshold(heightMetres) {
  if (!heightMetres) return 0.25;
  return Math.min(0.4, Math.max(0.15, 0.18 * heightMetres));
}

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const norm3 = (v) => {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
};

const BUFFER_SIZE = 8;
const LOOKBACK_TARGET_MS = 100;
const LOOKBACK_MIN_MS = 40;
const DEGENERATE_MOTION_M = 0.02;

export function createHandTracker({ threshold, cooldownMs = 250 }) {
  let state = 'armed';
  let baseline = Infinity;
  let fireDist = 0;
  let lastFire = -Infinity;
  const buffer = []; // ring of { pos, t }, oldest first, confident samples only

  function smoothed() {
    const recent = buffer.slice(-3);
    if (!recent.length) return null;
    const s = { x: 0, y: 0, z: 0 };
    for (const p of recent) { s.x += p.pos.x; s.y += p.pos.y; s.z += p.pos.z; }
    return { x: s.x / recent.length, y: s.y / recent.length, z: s.z / recent.length };
  }

  // Buffered sample whose age is closest to LOOKBACK_TARGET_MS, among
  // samples old enough (>= LOOKBACK_MIN_MS) to represent real motion
  // rather than this-frame jitter.
  function pastSample(now) {
    let best = null;
    let bestDiff = Infinity;
    for (const s of buffer) {
      const age = now - s.t;
      if (age < LOOKBACK_MIN_MS) continue;
      const diff = Math.abs(age - LOOKBACK_TARGET_MS);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = s;
      }
    }
    return best;
  }

  function fireDirection(current, headPos, handPos, now) {
    const past = pastSample(now);
    if (past) {
      const motion = sub3(current, past.pos);
      if (Math.hypot(motion.x, motion.y, motion.z) >= DEGENERATE_MOTION_M) {
        return norm3(motion);
      }
    }
    return norm3(sub3(handPos, headPos));
  }

  return {
    state: () => state,
    baseline: () => baseline,
    update({ headPos, handPos, confident = true, t }) {
      const d = dist3(headPos, handPos);
      if (confident) {
        buffer.push({ pos: { ...handPos }, t });
        if (buffer.length > BUFFER_SIZE) buffer.shift();
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
        const current = confident ? { ...handPos } : smoothed();
        if (!current) return null;
        state = 'recovering';
        fireDist = d;
        lastFire = t;
        const dir = fireDirection(current, headPos, handPos, t);
        return { origin: current, dir };
      }
      return null;
    },
  };
}
