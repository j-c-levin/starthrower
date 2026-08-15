import { createSpline } from './spline.js';

export const SPEED = 6; // m/s

const Y = 2;
const STEP = 15; // target chord spacing between waypoints; keeps the Catmull-Rom fit close to uniform

function range(z0, z1) {
  const n = Math.max(1, Math.round(Math.abs(z1 - z0) / STEP));
  const pts = [];
  for (let i = 1; i <= n; i++) pts.push(z0 + (z1 - z0) * (i / n));
  return pts;
}

function departure() {
  return range(0, -180).map((z) => ({ x: 0, y: Y, z }));
}

function asteroids() {
  const z0 = -180, z1 = -540;
  return range(z0, z1).map((z) => {
    const f = (z - z0) / (z1 - z0);
    // two gentle S-bends + a slow vertical swell, decorrelated (~1.3°/s pitch, cap is 10)
    return { x: 18 * Math.sin(f * Math.PI * 2), y: Y + 3 * Math.sin(f * Math.PI * 4), z };
  });
}

// sweeps out along the derelict's forward hull, dives through the break between
// its two sections (~1.8°/s pitch vs the 10°/s cap), then drifts back in line
// with the boss circle's entry
function derelict(exitX, z1) {
  const z0 = -540;
  return range(z0, z1).map((z) => {
    const f = (z - z0) / (z1 - z0);
    const bulge = Math.sin(Math.min(1, f / 0.7) * Math.PI);
    const dive = f > 0.34 && f < 0.62
      ? 0.5 * (1 - Math.cos(((f - 0.34) / 0.28) * Math.PI * 2))
      : 0;
    return { x: 30 * bulge + exitX * f, y: Y - 5.5 * dive, z };
  });
}

// full loop around (cx, cz), radius R; entry/exit angle chosen so the tangent there is -z,
// so it joins the straight approach/exit segments without a heading kink
function bossCircle(cx, cz, R) {
  const circumference = 2 * Math.PI * R;
  const steps = Math.max(8, Math.round(circumference / STEP));
  const start = -Math.PI / 2;
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const theta = start + (i / steps) * Math.PI * 2;
    pts.push({ x: cx + R * Math.sin(theta), y: Y, z: cz - R * Math.cos(theta) });
  }
  return pts;
}

function tally(entryX, z1) {
  const z0 = -1050;
  return range(z0, z1).map((z) => ({ x: entryX, y: Y, z }));
}

const BOSS_CENTER = { x: 0, y: Y, z: -1050 };
const BOSS_RADIUS = 25;
const bossEntryX = BOSS_CENTER.x - BOSS_RADIUS;

export const WAYPOINTS = [
  { x: 0, y: Y, z: 0 },
  ...departure(),
  ...asteroids(),
  ...derelict(bossEntryX, BOSS_CENTER.z),
  ...bossCircle(BOSS_CENTER.x, BOSS_CENTER.z, BOSS_RADIUS),
  ...tally(bossEntryX, -1095),
];

const spline = createSpline(WAYPOINTS);
const railSpawn = (at, target, dx, dy, extra) => {
  const p = spline.pointAt(at);
  return { at, type: 'spawn', target, pos: [p.x + dx, p.y + dy, p.z], ...extra };
};

