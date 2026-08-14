# Starthrower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family WebXR rails shooter for Quest 2 — one authored space ride, throw-to-shoot via hand tracking, pure score-attack — deployed on GitHub Pages.

**Architecture:** Starcatcher's proven two-layer split: pure ES modules in `js/logic/` (spline, ride script playback, firing state machine, aim, scoring) tested in Node, thin A-Frame components in `js/` as glue. The whole ride is data keyed to distance along a rail spline. Object pooling everywhere; no entity creation mid-ride.

**Tech Stack:** A-Frame 1.7.1 (vendored), WebXR hand tracking, WebAudio synthesis, `node --test`. Zero npm dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-14-starthrower-design.md` — read it before starting any task.

**Model policy (from the user):** implementation subagents default to Sonnet; use Opus where a task is unusually intricate; use **Fable for any task that creates or reviews visuals** (Tasks 12, 15, 16, 17, and the visual half of 19 are flagged `[VISUAL — Fable]`).

## Global Constraints

Every task's requirements implicitly include these (all from the spec):

- Vendored A-Frame 1.7.1 only; **zero runtime network requests**; no npm dependencies; no build step.
- Glue files guard registration behind `if (typeof AFRAME !== 'undefined')` and never touch `THREE`/`window`/`document` at module top level — `scripts/check.mjs` imports every `js/**/*.js` in Node and must always pass.
- `js/logic/` modules import nothing from A-Frame/THREE/DOM — pure functions over plain objects.
- Object pooling: no `createElement`/`appendChild` after the hangar state; pools are built once at scene init.
- Transparency budget: only projectile glow, shatter/fizzle particles, and hands may alpha-blend. Everything else `shader: flat`, opaque.
- ≤ ~100 draw calls in the worst beat; static scenery per beat is merged geometry.
- Comfort rules are enforced by `test/validate.test.js`: constant rail speed, yaw rate ≤ 30°/s, pitch rate ≤ 10°/s, no roll, no reversals.
- Family safety: no flashing above 1Hz, no gore, no pure `#000000`/`#ff0000` as feature colors.
- A-Frame traps (do not rediscover): re-setting `animation__*` with identical data is a silent no-op — `removeAttribute` first; never name a component method `play()`/`pause()`; parent `visible=false` does not propagate to children's own flags — walk ancestors for hit-testing; `a-text` must use the vendored MSDF font with `negate: true`; `visibilitychange` resume paths must be gated on game state.
- Commits: conventional-commit style, one commit per green test cycle. Push over HTTPS (`gh auth setup-git` done); commit signing is off in-repo.

## File Structure

```
starthrower/
  index.html              — a-scene, lib includes, 2D landing overlay
  js/main.js              — imports every glue module (single script tag target)
  js/logic/spline.js      — Catmull-Rom + arc-length     (Task 2)
  js/logic/heights.js     — player height sampler        (Task 3)
  js/logic/firing.js      — throw detection state machine (Task 4)
  js/logic/aim.js         — aim ray, cone snap, sweep hit (Task 5)
  js/logic/scoring.js     — values, combo, best score    (Task 6)
  js/logic/params.js      — URL param parsing            (Task 11)
  js/logic/script.js      — THE RIDE AS DATA             (Task 9, refined 15-17)
  js/logic/validate.js    — script/comfort validation    (Task 9)
  js/logic/ride.js        — distance-driven playback     (Task 10)
  js/palette.js           — color tokens (pure data)     (Task 7, refined by visual tasks)
  js/hands.js             — hand pose → firing.js glue   (Task 7)
  js/projectiles.js       — pooled bolts + hit tests     (Task 7)
  js/targets.js           — pooled targets + registry    (Task 7 minimal, Task 12 full)
  js/rail.js              — moves rig along spline       (Task 11)
  js/game.js              — state machine + debug hook   (Task 11)
  js/hud.js               — score readout + point pops   (Task 13)
  js/audio.js             — WebAudio synthesis           (Task 14)
  js/ambient.js           — per-beat scenery             (Tasks 15-16)
  js/boss.js              — Guardian phases + finale     (Task 17)
  js/tally.js             — count-up, best score, return (Task 18)
  js/sky.js               — space gradient + stars       (Task 15)
  js/input-watcher.js     — hand-absence prompt          (Task 19)
  lib/                    — aframe.min.js + MSDF font (vendored from starcatcher)
  scripts/check.mjs, scripts/serve.sh
  test/*.test.js
```

---

### Task 1: Repo scaffold and test harness

**Files:**
- Create: `package.json`, `.gitignore`, `.nojekyll`, `scripts/check.mjs`, `scripts/serve.sh`, `js/main.js`, `test/smoke.test.js`, `index.html`
- Copy: `lib/` from `/Users/joshuajosai-levin/Code/starcatcher/lib/` (aframe.min.js + fonts)

**Interfaces:**
- Produces: `npm test` = import-check all `js/**/*.js` in Node, then `node --test 'test/**/*.js'`. `sh scripts/serve.sh` serves on http://localhost:8472.

- [ ] **Step 1: Create files**

`package.json`:
```json
{
  "name": "starthrower",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node scripts/check.mjs && node --test 'test/**/*.js'"
  }
}
```
(Keep the glob quoted — the bare `node --test test/` directory form is broken on this machine's Node 22.14.)

`scripts/check.mjs`:
```js
import { readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = `${dir}/${f}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
})('js');
for (const f of files) await import(pathToFileURL(f));
console.log(`ok: imported ${files.length} modules`);
```

`scripts/serve.sh`:
```sh
#!/bin/sh
cd "$(dirname "$0")/.." && python3 -m http.server "${1:-8472}"
```

`js/main.js` (grows as glue modules are added):
```js
// Glue module imports are added here as they are created.
```

`test/smoke.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('harness runs', () => assert.equal(1 + 1, 2));
```

`index.html` (minimal; the 2D landing overlay is Task 19):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Starthrower</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="lib/aframe.min.js"></script>
  <script type="module" src="js/main.js"></script>
</head>
<body>
  <a-scene background="color: #0b1030" renderer="colorManagement: true">
    <a-entity id="rig" position="0 0 0">
      <a-entity id="head" camera position="0 1.6 0"></a-entity>
      <a-entity id="handL" hand-tracking-controls="hand: left"></a-entity>
      <a-entity id="handR" hand-tracking-controls="hand: right"></a-entity>
    </a-entity>
  </a-scene>
</body>
</html>
```

