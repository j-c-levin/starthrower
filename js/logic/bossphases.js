// Pure phase state + weak-point ring layout for the Guardian (js/boss.js).

export const PHASE_COUNT = 3;
export const RING_SIZE = 3;

export const ringId = (phase, i) => `guardian-${phase}-${i}`;

// Actions returned to the caller: { open, ids, early } | { defeated, timedOut } | null.
// Stale or duplicate phase events (including the guardian's own early-advance
// re-emit) resolve to null, so a destroyed-early phase can never double-advance.
export function createGuardianPhases() {
  let phase = 0;
  let defeated = false;
  let ring = new Set();

  const open = (n, early) => {
    phase = n;
    const ids = [];
    for (let i = 0; i < RING_SIZE; i++) ids.push(ringId(n, i));
    ring = new Set(ids);
    return { open: n, ids, early };
  };
  const defeat = (timedOut) => {
    defeated = true;
    ring = new Set();
    return { defeated: true, timedOut };
  };

  return {
    phase: () => phase,
    defeated: () => defeated,
    remaining: () => ring.size,
    phaseEvent(n) {
      if (defeated || !Number.isInteger(n) || n <= phase || n > PHASE_COUNT) return null;
      return open(n, false);
    },
    weakpointHit(id) {
      if (defeated || !ring.has(id)) return null;
      ring.delete(id);
      if (ring.size > 0) return null;
      if (phase >= PHASE_COUNT) return defeat(false);
      return open(phase + 1, true);
    },
    timeout() {
      if (defeated) return null;
      return defeat(true);
    },
  };
}

export const ANCHOR_RADIUS = 7.4;
export const ANCHOR_SPREAD = 0.45; // rad between adjacent anchors in a ring
export const RING_HEIGHTS = [-2.4, 1.0, 4.4]; // local y of the three collar bands

// Each phase's ring is anchored on the sector of the Guardian that the rail
// sweeps during that phase's window, so every weak point stays shootable from
// the rail side as it orbits (far-side anchors would be dead targets).
export function ringAnchors(spline, boss) {
  const { center, phaseAt, timeoutAt } = boss;
  const windows = phaseAt.map((d, i) => [
    d,
    phaseAt[i + 1] !== undefined ? phaseAt[i + 1] : timeoutAt,
  ]);
  return windows.map(([d0, d1], pi) => {
    const p = spline.pointAt((d0 + d1) / 2);
    const mid = Math.atan2(p.x - center.x, -(p.z - center.z));
    return [-1, 0, 1].map((k) => {
      const a = mid + k * ANCHOR_SPREAD;
      return {
        x: center.x + ANCHOR_RADIUS * Math.sin(a),
        y: center.y + RING_HEIGHTS[pi],
        z: center.z - ANCHOR_RADIUS * Math.cos(a),
        angle: a,
      };
    });
  });
}
