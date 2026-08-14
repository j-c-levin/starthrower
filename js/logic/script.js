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
    return { x: 18 * Math.sin(f * Math.PI * 2), y: Y, z }; // two gentle S-bends
  });
}

// sweeps out to one side of the derelict, then drifts back in line with the boss circle's entry
function derelict(exitX, z1) {
  const z0 = -540;
  return range(z0, z1).map((z) => {
    const f = (z - z0) / (z1 - z0);
    const bulge = Math.sin(Math.min(1, f / 0.7) * Math.PI);
    return { x: 30 * bulge + exitX * f, y: Y, z };
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

// placeholder densities — Tasks 15/16 author the full beat content
const fieldSpawns = [
  [200, 'asteroid', -4, 0.2], [222, 'asteroid', 3.5, 1.2], [244, 'asteroid', -2.5, 0.6],
  [262, 'drone', 2, 0.8],
  [280, 'asteroid', 5, -0.4], [300, 'asteroid', -5, 0.9],
  [322, 'drone', -2.5, 1.1],
  [340, 'asteroid', 2.5, 0.3], [362, 'asteroid', -3, 1.4], [384, 'asteroid', 4.5, -0.2],
  [404, 'drone', 2.5, 0.6],
  [424, 'asteroid', -4.5, 0.8], [444, 'asteroid', 3, 1.6], [466, 'drone', -2, 0.9],
  [486, 'asteroid', -2, 0.4], [508, 'asteroid', 4, 1.0],
].map(([at, target, dx, dy]) => railSpawn(at, target, dx, dy));

const popupSpawns = [
  [560, -2.5, 0.5, 4, 0.55], [608, 3, 0.1, 3.5, 0.5], [656, -3, 0.9, 4.5, 0.5],
  [704, 2.5, 0.3, 4, 0.6], [752, -2, 0.7, 3.5, 0.55], [815, 2, 1.1, 4.2, 0.5],
].map(([at, dx, dy, period, duty]) => railSpawn(at, 'popup', dx, dy, { period, duty }));

const crateSpawns = [
  { at: 20, x: -3, y: 1.6, z: -20 },
  { at: 45, x: 3, y: 2.4, z: -45 },
  { at: 70, x: -3.5, y: 1.8, z: -70 },
  { at: 95, x: 3.5, y: 2.6, z: -95 },
  { at: 120, x: -3, y: 2, z: -120 },
  { at: 145, x: 3, y: 2.2, z: -145 },
].map((c) => ({ at: c.at, type: 'spawn', target: 'crate', pos: [c.x, c.y, c.z] }));

export const EVENTS = [
  { at: 0, type: 'beat', name: 'departure' },
  ...crateSpawns,
  { at: 180, type: 'beat', name: 'asteroids' },
  ...fieldSpawns,
  { at: 540, type: 'beat', name: 'derelict' },
  ...popupSpawns,
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
