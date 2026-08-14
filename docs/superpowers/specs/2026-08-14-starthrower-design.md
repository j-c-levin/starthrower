# Starthrower — design spec

2026-08-14. Status: approved design, pre-implementation.

## What this is

A family WebXR rails shooter for Meta Quest 2, in the spirit of the Ninjago
ride at Legoland Windsor (dark-ride car, throw-to-shoot, score-only), with an
original space theme. Built on the starcatcher technical skeleton — vendored
A-Frame 1.7.1, zero dependencies, no build step, logic/glue split, GitHub
Pages — but with its own aesthetics designed from scratch.

Audience: whole family. A five-year-old can play and always finishes; adults
chase high scores. Pure score-attack: nothing damages the player, the ride
always completes.

Input: hand tracking only. No gesture recognition — a forward throw of either
hand fires a projectile.

## The ride

One authored ~3½-minute journey. Everything — target spawns, scene changes,
boss phases — is keyed to **distance along the rail**, not wall-clock time, so
every run is identical: fair for score-chasing, deterministic for tests.

**Hangar (menu).** The player floats in a space-station hangar bay. The start
button is a large glowing core placed rail-forward (so launching re-orients
the player physically toward the ride direction). Throwing at it launches the
ride — the menu teaches the core verb. The core also accepts a direct poke as
a fallback so a child who can't yet produce a clean throw is never locked out.
While in the hangar the game samples player height for throw calibration.

**Beats:**

1. **Departure (~30s)** — glide out of the hangar past big, slow, generous
   practice targets (cargo crates with glowing panels). A warm-up that cannot
   be failed.
2. **Asteroid field (~60s)** — crystal asteroids that shatter, plus small
   darting drones worth more. Gentle S-curves; density ramps.
3. **The derelict (~60s)** — the rail threads through a wrecked colossal
   ship: targets in windows and hull gaps pop out and retract on timers.
   Timing matters, not just aim.
4. **Boss: the Guardian (~45s)** — a large geometric sentinel. Three phases,
   each opening a ring of glowing weak points. Destroying a ring advances the
   phase early; otherwise the phase times out and advances anyway — the ride
   **always ends**, only the score varies. Finale: slow rumbling break-apart
   as the player sails through the debris.
5. **Tally** — calm starfield; score counts up in big friendly digits with a
   best-score comparison (localStorage). Beating the best gets an extra
   flourish. The tally auto-returns to the hangar.

A run in which the player never fires is valid: the ride completes and the
tally shows 0.

## Firing

**Trigger — radial displacement, no gestures.** Hand positions are tracked in
head-local space. Each armed hand keeps a rolling baseline: its minimum
head-to-hand distance since it last re-armed. The hand fires when its current
head-to-hand distance exceeds that baseline by more than the threshold
(radial displacement is throw-style-agnostic: overhand, sidearm, and
kid-flail all cross it).

- **Threshold scaling:** proportional to sampled player height (~18% of
  height), **clamped to an absolute 15–40cm** so seated adults (sampled low)
  and very short samples still work. Seated play is supported via the clamp.
- **Pose smoothing:** hand poses go through a short ring buffer; firing
  position/direction use a smoothed pose over the last ~3 good frames.
  Low-confidence tracking frames are ignored. Tracking loss mid-throw fires
  at the last good pose rather than swallowing the input.
- **Aim:** at threshold crossing, the projectile flies along the ray **from
  the head through the smoothed hand position**, fixed speed, max range.
- **Aim assist:** if the ray passes within a generous cone (5–8°) of a live
  target, the projectile direction **snaps at spawn** to that target. No
  mid-flight curving. Invisible in feel; testable as pure math.
- **Re-arm:** after firing, that hand's head-to-hand distance must decrease
  by at least half the threshold from its firing value before it can fire
  again, plus a ~250ms cooldown. Re-arming resets the rolling baseline.
- Both hands fire independently; double-fisted throwing is allowed.

**Milestone zero (hard gate):** an on-device throw-feel spike — hangar, one
target, the firing pipeline — before any ride content is built. The
trigger/smoothing numbers above are starting points to be tuned on hardware;
this mechanic is make-or-break and starcatcher's history warns that tuning
without a headset test is a trap.

## Scoring

- Base values by target type: practice crates low; asteroids medium; drones
  and pop-up targets high; boss weak points highest.
- **Combo multiplier** ×1→×2→×3→×4 builds on consecutive hits and resets only
  when a projectile expires without hitting anything. Expiry shows an
  immediate visible+audible **fizzle** so the reset is legible. Double-fisted
  spam resetting the combo is coherent and intended.