`.gitignore`: `node_modules/` and `.DS_Store`. `.nojekyll`: empty file.

- [ ] **Step 2: Copy vendored libs**

Run: `cp -R /Users/joshuajosai-levin/Code/starcatcher/lib /Users/joshuajosai-levin/Code/starthrower/lib`
Verify `lib/aframe.min.js` and the MSDF font files exist.

- [ ] **Step 3: Run `npm test` — expect PASS (1 smoke test, 1 imported module)**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold repo, test harness, vendored A-Frame"
```

---

### Task 2: Rail spline (`js/logic/spline.js`)

**Files:**
- Create: `js/logic/spline.js`, `test/spline.test.js`

**Interfaces:**
- Produces: `createSpline(points)` where `points` is `[{x,y,z}, ...]` (≥2), returning `{ length, pointAt(d), tangentAt(d) }`. `length` in metres; `pointAt` clamps `d` to `[0, length]` and returns `{x,y,z}`; `tangentAt` returns a normalized `{x,y,z}`.

- [ ] **Step 1: Write the failing test** (`test/spline.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpline } from '../js/logic/spline.js';

const close = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

test('straight line has correct length and midpoint', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }]);
  assert.ok(close(s.length, 100, 0.5));
  const mid = s.pointAt(50);
  assert.ok(close(mid.z, -50, 0.5) && close(mid.x, 0) && close(mid.y, 0));
});

test('pointAt clamps beyond ends', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }]);
  assert.ok(close(s.pointAt(-5).z, 0, 0.1));
  assert.ok(close(s.pointAt(999).z, -10, 0.1));
});

test('tangent is normalized and points along travel', () => {
  const s = createSpline([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }]);
  const t = s.tangentAt(50);
  assert.ok(close(Math.hypot(t.x, t.y, t.z), 1, 0.01));
  assert.ok(t.z < -0.99);
});

test('curved path length exceeds chord', () => {
  const s = createSpline([
    { x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: -30 }, { x: 0, y: 0, z: -60 },
  ]);
  assert.ok(s.length > 60);
});
```

- [ ] **Step 2: Run `node --test test/spline.test.js` — expect FAIL (module not found)**

- [ ] **Step 3: Implement** (`js/logic/spline.js`)

```js
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
    const a = pointAt(dist - 0.5), b = pointAt(dist + 0.5);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const m = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / m, y: dy / m, z: dz / m };
  }

  return { length, pointAt, tangentAt };
}
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): rail spline with arc-length parameterisation`

---

### Task 3: Height sampler (`js/logic/heights.js`)

**Files:**
- Create: `js/logic/heights.js`, `test/heights.test.js`

**Interfaces:**
- Produces: `createHeightSampler()` returning `{ addSample(y), stable(), count() }`. `stable()` = 90th-percentile of samples (behaves as max for few samples — the safe bias direction), `0` if no samples.

- [ ] **Step 1: Write the failing test** (`test/heights.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeightSampler } from '../js/logic/heights.js';

test('stable() is 0 with no samples', () => {
  assert.equal(createHeightSampler().stable(), 0);
});

test('stable() near the top of the sample distribution', () => {
  const s = createHeightSampler();
  for (let i = 0; i < 100; i++) s.addSample(1.5 + (i % 10) * 0.01);
  const v = s.stable();
  assert.ok(v >= 1.57 && v <= 1.6);
});

test('ignores absurd samples', () => {
  const s = createHeightSampler();
  s.addSample(1.6); s.addSample(0.05); s.addSample(9);
  assert.equal(s.count(), 1);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement** (`js/logic/heights.js`)

```js
export function createHeightSampler() {
  const samples = [];
  return {
    addSample(y) {
      if (typeof y === 'number' && y > 0.5 && y < 2.6) samples.push(y);
    },
    stable() {
      if (!samples.length) return 0;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
    },
    count: () => samples.length,
  };
}
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): player height sampler`

---

### Task 4: Throw detection (`js/logic/firing.js`) — the make-or-break module

**Files:**
- Create: `js/logic/firing.js`, `test/firing.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `throwThreshold(heightMetres)` → metres, `clamp(0.18 * h, 0.15, 0.40)`; `throwThreshold(0)` (unsampled) returns `0.25`.
  - `createHandTracker({ threshold, cooldownMs = 250 })` → `{ update(sample), state() }`.
  - `update({ headPos, handPos, confident = true, t })` (positions `{x,y,z}` world, `t` ms) returns `null` or a fire object `{ origin: headPos, through: smoothedHandPos }`.
  - Behavior: rolling baseline = min head-to-hand distance since last re-arm (updated on confident frames only). Fires when `dist - baseline > threshold` while armed and `t - lastFire >= cooldownMs`. `through` = average of the last ≤3 confident hand positions (so a low-confidence crossing frame still fires at the last good pose). After firing, re-arms when `dist <= fireDist - threshold / 2`.

- [ ] **Step 1: Write the failing test** (`test/firing.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throwThreshold, createHandTracker } from '../js/logic/firing.js';

const HEAD = { x: 0, y: 1.6, z: 0 };
const hand = (z, y = 1.4) => ({ x: 0.2, y, z });

test('threshold scales with height and clamps', () => {
  assert.equal(throwThreshold(1.8), 0.18 * 1.8);
  assert.equal(throwThreshold(0.6), 0.15);
  assert.equal(throwThreshold(2.5), 0.4);
  assert.equal(throwThreshold(0), 0.25);
});

function makeTracker() {
  return createHandTracker({ threshold: 0.3, cooldownMs: 250 });
}

test('fires after radial displacement exceeds threshold', () => {
  const tr = makeTracker();
  let fire = null;
  for (let i = 0; i <= 10; i++) {
    fire = tr.update({ headPos: HEAD, handPos: hand(-0.2 - i * 0.05), t: i * 20 });
    if (fire) break;
  }
  assert.ok(fire, 'should have fired');
  assert.equal(fire.origin, HEAD);
  assert.ok(fire.through.z < -0.3);
});

test('does not fire twice while extended; re-arms after pull-back', () => {
  const tr = makeTracker();
  let fires = 0, t = 0;
  const feed = (z) => { if (tr.update({ headPos: HEAD, handPos: hand(z), t: t += 20 })) fires++; };
  for (let z = -0.2; z > -0.75; z -= 0.05) feed(z);
  assert.equal(fires, 1);
  for (let i = 0; i < 10; i++) feed(-0.7);
  assert.equal(fires, 1, 'held-out arm must not refire');
  for (let z = -0.7; z < -0.3; z += 0.05) feed(z);
  t += 300;
  for (let z = -0.3; z > -0.75; z -= 0.05) feed(z);
  assert.equal(fires, 2, 'second throw after re-arm');
});

test('cooldown blocks immediate refire even if re-armed', () => {
  const tr = createHandTracker({ threshold: 0.1, cooldownMs: 250 });
  let fires = 0, t = 0;
  const feed = (z) => { if (tr.update({ headPos: HEAD, handPos: hand(z), t: t += 5 })) fires++; };
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let z = -0.2; z > -0.5; z -= 0.05) feed(z);
    for (let z = -0.5; z < -0.2; z += 0.05) feed(z);
  }
  assert.equal(fires, 1, 'rapid cycles inside cooldown fire once');
});

