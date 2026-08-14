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
  { at: 540, type: 'beat', name: 'derelict' },
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
