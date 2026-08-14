const norm = (v) => {
  const m = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / m, y: v.y / m, z: v.z / m };
};
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Rotate a vector about the world Y axis. Positive yawRad turns local
// forward (0,0,-1) toward -X — the same convention THREE.Euler('YXZ').y
// reports for a camera's world quaternion, so hands.js can feed the raw
// camera yaw straight in.
const rotateY = (v, yawRad) => {
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos };
};

export function aimDirection(origin, through) {
  return norm(sub(through, origin));
}

export function armOffsets(heightMetres) {
  return {
    down: heightMetres ? Math.min(0.28, Math.max(0.15, 0.13 * heightMetres)) : 0.22,
    lateral: heightMetres ? Math.min(0.18, Math.max(0.08, 0.09 * heightMetres)) : 0.15,
  };
}

// Arm-ray aim: bolt direction is shoulder->hand, computed fresh at the
// fire instant (no motion differentiation). The virtual shoulder sits
// below and to the side of the head, offset rotated into the head's
// yaw frame so it stays "attached" to the body as the player turns.
export function armRayDir(headPos, headYawRad, handPos, side, heightMetres) {
  const { down, lateral } = armOffsets(heightMetres);
  const sign = side === 'left' ? -1 : 1;
  const lateralOffset = rotateY({ x: sign * lateral, y: 0, z: 0 }, headYawRad);
  const shoulder = {
    x: headPos.x + lateralOffset.x,
    y: headPos.y - down,
    z: headPos.z + lateralOffset.z,
  };
  return norm(sub(handPos, shoulder));
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