test('low-confidence crossing fires at last good smoothed pose', () => {
  const tr = makeTracker();
  let fire = null, t = 0;
  for (let z = -0.2; z > -0.4; z -= 0.05) {
    fire = tr.update({ headPos: HEAD, handPos: hand(z), confident: true, t: t += 20 });
  }
  assert.equal(fire, null);
  fire = tr.update({ headPos: HEAD, handPos: hand(-0.9), confident: false, t: t += 20 });
  assert.ok(fire, 'crossing on low-confidence frame still fires');
  assert.ok(fire.through.z > -0.5, 'aim pose comes from confident frames, not the jitter frame');
});

test('low-confidence frames do not lower the baseline', () => {
  const tr = makeTracker();
  let t = 0;
  tr.update({ headPos: HEAD, handPos: hand(-0.4), confident: true, t: t += 20 });
  tr.update({ headPos: HEAD, handPos: hand(-0.05), confident: false, t: t += 20 });
  const fire = tr.update({ headPos: HEAD, handPos: hand(-0.55), confident: true, t: t += 20 });
  assert.equal(fire, null, 'displacement measured from confident baseline only');
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement** (`js/logic/firing.js`)

```js
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
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): radial-displacement throw detection with pose smoothing`

---

### Task 5: Aim and hit-testing (`js/logic/aim.js`)

**Files:**
- Create: `js/logic/aim.js`, `test/aim.test.js`

**Interfaces:**
- Consumes: fire objects from Task 4 (`{origin, through}`).
- Produces:
  - `aimDirection(origin, through)` → normalized `{x,y,z}`.
  - `snapToTarget(origin, dir, targets, coneDeg)` → `{ dir, targetId }` where `targets` is `[{ id, pos: {x,y,z}, radius }]`; picks the smallest-angle live target within `coneDeg` of `dir` and returns the exact direction to its center, else returns the input `dir` with `targetId: null`.
  - `segmentHit(p0, p1, targets)` → `id` of the nearest target (by distance from `p0`) whose sphere the segment p0→p1 intersects, else `null`.

- [ ] **Step 1: Write the failing test** (`test/aim.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimDirection, snapToTarget, segmentHit } from '../js/logic/aim.js';

const O = { x: 0, y: 0, z: 0 };

test('aimDirection normalizes head-through-hand', () => {
  const d = aimDirection(O, { x: 0, y: 0, z: -2 });
  assert.deepEqual(d, { x: 0, y: 0, z: -1 });
});

test('snap picks nearest-angle target inside cone', () => {
  const targets = [
    { id: 'a', pos: { x: 0.5, y: 0, z: -10 }, radius: 0.5 },
    { id: 'b', pos: { x: 4, y: 0, z: -10 }, radius: 0.5 },
  ];
  const r = snapToTarget(O, { x: 0, y: 0, z: -1 }, targets, 6);
  assert.equal(r.targetId, 'a');
  assert.ok(r.dir.x > 0.01, 'direction snapped toward target center');
});

test('no snap outside cone', () => {
  const targets = [{ id: 'a', pos: { x: 5, y: 0, z: -10 }, radius: 0.5 }];
  const r = snapToTarget(O, { x: 0, y: 0, z: -1 }, targets, 6);
  assert.equal(r.targetId, null);
  assert.deepEqual(r.dir, { x: 0, y: 0, z: -1 });
});

test('segmentHit finds sphere on path, nearest first', () => {
  const targets = [
    { id: 'far', pos: { x: 0, y: 0, z: -20 }, radius: 1 },
    { id: 'near', pos: { x: 0, y: 0, z: -5 }, radius: 1 },
  ];
  assert.equal(segmentHit(O, { x: 0, y: 0, z: -30 }, targets), 'near');
  assert.equal(segmentHit(O, { x: 0, y: 0, z: -3 }, targets), null);
  assert.equal(segmentHit(O, { x: 10, y: 0, z: -30 }, targets), null);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement** (`js/logic/aim.js`)

```js
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
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): aim ray, cone snap, segment-sphere hit test`

---

### Task 6: Scoring (`js/logic/scoring.js`)

**Files:**
- Create: `js/logic/scoring.js`, `test/scoring.test.js`

**Interfaces:**
- Produces:
  - `TARGET_VALUES = { core: 0, crate: 10, asteroid: 25, drone: 50, popup: 50, weakpoint: 100 }`.
  - `createScore()` → `{ hit(type) → pointsAwarded, miss(), score(), multiplier(), streak(), reset() }`. Multiplier = `min(4, 1 + floor(streak / 5))`, applied to the value of the hit that increments the streak. `miss()` (projectile expired with no hit) resets streak to 0.
  - `loadBest(storage)` / `saveBest(storage, score)` — `storage` is any object with `getItem`/`setItem` (localStorage-shaped; testable with a plain fake). Key: `'starthrower.best'`. `saveBest` only writes if `score` beats the stored value; returns `true` if it wrote.

- [ ] **Step 1: Write the failing test** (`test/scoring.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_VALUES, createScore, loadBest, saveBest } from '../js/logic/scoring.js';

test('hit awards base value at x1', () => {
  const s = createScore();
  assert.equal(s.hit('asteroid'), 25);
  assert.equal(s.score(), 25);
});

test('multiplier steps at 5-hit streaks and caps at 4', () => {
  const s = createScore();
  for (let i = 0; i < 5; i++) s.hit('crate');
  assert.equal(s.multiplier(), 2);
  assert.equal(s.hit('crate'), 20);
  for (let i = 0; i < 30; i++) s.hit('crate');
  assert.equal(s.multiplier(), 4);
});

test('miss resets streak but not score', () => {
  const s = createScore();
  for (let i = 0; i < 6; i++) s.hit('crate');
  const before = s.score();
  s.miss();
  assert.equal(s.multiplier(), 1);
  assert.equal(s.score(), before);
});

test('best score round-trips through storage and only improves', () => {
  const store = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } };
  assert.equal(loadBest(store), 0);
  assert.equal(saveBest(store, 500), true);
  assert.equal(saveBest(store, 300), false);
  assert.equal(loadBest(store), 500);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement** (`js/logic/scoring.js`)

```js
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
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): scoring with combo multiplier and best-score persistence`

---

### Task 7: Firing spike glue — hands, projectiles, hangar core

The minimum in-headset experience: stand in a placeholder hangar, throw at a
glowing core, see bolts fly and the core flash on hit. This is what gets
device-tested at Task 8. Placeholder visuals only — the real art pass is
Tasks 12/15.

**Files:**
- Create: `js/palette.js`, `js/hands.js`, `js/projectiles.js`, `js/targets.js`
- Modify: `js/main.js` (import the new modules), `index.html` (add the core entity + a placeholder hangar box)

**Interfaces:**
- Consumes: `throwThreshold`/`createHandTracker` (Task 4), `aimDirection`/`snapToTarget`/`segmentHit` (Task 5), `createHeightSampler` (Task 3).
- Produces:
  - `js/palette.js` (pure data, no A-Frame): `export const PALETTE = { space: '#0b1030', violet: '#6a3fd4', cyan: '#4de3ff', magenta: '#ff5fd0', amber: '#ffc857', ink: '#f4f1ff' }` — initial tokens; visual tasks may refine values but not names.
  - Scene events: `fired` `{ origin, through, hand }`; `targethit` `{ id, type, point }`; `projectileexpired` `{ point }`.
  - `targets.js` registers scene component `target-manager` with methods `add({ id, el, type, radius })`, `remove(id)`, `active()` → `[{ id, pos, radius, type, el }]` (pos read fresh from `el.object3D.getWorldPosition` into a reused THREE.Vector3, returned as plain `{x,y,z}`). Also registers entity component `hit-target` (`type`, `radius` schema props) that self-registers on play and emits nothing itself — projectiles announce hits.
  - `projectiles.js` registers scene component `projectile-pool` (pool of 12 bolt entities; speed 40 m/s; max range 60m). On `fired`: snap via `snapToTarget(origin, dir, targetManager.active(), 7)`, launch bolt from `origin` nudged 0.3m along dir. Each tick sweeps `segmentHit(prevPos, newPos, active())`; on hit emits `targethit` and releases; past range emits `projectileexpired` at final point and releases.
  - `hands.js` registers component `hand-thrower` (`hand: left|right`) placed on the two hand entities: per-tick reads head + hand world positions, `confident` = hand entity's `object3D.visible` after an ancestor walk, feeds `createHandTracker`, emits `fired` on trigger. Threshold comes from scene component `calibration` (also in `hands.js`): samples head height each tick while in hangar state via `createHeightSampler`, exposes `threshold()` = `throwThreshold(sampler.stable())`. Trackers are re-created when the threshold changes by > 2cm.
  - Desktop dev input (in `hands.js`): if `?desktop` in URL, a click listener emits `fired` with origin = camera world position, through = origin + camera world direction (so click-to-fire works with no headset).

- [ ] **Step 1: Write the glue modules** — every file top-level-guarded:

```js
// pattern for every glue file
import { createHandTracker, throwThreshold } from './logic/firing.js';
function register() {
  AFRAME.registerComponent(/* ... */);
}
if (typeof AFRAME !== 'undefined') register();
```

Bolt pool entities: `a-entity` with `geometry="primitive: sphere; radius: 0.12; segmentsWidth: 8; segmentsHeight: 6"`, `material="shader: flat; color: #4de3ff; transparent: true; opacity: 0.9"` (inside the transparency budget). Reuse one `THREE.Vector3` per component instance for world-position reads — never allocate in tick.

Add to `index.html` inside the scene: `<a-entity id="core" hit-target="type: core; radius: 0.6" geometry="primitive: sphere; radius: 0.5" material="shader: flat; color: #ffc857" position="0 1.6 -6"></a-entity>` plus a placeholder hangar: one `a-box` shell `material="shader: flat; color: #1a2050; side: back"` scaled ~`12 12 20`. On `targethit` for the core, flash it (remove-then-set an `animation__flash` scale pulse — remember the identical-data no-op trap).

Attach `hand-thrower` to `#handL`/`#handR`, `projectile-pool`, `target-manager`, `calibration` to the scene. Add all new modules to `js/main.js` imports.

- [ ] **Step 2: Run `npm test` — expect PASS (check.mjs imports the new glue in Node without error)**

- [ ] **Step 3: Desktop smoke test** — `sh scripts/serve.sh`, open `http://localhost:8472/?desktop`, click: a bolt flies from the camera and the core flashes when aimed at it. Verify in the browser console that repeated clicks reuse pooled bolts (no node count growth). Playwright MCP may be used for this check if available.

- [ ] **Step 4: Commit** — `feat: firing pipeline glue — hands, pooled projectiles, hangar core`

---

### Task 8: Deploy + MILESTONE ZERO device checkpoint (hard gate)

**Files:** none (operations + possible tuning edits to `js/logic/firing.js` constants)

- [ ] **Step 1: Create the GitHub repo and push**

```bash
gh repo create starthrower --public --source . --push
gh api repos/{owner}/starthrower/pages -X POST -f 'source[branch]=main' -f 'source[path]=/' || gh api repos/{owner}/starthrower/pages -X PUT -f 'source[branch]=main' -f 'source[path]=/'
```

Wait for Pages to build (`gh api repos/{owner}/starthrower/pages` → status), then verify the site loads over HTTPS.

- [ ] **Step 2: STOP — ask the user to test throw feel on the Quest 2**

This is the spec's milestone-zero gate. The user opens the Pages URL in the
headset browser, enters VR, and throws at the core. Questions for them:
does an overhand throw fire reliably? A sidearm throw? Does a held-out arm
stay quiet? Does it re-arm naturally? Any double-fires or ghost-fires?

- [ ] **Step 3: Tune from feedback** — adjust the 0.18 height factor, 15–40cm clamps, re-arm fraction, or cooldown in `js/logic/firing.js`; update `test/firing.test.js` expectations to the tuned numbers; `npm test`; commit each tuning round as `tune(firing): <what changed and why>` and push for re-test.

**Do not proceed to Task 9 until the user says the throw feels right.**

---

### Task 9: The ride as data (`js/logic/script.js`) + comfort validation (`js/logic/validate.js`)

**Files:**
- Create: `js/logic/script.js`, `js/logic/validate.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: `createSpline` (Task 2).
- Produces:
  - `script.js` exports `SPEED = 6` (m/s), `WAYPOINTS` (array of `{x,y,z}`), `EVENTS` (array sorted by `at` metres), and `RIDE = { speed: SPEED, waypoints: WAYPOINTS, events: EVENTS }`.
  - Event shapes (the complete set — later tasks add *instances*, never new shapes without updating `validate.js`):
    - `{ at, type: 'beat', name: 'departure' | 'asteroids' | 'derelict' | 'boss' | 'tally' }`
    - `{ at, type: 'spawn', target: 'crate' | 'asteroid' | 'drone' | 'popup', pos: [x, y, z] }` (world coords; `popup` also has `period` seconds and `duty` 0–1)
    - `{ at, type: 'bossphase', phase: 1 | 2 | 3 }`
    - `{ at, type: 'end' }` (exactly one, last)
  - `validate.js` exports `validateRide(ride)` → array of error strings (empty = valid). Checks: ≥2 waypoints; events sorted by `at`; exactly one `end` as the final event; every `at` within `[0, spline.length]`; every spawn `pos` within 45m of the rail point at its `at`; comfort — sampling the spline every metre at `speed`: yaw rate ≤ 30°/s, pitch rate ≤ 10°/s, no reversals (tangent dot previous tangent > 0); beats appear in spec order.
  - Initial content (refined by Tasks 15–17 which must keep `validateRide` green): a straight departure corridor 0→180m with 6 crate spawns; beat markers at 0 (departure), 180 (asteroids), 540 (derelict), 900 (boss), 1170 (tally); `end` at 1250. Waypoints: gentle S-curves through the asteroid span, a sweep past one side for the derelict, a wide circle (radius ≥ 20m) around `[0, 2, -1050]` for the boss, straightening out for the tally. Author enough waypoints that validation passes — at 6 m/s a 30°/s yaw cap means turn radius ≥ ~11.5m.

- [ ] **Step 1: Write the failing test** (`test/validate.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIDE, SPEED } from '../js/logic/script.js';
import { validateRide } from '../js/logic/validate.js';