// asteroid-field beat: 25 asteroids + 8 drones, spacing ramps ~19m -> ~9m
const fieldSpawns = [
  [186, 'asteroid', -4, 1.5], [205, 'asteroid', 4.5, 0.6], [224, 'asteroid', -5, 2.0],
  [236, 'drone', 2.5, 1.0],
  [243, 'asteroid', 3.5, -0.3], [262, 'asteroid', -3, 1.2],
  [272, 'drone', -2.5, 1.3],
  [281, 'asteroid', 5, 0.8], [300, 'asteroid', -4.5, 0.2], [314, 'asteroid', 3, 1.8],
  [320, 'drone', -2, 0.9],
  [328, 'asteroid', -2.5, 0.7], [342, 'asteroid', 5, 1.2], [356, 'asteroid', -5.5, 1.6],
  [362, 'drone', 3, 1.4],
  [370, 'asteroid', 2.5, -0.4], [384, 'asteroid', -3.5, 1.0], [398, 'asteroid', 4, 1.9],
  [406, 'drone', -3, 0.7],
  [420, 'asteroid', -4, 1.4],
  [426, 'drone', 2, 1.2],
  [430, 'asteroid', 3.5, 0.3], [440, 'asteroid', -5, 1.9], [449, 'asteroid', 2.5, 1.1],
  [458, 'asteroid', -3, -0.2],
  [463, 'drone', -2.5, 0.8],
  [467, 'asteroid', 4.5, 1.5], [476, 'asteroid', -2.5, 0.8], [485, 'asteroid', 5.5, 1.2],
  [494, 'asteroid', -4.5, 0.5],
  [500, 'drone', 2.5, 1.5],
  [503, 'asteroid', 3, 1.7], [512, 'asteroid', -3.5, 1.0],
].map(([at, target, dx, dy]) => railSpawn(at, target, dx, dy));

// derelict beat: 12 popups in the wreck's windows and hull tears + 6 drones
// weaving in the break; periods staggered so ~half the visible popups are up
// at any moment (ambient.js builds a window socket at every popup pos)
// popup clocks start at deploy (at-40m, so 40/6 s before the pass); these periods
// were solved so every popup is up at its own pass and >=1 is up at any instant
// of the beat (test simulates the same model)
const derelictSpawns = [
  [570, 'popup', -6.5, 1.5, { period: 4.5, duty: 0.6 }],
  [598, 'popup', 5.5, 2.5, { period: 4.5, duty: 0.6 }],
  [615, 'popup', -5.9, 2, { period: 3.2, duty: 0.6 }],
  [645, 'popup', -8.9, 4, { period: 3.2, duty: 0.6 }],
  [660, 'drone', -3.5, 2.5],
  [675, 'popup', -10.9, 1, { period: 3.2, duty: 0.6 }],
  [705, 'popup', -11.7, 5, { period: 3.2, duty: 0.6 }],
  [735, 'popup', -10.4, 2.5, { period: 3.2, duty: 0.6 }],
  [750, 'drone', -3, 2],
  [765, 'popup', -7, 3, { period: 3.3, duty: 0.6 }],
  [782, 'drone', 2.5, 1],
  [790, 'popup', 6.5, 2, { period: 4.4, duty: 0.6 }],
  [808, 'drone', -2, 3],
  [825, 'popup', 6, 3, { period: 4.8, duty: 0.6 }],
  [835, 'drone', 3, 1.5],
  [850, 'popup', -5.5, 1.5, { period: 3.0, duty: 0.6 }],
  [862, 'drone', -2.5, 1],
  [875, 'popup', 5, 2.5, { period: 3.3, duty: 0.6 }],
].map(([at, target, dx, dy, extra]) => railSpawn(at, target, dx, dy, extra));

// departure corridor: 10 generous near-rail crates between the launch gates
const crateSpawns = [
  [16, -2.5, 0.6], [30, 2.5, 1.0], [44, -3, 0.2], [58, 3.2, 1.3], [72, -2.2, 0.8],
  [88, 2.8, 0.4], [104, -3.2, 1.1], [120, 2.2, 0.7], [136, -2.6, 1.4], [152, 3, 0.9],
].map(([at, dx, dy]) => railSpawn(at, 'crate', dx, dy));

export const EVENTS = [
  { at: 0, type: 'beat', name: 'departure' },
  ...crateSpawns,
  { at: 180, type: 'beat', name: 'asteroids' },
  ...fieldSpawns,
  { at: 540, type: 'beat', name: 'derelict' },
  ...derelictSpawns,
  { at: 900, type: 'beat', name: 'boss' },
  { at: 1170, type: 'beat', name: 'tally' },
  { at: 1250, type: 'end' },
];

export const RIDE = { speed: SPEED, waypoints: WAYPOINTS, events: EVENTS };

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return obj;
}

Object.freeze(WAYPOINTS);
WAYPOINTS.forEach((w) => Object.freeze(w));
deepFreeze(EVENTS);
deepFreeze(RIDE);
