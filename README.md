# Starthrower

## Live tuning

Every gameplay-feel constant can be overridden at runtime via URL query
parameters — no redeploy needed, so values can be tuned directly on the
headset. Unknown keys are ignored; a value is only applied if it parses as a
positive finite number, otherwise the default is kept. The debug panel shows
a `TUNED: key=value ...` line whenever at least one override is active.

| Key | Default | Meaning |
| --- | --- | --- |
| `thrFactor` | `0.18` | Throw threshold, scaling factor applied to calibrated player height |
| `thrMin` | `0.15` | Throw threshold, minimum clamp (metres) |
| `thrMax` | `0.40` | Throw threshold, maximum clamp (metres) |
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
