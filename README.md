# Starthrower

A family WebXR rails shooter for Meta Quest 2, played with bare hands — no
controllers, no buttons, no app store. You glide on a rail through deep space
and throw stars: an overhand throwing motion fires a bolt along the line of
your arm. Smash crates, asteroids, drones and pop-up panels to build a combo,
face the Guardian at the end of the ride, then watch your score tally and go
again. The ride starts from a hangar — throw a star at the glowing core, or
tap the glowing launch pad right in front of you.

It runs entirely in the Quest browser from a static page; nothing to install.

## For grown-ups (setup)

Open **https://j-c-levin.github.io/starthrower/** in the Quest browser and tap
Enter VR. Before handing the headset over:

- Turn **hand tracking on**: Settings → Movement tracking → Hand and body
  tracking.
- **Set the controllers down** and let them go to sleep — an awake controller
  suppresses hand input.
- Clear enough boundary space to swing an arm freely.
- That's it: throw overhand to fire. Aim comes from the line of the arm, so
  point the whole throw at what you want to hit.

## Development

Plain ES modules served statically — no build step, no dependencies.

- `npm test` — imports every module under `js/` as a smoke check, then runs
  the `node:test` suite over the headless logic in `js/logic/`.
- `scripts/serve.sh [port]` — static dev server (default port 8472).
- Debug URL params (combinable, see `js/logic/params.js`):
  - `?desktop` — mouse mode: click anywhere to fire from the camera.
  - `?dist=<metres>` — skip the ride forward that far at launch, to jump
    straight to a later beat or the boss.
  - `?speed=<multiplier>` — scale ride speed.
- `window.__starthrower` — console/automation hook exposing `state`, `score`
  and `distance` getters plus `pressCore()` and `fire(dir)`.
- **Bump `VERSION` in `js/version.js` with every deploy.** The in-headset
  debug panel displays it, which is the only reliable way to confirm the
  Quest browser isn't serving a stale cached build.

## Live tuning

Every gameplay-feel constant can be overridden at runtime via URL query
parameters — no redeploy needed, so values can be tuned directly on the
headset. Unknown keys are ignored; a value is only applied if it parses as a
positive finite number, otherwise the default is kept. The debug panel shows
a `TUNED: key=value ...` line whenever at least one override is active.

| Key | Default | Meaning |
| --- | --- | --- |
| `thrFactor` | `0.162` | Throw threshold, scaling factor applied to calibrated player height |
| `thrMin` | `0.135` | Throw threshold, minimum clamp (metres) |
| `thrMax` | `0.36` | Throw threshold, maximum clamp (metres) |
| `cooldownMs` | `250` | Minimum time between fires (ms) |
| `rearmFrac` | `0.5` | Fraction of the threshold the hand must pull back before it can fire again |
| `shoulderDownFrac` | `0.13` | Virtual shoulder offset below the head, scaling factor applied to height |
| `shoulderDownMin` | `0.15` | Virtual shoulder down-offset, minimum clamp (metres) |
| `shoulderDownMax` | `0.28` | Virtual shoulder down-offset, maximum clamp (metres) |
| `shoulderLatFrac` | `0.09` | Virtual shoulder lateral offset, scaling factor applied to height |
| `shoulderLatMin` | `0.08` | Virtual shoulder lateral offset, minimum clamp (metres) |
| `shoulderLatMax` | `0.18` | Virtual shoulder lateral offset, maximum clamp (metres) |
| `boltSpeed` | `40` | Projectile speed (m/s) |
| `boltRange` | `60` | Projectile max travel distance before it expires (m) |

Example, for a faster and more forgiving feel:

```
https://<host>/?cooldownMs=150&thrFactor=0.22&boltSpeed=55
```

`?desktop` and other debug params (`dist`, `speed`) still apply alongside
these — see `js/logic/params.js`.
