# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Starthrower: a family WebXR rails shooter for Meta Quest 2, hand-tracking
only — no controllers, no buttons. An overhand (or any) throwing motion fires
a star-bolt along the line of your arm. One authored ride, ~1250m at 6m/s
(~3.5 minutes), entirely distance-keyed so every run is identical: **hangar**
(menu, poke or throw-at-the-core to launch) → **departure** (~30s warm-up
crates) → **asteroid field** (~60s, asteroids + drones) → **the derelict**
(~60s, a wrecked colossal ship, popup targets on timers) → **the Guardian**
(boss, three weak-point-ring phases, always ends) → **tally** (score count-up,
best-score in localStorage, auto-returns to hangar). Pure score-attack:
nothing can damage the player and the ride always completes, even at 0 score.
Live at https://j-c-levin.github.io/starthrower/ (GitHub Pages, `main` root).

Design authority: `docs/superpowers/specs/2026-08-14-starthrower-design.md`.
Implementation plan (with per-task history): `docs/superpowers/plans/2026-08-14-starthrower.md`.
Full task-by-task ledger (rulings, review outcomes, deferred items — read this
before touching anything, it's the actual memory of how this repo got built):
`.superpowers/sdd/2026-08-14-starthrower/progress.md`.

**Aim model note:** the spec's original firing design (radial-displacement
trigger, unchanged) shipped as written, but the *aim* section was rewritten
after on-device testing (Task 8 in the ledger). Two earlier aim models failed
the headset test — head-through-hand rays slant downward (hands sit below the
head), and motion-path aim (differentiating hand position over time) scatters
because Quest 2 hand-tracking degrades mid-throw. The shipped model is **arm
ray**: at the fire instant only, a virtual shoulder is estimated (below/beside
the head, offsets scaled to sampled player height, rotated with head yaw) and
the bolt flies shoulder→hand, fixed speed, no differentiation, **no aim
assist** (snap-to-target was tried and removed on user's device feedback).
Pure geometry at one instant — hand-tracking jitter during the swing cannot
scatter it. See `js/logic/aim.js` (`armRayDir`, `armOffsets`) and
`js/hands.js`'s `hand-thrower` component.

## Commands

- `npm test` — `node scripts/check.mjs` (imports every `js/**/*.js` in Node,
  catching load/syntax errors in the A-Frame glue files) then
  `node --test 'test/**/*.js'`. **Keep the glob** — the bare `node --test
  test/` directory form is broken on this machine's Node 22.14 and silently
  runs nothing.
- Single test file: `node --test test/firing.test.js`
- `sh scripts/serve.sh [port]` — static server, default port 8472 (no build
  step; ES modules don't load from `file://`). **Use a fresh port after
  editing code** — Chrome caches the module graph per origin, and a reused
  port served stale JS during T17 in-browser verification. Kill the old
  server or just bump the port number.
- No build step, no npm dependencies, no lint. A-Frame 1.7.1 and the vendored
  MSDF font live in `lib/` (copied from starcatcher); nothing loads from a
  CDN at runtime.

## Debug & tuning

All of these are URL query params on `index.html`, freely combinable
(`js/logic/params.js` parses `desktop`/`debug`/`dist`/`speed`; each is
independent — `?desktop` implies nothing about `?debug` and vice versa):

- `?desktop` — click-to-fire from the camera (2D dev/testing mode; the
  product experience is in-headset). Shows a "start desktop mode" button on
  the landing page.
- `?dist=<metres>` — skip the ride forward that far at launch (jumps straight
  to a beat or the boss). Emits every spawn event between 0 and that distance
  at once when the ride starts (pools recycle the oldest); harmless dev-tool
  behavior, not a defect.
- `?speed=<multiplier>` — scale ride playback speed. **Popups (derelict) and
  the boss finale are tuned in wall-clock time**, so at speed≠1 their timing
  visibly skews relative to distance-keyed spawns — dev-only artifact, noted
  and accepted in the ledger (Task 17).
- `?debug` — in-scene debug panel (`debug-panel.js`), gated off by default as
  of v17. When off: zero panel entities are created and `tick()` returns
  immediately, so it costs nothing at runtime. Shows version, game
  state/distance/score, per-hand tracking internals (wrist pose, baseline,
  threshold, fire count, last aim dir), and a `TUNED: key=value ...` line
  whenever a tuning override below is active.
- Every key in `TUNING_DEFAULTS` (`js/logic/tuning.js`) is overridable by URL
  param — unknown keys ignored, non-finite/non-positive values fall back to
  the default:

  | Key | Default | Meaning |
  | --- | --- | --- |
  | `thrFactor` | `0.18` | throw threshold, × sampled player height |
  | `thrMin` / `thrMax` | `0.15` / `0.40` | throw threshold clamp (m) |
  | `cooldownMs` | `250` | minimum time between fires per hand |
  | `rearmFrac` | `0.5` | fraction of threshold the hand must pull back to re-arm |
  | `shoulderDownFrac` | `0.13` | virtual shoulder below head, × height |
  | `shoulderDownMin` / `Max` | `0.15` / `0.28` | shoulder-down clamp (m) |
  | `shoulderLatFrac` | `0.09` | virtual shoulder lateral offset, × height |
  | `shoulderLatMin` / `Max` | `0.08` / `0.18` | shoulder-lateral clamp (m) |
  | `boltSpeed` | `40` | projectile speed (m/s) |
  | `boltRange` | `60` | projectile max travel before expiry (m) |

  Example: `?cooldownMs=150&thrFactor=0.22&boltSpeed=55`. Tune live on the
  headset without redeploying.
- `window.__starthrower` (set in `game.js`) — console/automation hook:
  `state`, `score`, `distance` getters, `pressCore()` (starts the ride from
  hangar), `fire(dir)` (emits a `fired` event from the camera).
- **Version-bump-on-deploy convention:** bump `VERSION` in `js/version.js`
  with **every** deploy, no exceptions. The Quest browser caches aggressively
  and will happily run a stale build with no visible symptom. `main.js` logs
  `starthrower <VERSION>` to the console once on every load regardless of
  `?debug` (so any session, headset included, can confirm the build without
  needing the panel open), and the `?debug` panel also displays it live.

## Architecture

Two layers, the starcatcher split: pure logic vs A-Frame glue.

**`js/logic/` — pure ES modules, no A-Frame/THREE/DOM, covered by `test/`:**

- `spline.js` — Catmull-Rom through waypoints with arc-length
  parameterisation; `pointAt`/`tangentAt` take real metres, giving constant
  rail speed.
- `script.js` — the ride as data: builds `WAYPOINTS` + `EVENTS` (spawns,
  beats, boss phases, end) keyed to rail distance; exports the deep-frozen
  `RIDE`, `SPEED` (6 m/s), `BOSS` (center/phase timings).
- `ride.js` — `createRide()`: advances distance, emits due events (spawns
  queued 40m early so scenery has time to render in), terminates exactly once
  on `end`.
- `firing.js` — per-hand state machine (armed → fired → recovering) over
  head-local radial hand displacement; small ring-buffer pose smoothing;
  `throwThreshold()` (height-scaled, clamped).
- `aim.js` — `armRayDir`/`armOffsets` (the shipped aim model), `segmentHit`
  (sphere-sweep hit test used by projectiles), plus `aimDirection`/
  `snapToTarget` retained from the pre-amendment design but no longer wired
  into `hands.js` (aim-assist was removed on device feedback).
- `scoring.js` — target base values, ×1→×4 combo multiplier (streak-based,
  resets on miss), best-score load/save.
- `heights.js` — hangar height sampler (90th-percentile-ish `stable()`) used
  to scale the throw threshold and shoulder offsets.
- `bossphases.js` — pure Guardian phase state machine (open/weakpointHit/
  timeout) + `ringAnchors()` (weak-point positions per phase, aimed at the
  rail sector the boss circle sweeps during that phase's window).
- `validate.js` — `validateRide()`: comfort/consistency checks used by
  `test/validate.test.js` (see comfort caps below).
- `tuning.js` — `TUNING_DEFAULTS` + `createTuning(search)`, the live-tuning
  layer described above.
- `params.js` — `parseParams(search)`: `desktop`/`debug`/`dist`/`speed`.

**`js/` — one A-Frame component file per concern:**

- `main.js` — the module entry point; imports every glue file in load order,
  logs the version once.
- `palette.js` — the flat color-token data (`space`/`violet`/`cyan`/
  `magenta`/`amber`/`ink`).
- `sky.js` — `space-sky`: gradient-shader dome + ~800-star `THREE.Points`
  field (one draw call); also exports `makeRng` (shared seeded PRNG) and
  `skyColorAt`/`skyPalette` used by `ambient.js`'s nebula edge-matching.
- `ambient.js` — `ambient-director`: all per-beat merged-geometry scenery
  (hangar shell/glow/corridor, asteroid field near/far layers, derelict hull
  + ribs + glow, boss approach + arena, 3 sky-matched nebula planes);
  cross-fades adjacent beats' groups so nothing pops.
- `hands.js` — `calibration` (height sampling, gated to the hangar; also
  drives `?desktop` click-fire) and `hand-thrower` (feeds tracked wrist poses
  into `firing.js`, computes arm-ray aim at fire time, exposes `debugInfo()`
  for the panel).
- `targets.js` — `target-manager` (pooled crate/asteroid/drone/popup/
  weakpoint spawners, shared merged geometries, poke handling, shatter/fizzle
  particle bursts), `hit-target` (registers any entity as a target),
  `hangar-only` (visibility gate), `core-flash` (throttled hit feedback).
- `boss.js` — `guardian`: the Guardian's merged-geometry body/halos/debris,
  phase-driven weak-point ring recoloring, and the break-apart finale.
- `projectiles.js` — `projectile-pool`: pooled bolts, `fired`/`targethit`/
  `projectileexpired` event flow.
- `rail.js` — `rail-mover`: moves the rig along the spline during
  riding/tally, yaw-rate-limited to match the comfort cap.
- `game.js` — `game-manager`: the state machine (hangar → riding → tally),
  routes ride events to scene events, owns scoring/best-score/localStorage
  fallback, `window.__starthrower`.
- `input-watcher.js` — hand-tracking-absence prompt (procedural hand mesh +
  text), active in hangar and mid-ride alike (the ride never pauses for it).
- `hud.js` — in-ride floating score + combo chip + pooled point-pop text.
- `tally.js` — end-of-ride score count-up, best-score reveal/flourish, AGAIN
  orb, 10s auto-return.
- `audio.js` — `audio-director`: WebAudio synthesis only (no audio files),
  per-beat layered music mix, throw/score/fizzle/boss SFX, suspend/resume on
  tab visibility gated to riding/tally state.
- `debug-panel.js` — gated behind `?debug` (see above).
- `version.js` — the single `VERSION` export.

**Cross-component wiring is scene events**, not direct references: `fired`,
`targethit`, `projectileexpired`, `spawntarget`, `scored`, `combobroken`,
`beatchanged`, `bossphase`, `bossdefeated`, `ridestarted`, `ridedone`,
`tallydone`, `gamehidden`/`gameshown`.

**Comfort, enforced not asserted:** `validate.js` walks the shipped rail at
1m steps and fails `npm test` if yaw rate exceeds 30°/s, pitch rate exceeds
10°/s, or the tangent reverses — a waypoint edit that violates this cannot
land. Ride speed is constant (no acceleration events).

**Pooling everywhere**, no entity creation mid-ride: targets (crate 8,
asteroid 12, drone 8, popup 8, weakpoint 9 — 45-slot ceiling, +1 static core
= the ledger's noted "theoretical 46-draw-call pool ceiling" if every slot
were simultaneously visible, which content bounds prevent), projectiles (12),
shatter/fizzle particle bursts (3 concurrent × 12 shards, one shared
`BufferGeometry`), HUD point-pops (6).

**Transparency budget:** only projectile glow, shatter/fizzle particles, and
hands may alpha-blend; everything else is `shader: flat`/`MeshBasicMaterial`
with vertex colors, opaque.

**Draw-call budget:** spec caps the worst beat at ≤100 (target+particle
system alone ≤40, boss+debris ≤25). Measured on desktop 2026-08-16 via
`document.querySelector('a-scene').renderer.info.render.calls` at rest in
each beat: hangar ~11, asteroid field ~13, derelict ~12, boss ~7 — well under
budget because each beat's static scenery is one or a few merged meshes, not
per-object entities.

## Quest 2 / A-Frame traps (hard-won — do not rediscover)

- **`hand-tracking-controls` zeroes its entity's `object3D.position` every
  tick.** The real wrist pose lives on `component.wristObject3D`, a separate
  Object3D parented directly to the scene, gated by `component.hasPoses` (and
  check `wristObject3D.visible`). `hands.js`'s `hand-thrower` reads exactly
  this; `js/input-watcher.js`'s `isHandTracked()` is the second call site.
  Reading the entity's own position here silently gets you nothing (Task 8's
  first device test: hands never fired until this was found).
- **That wrist pose is in *reference* space, and nothing applies the rig
  transform to it** — `wristObject3D` is added to `sceneEl.object3D` (the scene
  root) and filled from `frame.fillPoses(..., referenceSpace, ...)`, while
  `#head` is a child of `#rig` and so *does* get the rail transform. The two
  spaces coincide only while the rig sits at the origin, i.e. in the hangar, so
  a mismatch here tests clean and then dies the instant the ride departs. Any
  consumer of the wrist position must lift it through `rig.matrixWorld`
  (`hand-thrower` does). v18 shipped without this: head-to-hand distance grew
  at ride speed, which fired one phantom bolt at launch and then latched the
  tracker in `recovering` forever (re-arm needs the distance to *shrink*), so
  throwing worked in the hangar and was dead for the whole ride. `?desktop`
  cannot catch this class of bug — it fires from the camera, which is under the
  rig and therefore always in the right space.
- **An awake Touch controller suppresses hand input sources entirely.** Tell
  testers to set the controllers down and let them sleep before donning the
  headset (in the README's grown-up setup note for a reason).
- **`animation__*` re-set with identical attribute data is a silent no-op** —
  the animation does not restart. Idiom used throughout (`core-flash`,
  `hud.js` point-pops, `tally.js` flourish, `boss.js` phase pulse/tilt):
  `el.removeAttribute('animation__x')` immediately before `setAttribute`.
- **Never name a component method `play()`/`pause()` as an ad-hoc verb** —
  those names collide with A-Frame's own component lifecycle hooks and
  silently drop args/latches if used for anything else. This is about
  incidental name collisions, not the lifecycle hooks themselves: `hit-target`
  legitimately implements A-Frame's `play()` lifecycle hook, which is fine.
- **A parent's `visible = false` does not propagate to children's own
  `object3D.visible`.** Hit/visibility checks must walk ancestors — see the
  duplicated `isAncestorVisible()` helper in both `hands.js` and `targets.js`
  (known minor duplication, ledger Task 7, never consolidated).
- **`a-text` fetches its default font from cdn.aframe.io.** Every text entity
  in this repo (`hud.js`, `tally.js`, `debug-panel.js`, `input-watcher.js`)
  points at the vendored `lib/fonts/Roboto-msdf.json`/`.png` with
  `negate: true` (`false` renders inverted/hollow). Keep it that way.
- **`hand-tracking-controls` defaults to `modelStyle: mesh` and fetches
  `controllers/oculus-hands/v4/{left,right}.glb` from
  `window.AFRAME_CDN_ROOT || 'https://cdn.aframe.io/'` the moment hands
  connect** — a runtime CDN request the spec forbids. Prevented by vendoring
  both GLBs into `lib/controllers/oculus-hands/v4/` and setting
  `window.AFRAME_CDN_ROOT = 'lib/'` in an inline script in `index.html`,
  strictly before the `lib/aframe.min.js` script tag. Confirmed by reading
  the vendored bundle: `AFRAME_CDN_ROOT` backs a single base-URL variable
  (`uy`) used to compose every built-in controller/hand model path
  (`uy+"controllers/oculus-hands/v4/left.glb"`, etc.) *and* the default font
  base — but every `font`/`fontImage` in this repo is passed as an explicit
  `lib/fonts/...` path rather than a bundled keyword, so the font default
  path is never consulted, and no other controller entities exist in this
  hand-tracking-only app to touch the other model paths the override also
  affects.
- **Custom `ShaderMaterial`s bypass the renderer's linear→sRGB output
  transform** when `colorManagement: true` (set on `<a-scene>` here) —
  vertex-colored `MeshBasicMaterial` geometry gets the transform for free,
  raw shaders do not, so colors mismatch unless you apply it yourself. See
  `SRGB_FN`/`toSRGB()` in `js/sky.js`, used by both the sky dome and star
  point-sprite fragment shaders.
- **Differentiating hand position over time to aim scatters** — Quest 2 hand
  tracking degrades mid-throw, so motion-path aim looks wild on fast swings.
  The settled model is the arm ray (shoulder→hand, computed once at the fire
  instant, no differentiation) — see the aim-model note above and
  `js/logic/aim.js`.

## Device-test workflow

1. Push to `main` — GitHub Pages serves `main` at the repo root, so pushing
   **is** deploying (~1-2 min build lag).
2. Push over HTTPS via `gh` (`gh auth setup-git`) — the 1Password SSH agent
   fails non-interactively when locked, so plain `git push` over SSH can
   silently hang/fail in an unattended session. Commit signing is disabled
   in-repo for the same reason.
3. Verify the deploy landed before testing: `curl` `js/version.js` on the
   Pages URL and confirm the `VERSION` string matches what you just pushed —
   don't trust "it's been a minute," confirm it.
4. Then headset-test. Tune live via URL params (see Debug & tuning) without
   redeploying — only push again when the constants themselves need to
   change permanently.

## Known parked items

Carried from the ledger's `parked`/`minor (deferred)` lines — read the ledger
(`.superpowers/sdd/2026-08-14-starthrower/progress.md`) for full context
before "fixing" any of these:

- **Audio voice nodes have no explicit `disconnect()`/`onended`** on
  short-lived WebAudio sources (`audio.js`). Ruling: Chromium (the sole
  target) collects stopped sources, so this is safe but a real gap vs. a
  strict cleanup discipline — heap-profile a long session someday if memory
  growth is ever suspected (Task 14, parked).
- **Fizzle particles read low-contrast beyond ~15m** — never revisited after
  the first playtest note (Task 12, deferred).
- **Theoretical 46-draw-call pool ceiling** if every target pool slot were
  simultaneously deployed — content-bounded in practice (the script never
  spawns that densely), but worth knowing if the budget is ever tightened
  (Task 12, deferred).
- **Firing constants (threshold 0.18×height clamped 15-40cm, 250ms cooldown)
  have never been device-tuned beyond their initial defaults** — no user
  request to tune them yet; revisit at a full T20-style playtest (Task 8,
  deferred).
- **The tally's AGAIN orb is flagged `pokeable: true` but sits ~9m from the
  player** (tally entity at `z=-9`, orb at local `y=-1.4`) — not realistically
  reachable by an outstretched hand. The 10s auto-return timeout is the real
  mechanism that ends the tally; the poke path is a courtesy for whoever
  happens to be close (Task 19, ruled acceptable).
- **Tally text sizing has never been verified in-headset** — the derelict,
  boss, and departure beats have each had device passes during their own
  tasks, but a full end-to-end device playtest (including the tally screen)
  is still gated behind Task 20's final device-playtest gate as of this
  writing.
