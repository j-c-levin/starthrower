const norm = (v) => {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
};
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export function aimDirection(origin, through) {
  return norm(sub(through, origin));
}

export function snapToTarget(origin, dir, targets, coneDeg) {
  const cosCone = Math.cos((coneDeg * Math.PI) / 180);
  let best = null, bestCos = cosCone;
  for (const t of targets) {
    const toT = norm(sub(t.pos, origin));
    const c = dot(dir, toT);
    if (c > bestCos) { bestCos = c; best = t; }
  }
  if (!best) return { dir, targetId: null };
  return { dir: norm(sub(best.pos, origin)), targetId: best.id };
}

export function segmentHit(p0, p1, targets) {
  const d = sub(p1, p0);
  const len2 = dot(d, d);
  let bestId = null, bestT = Infinity;
  for (const target of targets) {
    const m = sub(target.pos, p0);
    const t = len2 ? Math.max(0, Math.min(1, dot(m, d) / len2)) : 0;
    const closest = { x: p0.x + d.x * t, y: p0.y + d.y * t, z: p0.z + d.z * t };
    const distSq = dot(sub(target.pos, closest), sub(target.pos, closest));
    if (distSq <= target.radius * target.radius && t < bestT) {
      bestT = t;
      bestId = target.id;
    }
  }
  return bestId;
}