test('the shipped ride validates clean', () => {
  assert.deepEqual(validateRide(RIDE), []);
});

test('validator catches a hairpin', () => {
  const bad = { speed: SPEED, events: [{ at: 0, type: 'end' }], waypoints: [
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -20 }, { x: 1, y: 0, z: -2 },
  ] };
  assert.ok(validateRide(bad).some((e) => /yaw|revers/i.test(e)));
});

test('validator catches unsorted and missing end', () => {
  const wp = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -100 }];
  assert.ok(validateRide({ speed: 6, waypoints: wp, events: [
    { at: 50, type: 'beat', name: 'departure' }, { at: 10, type: 'end' },
  ] }).length > 0);
  assert.ok(validateRide({ speed: 6, waypoints: wp, events: [
    { at: 10, type: 'beat', name: 'departure' },
  ] }).some((e) => /end/.test(e)));
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `validate.js`, then author `script.js` until the shipped ride validates clean.** `validateRide` builds the spline itself via `createSpline(ride.waypoints)`; the yaw/pitch check walks `tangentAt(d)` per metre: `angle = acos(clamp(dot(t0, t1), -1, 1))`, rate = `angle * speed` in °/s.

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): ride script data and comfort validation`

---

### Task 10: Ride playback (`js/logic/ride.js`)

**Files:**
- Create: `js/logic/ride.js`, `test/ride.test.js`

**Interfaces:**
- Consumes: `RIDE` shape from Task 9.
- Produces: `createRide(ride)` → `{ advance(dtMs) → dueEvents[], distance(), done() }`. Distance advances at `ride.speed * dt`; `advance` returns every not-yet-emitted event with `at <= distance` in order; `done()` true once the `end` event has been emitted. Spawn events are emitted **40m early** (`at - 40`) so targets are in place before the rig arrives; all other events emit at their `at`.

- [ ] **Step 1: Write the failing test** (`test/ride.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRide } from '../js/logic/ride.js';