- In-ride HUD: a small unobtrusive floating score low in view; brief point
  pops at destroyed targets. The ceremony is at the tally.
- Best score in localStorage.

## Comfort (enforced, not asserted)

There is no vehicle or comfort frame — the player flies free. Comfort
therefore lives in the rail data, enforced by a **script validation test**:

- Constant rail speed (no acceleration events).
- Yaw rate ≤ 30°/s; roll ≈ 0; no reversals; pitch gentle.
- Nothing ambient moves toward the player except targets on spawn paths.

A waypoint edit that violates these fails `npm test`.

Family-safety: no flashing above 1Hz, no gore, boss break-apart is slow and
rumbling rather than violent. Readable text limited to the score digits and
short labels.

## Performance budgets (Quest 2)

- Static scenery per beat is merged geometry — the derelict is one or a few
  meshes, not per-panel entities.
- ≤ ~100 draw calls in the worst beat.
- Transparency budget: only projectile glow, shatter/fizzle particles, and
  hands may alpha-blend; everything else `shader: flat`, opaque.
- Object pooling everywhere (projectiles, targets, particles, point pops):
  no entity creation mid-ride.

## Architecture

Two layers, starcatcher's proven split:

**`js/logic/` — pure ES modules, no A-Frame/THREE/DOM, covered by `test/`:**

- `spline.js` — Catmull-Rom through waypoints with arc-length
  parameterisation (distance in real metres, constant speed).
- `script.js` — the ride as data: waypoints + events keyed to rail distance.
- `ride.js` — playback: advance distance, emit due events, always terminates.
- `firing.js` — per-hand state machine (armed → fired → recovering) over
  head-local poses; ring buffer smoothing; height-scaled clamped threshold.
- `aim.js` — head-through-hand ray, aim-assist cone snap, sphere-sweep hit
  tests.
- `scoring.js` — target values, combo, best-score logic.
- `heights.js` — hangar height sampling.
- `validate.js` — script/comfort validation used by tests.

**`js/` glue — one A-Frame component per concern:** `game.js` (state machine
hangar→riding→tally), `rail.js` (moves the rig along the spline), `hands.js`
(feeds tracked poses into `firing.js`), `projectiles.js`, `targets.js`,
`boss.js`, `ambient.js`, `hud.js`, `audio.js` (WebAudio synthesis, no audio
files), `sky.js`, `input-watcher.js` (hand-absence prompt, active in hangar
AND mid-ride — the ride never pauses for it).

Conventions: glue files guard registration behind
`if (typeof AFRAME !== 'undefined')` and never touch THREE/window at module
top level (keeps them Node-importable). Cross-component communication via
scene events: `fired`, `targethit`, `phasechanged`, `ridedone`.

Known starcatcher traps honoured from day one: animation attribute re-set is
a silent no-op (remove-then-set idiom); never name a component method
`play()`/`pause()`; world-visibility checks must walk ancestors; vendored
MSDF font with `negate: true`; `visibilitychange` resume **gated on game
state** (fixes the bug starcatcher shipped).

## Aesthetics & audio

Fresh art direction — explicitly not starcatcher's. Deep-space navy/violet,
flat-shaded procedural geometry, bold neon-edged targets, bright shatter
bursts on hit. A deliberate palette pass happens during implementation.
Audio is synthesized: a soundtrack that layers up per beat, throw whoosh,
rising combo chimes, fizzle on expiry, big boss finale.

## Testing & debug

- `npm test` — `scripts/check.mjs` imports every `js/**/*.js` in Node
  (catches load errors in glue), then `node --test 'test/**/*.js'` (keep the
  glob; the bare directory form is broken on this machine's Node 22.14).
- Logic under test: firing state machine and thresholds, spline arc-length,
  script determinism and comfort validation, aim snap and hit tests, combo
  maths, boss phase timeout, ride-always-terminates.
- Debug URL params (dev tools, not product surface): `?desktop` (WASD/mouse,
  click fires through cursor), `?dist=800` (jump to rail distance),
  `?speed=8` (time multiplier). `window.__starthrower` exposes state for
  console-driven testing.

## Web entry & fallback

Minimal 2D landing page: title, one-line grown-up setup note (enable hand
tracking), Enter VR button. `?desktop` is the only 2D play mode and is a
development tool; the product experience is in-headset.

## Repo & deploy

New repo `starthrower` in `~/Code`. A-Frame 1.7.1 and the MSDF font vendored
in `lib/` (copied from starcatcher); no external requests at runtime. No
dependencies, no build step. GitHub Pages serves `main` at the repo root —
pushing `main` is deploying. Push over HTTPS (`gh auth setup-git`); commit
signing off in-repo (1Password agent fails non-interactively).
