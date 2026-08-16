const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

export function createSpline(points) {
  if (!points || points.length < 2) throw new Error('need >= 2 waypoints');
  const pts = [points[0], ...points, points[points.length - 1]];
  const SAMPLES = 64;
  const samples = [];
  let d = 0, prev = null;
  for (let i = 0; i + 3 < pts.length; i++) {
    for (let s = 0; s <= SAMPLES; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / SAMPLES;
      const p = {
        x: cr(pts[i].x, pts[i + 1].x, pts[i + 2].x, pts[i + 3].x, t),
        y: cr(pts[i].y, pts[i + 1].y, pts[i + 2].y, pts[i + 3].y, t),
        z: cr(pts[i].z, pts[i + 1].z, pts[i + 2].z, pts[i + 3].z, t),
      };
      if (prev) d += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
      samples.push({ d, p });
      prev = p;
    }
  }
  const length = samples[samples.length - 1].d;

  function pointAt(dist) {
    const target = Math.min(length, Math.max(0, dist));
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].d < target) lo = mid; else hi = mid;
    }
    const a = samples[lo], b = samples[hi];
    const span = b.d - a.d || 1;
    const f = (target - a.d) / span;
    return {
      x: a.p.x + (b.p.x - a.p.x) * f,
      y: a.p.y + (b.p.y - a.p.y) * f,
      z: a.p.z + (b.p.z - a.p.z) * f,
    };
  }

  function tangentAt(dist) {
    // Sample around the clamped target, not the raw (possibly far out-of-range)
    // dist — otherwise querying well past the end (tally's continued drift)
    // clamps both samples to the same terminal point, zeroing the tangent and
    // snapping yaw toward 0 instead of holding the final heading.
    const target = Math.min(length, Math.max(0, dist));
    const a = pointAt(target - 0.5), b = pointAt(target + 0.5);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const m = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / m, y: dy / m, z: dz / m };
  }

  return { length, pointAt, tangentAt };
}