const ride = { speed: 10, waypoints: [], events: [
  { at: 5, type: 'beat', name: 'departure' },
  { at: 60, type: 'spawn', target: 'crate', pos: [0, 0, -60] },
  { at: 100, type: 'end' },
] };

test('events emit once, in order, at distance', () => {
  const r = createRide(ride);
  assert.deepEqual(r.advance(400), []);           // 4m
  const first = r.advance(400);                    // 8m
  assert.equal(first.length, 1);
  assert.equal(first[0].type, 'beat');
  assert.deepEqual(r.advance(100), []);            // no repeats
});

test('spawns emit 40m early', () => {
  const r = createRide(ride);
  const due = r.advance(2100);                     // 21m — spawn at=60 due from 20m
  assert.ok(due.some((e) => e.type === 'spawn'));
});

test('ride completes exactly once', () => {
  const r = createRide(ride);
  const all = r.advance(60000);
  assert.equal(all.filter((e) => e.type === 'end').length, 1);
  assert.ok(r.done());
  assert.deepEqual(r.advance(1000), []);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement** (`js/logic/ride.js`)

```js
export function createRide(ride) {
  const queue = ride.events
    .map((e) => ({ e, due: e.type === 'spawn' ? Math.max(0, e.at - 40) : e.at }))
    .sort((a, b) => a.due - b.due);
  let distance = 0, cursor = 0, done = false;
  return {
    advance(dtMs) {
      if (done) return [];
      distance += (ride.speed * dtMs) / 1000;
      const out = [];
      while (cursor < queue.length && queue[cursor].due <= distance) {
        out.push(queue[cursor].e);
        if (queue[cursor].e.type === 'end') { done = true; }
        cursor += 1;
        if (done) break;
      }
      return out;
    },
    distance: () => distance,
    done: () => done,
  };
}
```

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `feat(logic): distance-driven ride playback`

---

### Task 11: Rail movement + game state machine (`js/rail.js`, `js/game.js`, `js/logic/params.js`)

**Files:**
- Create: `js/logic/params.js`, `test/params.test.js`, `js/rail.js`, `js/game.js`
- Modify: `js/main.js` (imports), `index.html` (attach `game-manager` to the scene)

**Interfaces:**
- Consumes: `createSpline`, `RIDE`, `createRide`, `createScore`, `loadBest`, `saveBest`, `calibration` (Task 7), scene events from Task 7.
- Produces:
  - `parseParams(search)` (pure, in `js/logic/params.js`) → `{ desktop: bool, dist: number|0, speed: number|1 }` from a `location.search` string. Test: `parseParams('?desktop&dist=800&speed=8')` → `{ desktop: true, dist: 800, speed: 8 }`; empty string → defaults.
  - `game-manager` scene component — THE orchestrator:
    - States `'hangar' | 'riding' | 'tally'`; exposed as `this.state`.
    - Hangar: rig parked at origin; `calibration` sampling; core hit (`targethit` with `type === 'core'`) → `score.reset()`, state `'riding'`, emit scene event `ridestarted`.
    - Riding: each tick `ride.advance(dt * params.speed)`; route events: `spawn` → emit `spawntarget` (Task 12 consumes); `beat` → emit `beatchanged { name }`; `bossphase` → emit `bossphase { phase }`; `end` → state `'tally'`, emit `ridedone { score, best, newBest }` (after `saveBest(localStorage, score)`).
    - `targethit` (non-core) → `score.hit(type)`, re-emit `scored { points, score, multiplier, point }`; `projectileexpired` → `score.miss()`, emit `combobroken { point }`.
    - `tallydone` (from Task 18) → rebuild `createRide`, rig to origin, state `'hangar'`.
    - `visibilitychange` handler: on hide, emit `gamehidden`; on show, emit `gameshown { state: this.state }` — **audio (Task 14) gates its resume on `state === 'riding'`** (this closes starcatcher's parked bug).
    - `?dist=` jump: on `ridestarted`, pre-`advance` the ride to `dist` metres in one call and fast-forward the rig (dev tool).
    - Debug hook: `window.__starthrower = { get state, get score, get distance, pressCore(), fire(dir) }` (assigned inside component `init`, never at module top level).
  - `rail-mover` component (in `js/rail.js`) on `#rig`: builds `createSpline(RIDE.waypoints)` once; while riding sets rig position to `pointAt(distance)` and yaw from `tangentAt` (`Math.atan2(-t.x, -t.z)` for A-Frame's -Z forward), lerping yaw at ≤ the validated rate; pitch/roll left at 0 (comfort: the rail may climb but the rig stays level).

- [ ] **Step 1: Write the failing params test, run it (FAIL), implement `parseParams`, run (PASS)**

`test/params.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseParams } from '../js/logic/params.js';

test('parses debug params', () => {
  assert.deepEqual(parseParams('?desktop&dist=800&speed=8'),
    { desktop: true, dist: 800, speed: 8 });
});

test('defaults with empty or junk input', () => {
  assert.deepEqual(parseParams(''), { desktop: false, dist: 0, speed: 1 });
  assert.deepEqual(parseParams('?dist=abc&speed=-2'),
    { desktop: false, dist: 0, speed: 1 });
});
```

`js/logic/params.js`:
```js
export function parseParams(search) {
  const q = new URLSearchParams(search || '');
  const num = (k, fallback) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return { desktop: q.has('desktop'), dist: num('dist', 0), speed: num('speed', 1) };
}
```

- [ ] **Step 2: Write `rail.js` and `game.js` per the interfaces above; add imports; attach `game-manager` and `rail-mover` in `index.html`**

- [ ] **Step 3: Run `npm test` — expect PASS (params test + import check)**

- [ ] **Step 4: Desktop smoke** — `?desktop`: click the core → the camera glides down the corridor, crate spawns appear in console (`document.querySelector('a-scene').addEventListener('spawntarget', console.log)`), the run reaches tally state (`__starthrower.state`) and returns to hangar. `?desktop&dist=1200&speed=8` jumps near the end and finishes in seconds.

- [ ] **Step 5: Commit** — `feat: rail movement and game state machine`

---

### Task 12: Full target system + shatter feedback `[VISUAL — Fable]`

**Files:**
- Modify: `js/targets.js` (from Task 7 minimal to full), `index.html` (pool container), `js/palette.js` (refine values if needed — names are fixed)

**Interfaces:**
- Consumes: `spawntarget { target, pos, period?, duty? }`, `targethit`, `combobroken` (Task 11); `target-manager`/`hit-target` from Task 7.
- Produces:
  - `target-manager` gains `spawn(event)` (routes `spawntarget`) and pools: 8 crates, 12 asteroids, 8 drones, 8 popups, 9 weakpoints (weakpoint pool used by Task 17 via `spawnWeakpoint({ id, pos })` and `retireAll('weakpoint')`).
  - Behaviors (in `targets.js` tick, no per-entity timers): drones bob and dart ±1.5m around their spawn pos (sinusoidal, precomputed phase); popups scale between 0.05 and 1 following `period`/`duty` (hit only registrable while up — `hit-target` gets an `active` flag the manager toggles and `target-manager.active()` filters on).
  - On `targethit`: release the target, play a shatter burst at `point` from a pooled particle set (one burst pool of 3 × 12 flat-shaded shards, animated outward in tick, ≤ 700ms, inside the transparency budget). On `combobroken`: a small grey-blue fizzle puff at `point` from the same pool, visually distinct (drooping, not bursting).
  - Every target type visually distinct at 40m: crate = amber-panelled box; asteroid = violet crystal cluster (icosahedron composite); drone = cyan winged octahedron; popup = magenta ringed panel; weakpoint = pulsing amber orb (pulse ≤ 1Hz).
- **Creative freedom** within: palette token names, transparency budget, ≤ 40 draw calls for the entire target+particle system, flat shading, no pure black/red, nothing moves *toward* the player.

- [ ] **Step 1: Implement pools, behaviors, shatter/fizzle**
- [ ] **Step 2: `npm test` passes (import check); desktop smoke: full `?desktop` run shows crates spawning, hits shatter, misses fizzle**
- [ ] **Step 3: Verify draw calls in desktop devtools: `document.querySelector('a-scene').renderer.info.render.calls` ≤ 100 mid-asteroid-field**
- [ ] **Step 4: Commit** — `feat: pooled target menagerie with shatter and fizzle feedback`

---

### Task 13: HUD (`js/hud.js`)

**Files:**
- Create: `js/hud.js`
- Modify: `js/main.js`, `index.html` (HUD entities under `#rig`)

**Interfaces:**
- Consumes: `scored { points, score, multiplier, point }`, `combobroken`, `ridestarted`, `ridedone`, game state.
- Produces: `hud` component on a rig child at `0 1.1 -1.6` (low in view, rides with the rig): score digits (`a-text`, vendored MSDF font, `negate: true`, ink color, width ~1); multiplier chip beside it ("×2/×3/×4", hidden at ×1, color steps through palette cyan→magenta→amber). Point pops: pool of 6 `a-text` entities world-positioned at the hit `point`, floating up 0.5m and fading over 600ms (remove-then-set animation idiom), showing `+{points}`. HUD hidden in hangar and tally states.

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop smoke (score visibly counts, pops appear at hits); Step 3: Commit** — `feat: in-ride HUD with point pops and combo chip`

---

### Task 14: Audio (`js/audio.js`) — synthesized, zero files

Recommended model: Opus (intricate WebAudio graph work, not visual).

**Files:**
- Create: `js/audio.js`; Modify: `js/main.js`

**Interfaces:**
- Consumes: `fired`, `scored`, `combobroken`, `beatchanged`, `bossphase`, `ridestarted`, `ridedone`, `gamehidden`, `gameshown { state }`.
- Produces: `audio-director` scene component. One `AudioContext` created on first user gesture (core hit or click — Quest browser blocks earlier). All synthesis, no samples:
  - Throw whoosh on `fired`: filtered noise burst, 150ms, band-pass sweep 400→2000Hz.
  - Hit chime on `scored`: two-oscillator pluck; pitch rises with multiplier (root, +4th, +octave, +octave+4th for ×1..×4) on a pentatonic root so overlaps never clash.
  - Fizzle on `combobroken`: short descending triangle blip, quiet.
  - Music: hangar = sparse ambient pad (two detuned saws through a lowpass, slow LFO); each beat adds a layer (asteroids: arpeggio; derelict: sub pulse; boss: rhythmic stabs; tally: resolve to the pad). Layer mix changes on `beatchanged`, crossfaded over 2s with gain ramps (`linearRampToValueAtTime` — never instant, no clicks).
  - Boss finale on `bossphase` 3 completion → listen for `bossdefeated` (Task 17): low rumble swell, 3s.
  - `gamehidden` → suspend the context. `gameshown` → resume ONLY if `state === 'riding'` or `'tally'`; in hangar wait for the next user gesture (the starcatcher parked-bug fix, spec-mandated).
- All scheduling against `AudioContext.currentTime`; no `setTimeout` for musical timing.

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop smoke (sounds on click-fire and hits; music layers change across `?desktop&speed=8` run); Step 3: Commit** — `feat: synthesized audio director`

---

### Task 15: Beat content — hangar, departure, asteroid field + sky `[VISUAL — Fable]`

**Files:**
- Create: `js/ambient.js`, `js/sky.js`
- Modify: `js/logic/script.js` (real waypoints + spawn events for 0–540m), `index.html`, `js/main.js`

**Interfaces:**
- Consumes: `beatchanged`, `RIDE` shapes (Task 9 — no new event shapes; `validateRide` must stay green).
- Produces:
  - `sky.js`: `space-sky` component — a large inverted sphere with a custom flat gradient shader (deep space navy→violet horizon glow) + a merged starfield of ~800 stars as ONE `THREE.Points` object (single draw call), subtle slow rotation. Stars are point sprites, right way up by construction.
  - `ambient.js`: `ambient-director` scene component owning static scenery, all **merged geometry** — build each beat's scenery by merging BufferGeometries into ≤ 3 meshes per beat (hangar interior: ribbed walls, gantry, glow strips; asteroid field: ~40 non-target background asteroids scattered ≥ 10m off-rail; distant nebula billboards: flat-shaded, opaque). Scenery for a beat becomes visible on `beatchanged` (and the next beat's pre-warmed); everything positioned in world space along the authored rail.
  - `script.js` gains the real spawn content: ~10 crates in the departure corridor (generous, near-rail), ~25 asteroids + ~8 drones through 180–540m with density ramping, S-curve waypoints (validation-clean).
- **Creative brief:** the hangar should feel like a real place you launch *from* (the core reads as machinery, the exit reads as a door to space); the asteroid field should feel deep — parallax layers, scale contrast. Budgets: ≤ 100 draw calls worst case, transparency budget, ≤ 30°/s yaw on any waypoint edit, nothing ambient moves toward the player. Palette tokens only.

- [ ] **Step 1: Implement sky + hangar + departure + asteroid scenery and script content**
- [ ] **Step 2: `npm test` (validation must pass on the new waypoints); desktop run-through of 0–540m; draw-call check ≤ 100**
- [ ] **Step 3: Commit** — `feat: sky, hangar, departure and asteroid-field beats`

---

### Task 16: Beat content — the derelict `[VISUAL — Fable]`

**Files:**
- Modify: `js/ambient.js` (derelict scenery), `js/logic/script.js` (waypoints + events 540–900m)

**Interfaces:**
- Consumes/Produces: same shapes as Task 15. Popup spawn events use `{ period: 3–5, duty: 0.4–0.6 }`.
- Produces: a wrecked colossal ship the rail threads through/alongside — hull as ≤ 3 merged meshes (broken ribs, hull plates, glowing breach lines in palette amber/magenta), ~12 popup targets in windows and hull gaps timed so several are up at any pass, plus ~6 drones weaving in breaches.
- **Creative brief:** scale awe — the wreck should dwarf the player; occlusion drama — targets revealed as structure sweeps past. Same budgets as Task 15; rail stays validation-clean (pitch ≤ 10°/s if the rail dives through a breach).

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop run of 540–900m (`?desktop&dist=500&speed=4`) + draw-call check; Step 3: Commit** — `feat: derelict beat`

---

### Task 17: The Guardian boss (`js/boss.js`) `[VISUAL — Fable]`

**Files:**
- Create: `js/boss.js`
- Modify: `js/logic/script.js` (bossphase events at 900/990/1080, boss-circle waypoints), `js/main.js`, `index.html`

**Interfaces:**
- Consumes: `bossphase { phase }`, `targethit` (weakpoint type), `beatchanged`; `target-manager.spawnWeakpoint`/`retireAll` (Task 12).
- Produces: `guardian` component — a large geometric sentinel (~12m) at `[0, 2, -1050]` (the rail circles it at radius ≥ 20m):
  - Phase N opens a ring of 3 weakpoints (spawned via `spawnWeakpoint` at rotating anchor points on the construct). All 3 destroyed → phase advances early (emit `bossphase { phase: N+1 }` locally); otherwise the ride's scripted `bossphase` event advances it anyway — **destroyed-early phases must not double-advance: `guardian` tracks `currentPhase` and ignores stale events.**
  - Phase transitions: construct visibly reconfigures (rotating segments, remove-then-set animations, ≤ 1Hz pulses).
  - After phase 3 (destroyed or timed out): emit `bossdefeated`, run the finale — slow break-apart of pooled debris chunks drifting outward over ~5s (opaque, flat-shaded, drifting AWAY from the rail — never toward the player) as the rig sails through.
- **Creative brief:** imposing but not scary — a monumental machine, not a monster. Amber weakpoints must read instantly. Budgets as ever; boss + debris ≤ 25 draw calls.

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop run (`?desktop&dist=880&speed=2`) — weakpoints appear, hitting all 3 advances early, timeout also advances, finale plays, ride reaches tally either way; Step 3: Commit** — `feat: Guardian boss with early-advance phases and finale`

---

### Task 18: Tally (`js/tally.js`)

**Files:**
- Create: `js/tally.js`; Modify: `js/main.js`, `index.html`

**Interfaces:**
- Consumes: `ridedone { score, best, newBest }` (Task 11).
- Produces: `tally` component: calm starfield drift (rig continues along the final straight rail section); big `a-text` digits count up from 0 to `score` over ~3s (eased, tick-driven — no per-digit entities beyond one text), then `BEST: {best}` beneath; if `newBest`, a starburst flourish (pooled, reuses Task 12's shatter pool at celebratory scale) and the best line pulses once. After 10s (or a core-style poke on a "AGAIN" orb — same `hit-target` mechanism, poke or throw both work), emit `tallydone`. Zero-score runs show "0" without ceremony and still return.

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop full loop: ride → tally → auto-return to hangar → core still works for a second run (pools reset — verify no dead targets linger via `target-manager.active()` empty in hangar); Step 3: Commit** — `feat: tally with count-up, best-score flourish, loop to hangar`

---

### Task 19: Input watcher, landing overlay, README `[landing overlay VISUAL — Fable]`

**Files:**
- Create: `js/input-watcher.js`; Modify: `index.html` (2D overlay + poke fallback wiring), `README.md`, `js/main.js`

**Interfaces:**
- Consumes: game state; hand entity visibility.
- Produces:
  - `input-watcher` scene component: if no hand has been tracked for 6s while in VR (any state — the ride never pauses for it), show a gentle floating waving-hand prompt 2m ahead at head height (flat-shaded hand shape + `a-text` "turn on hand tracking in settings", vendored font); hide the moment a hand appears. In the hangar the prompt also mentions the poke fallback.
  - Core poke fallback: the hangar core (and tally AGAIN orb) also fires on direct touch — `hit-target` gains a `pokeable` flag; when a tracked hand's world position comes within `radius` of a pokeable target, treat as a hit (walk ancestor visibility before testing).
  - 2D landing overlay in `index.html`: title "STARTHROWER", one-line grown-up setup note (enable hand tracking in Quest settings), and A-Frame's default Enter VR button styled to match the palette. Overlay hides on `enter-vr`.
  - `README.md`: what it is, grown-up setup (boundary space, hand tracking on, browser URL), development section (`npm test`, `scripts/serve.sh`, `?desktop&dist=&speed=` debug params).

- [ ] **Step 1: Implement; Step 2: `npm test` + desktop smoke (overlay shows/hides; poke fallback testable by moving a mock hand via `__starthrower`); Step 3: Commit** — `feat: hand-absence prompt, poke fallback, landing overlay`

---

### Task 20: Final review, repo docs, device playtest gate

**Files:**
- Create: `CLAUDE.md` (repo root)
- Modify: anything the review finds

- [ ] **Step 1: Full `npm test`; full desktop run at 1×; draw-call audit at each beat (≤ 100)**
- [ ] **Step 2: Requesting-code-review pass against spec + plan** (superpowers:requesting-code-review) — verify every spec section has shipped: radial firing, clamps, smoothing, snap-at-spawn, combo+fizzle, comfort validation, budgets, poke fallback, visibilitychange gating, zero-fire tally, auto-return loop, zero network requests (check devtools network panel: only same-origin)
- [ ] **Step 3: Write repo `CLAUDE.md`** in starcatcher's style: what this is, commands, debug params + `__starthrower` hook, architecture map, conventions, the A-Frame trap list, deploy notes (Pages = push main, HTTPS push), and a "known parked items" section for anything deferred
- [ ] **Step 4: Push, verify the live Pages site, then STOP — ask the user for the full on-device playtest** (throw feel across the whole ride, comfort through the S-curves and boss circle, perf: no dropped frames in the asteroid field). Tuning rounds from feedback follow the Task 8 pattern: tune → test → commit → push → re-test.

---

## Verification checklist (run after all tasks)

- `npm test` green; every logic module has tests; check.mjs imports every glue file.
- Desktop: two consecutive full ride loops with no console errors and no node-count growth between loops.
- Draw calls ≤ 100 at the worst beat; only bolts/particles/hands alpha-blend.
- `validateRide(RIDE)` returns `[]` — and try bending one waypoint into a hairpin to confirm the test would actually catch it, then revert.
- No network requests beyond same-origin; no `#000000`/`#ff0000` feature colors; nothing flashes > 1Hz.
- User has signed off throw feel (Task 8) AND the full-ride playtest (Task 20).
