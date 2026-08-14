import { RIDE } from './logic/script.js';
import { createRide } from './logic/ride.js';
import { createScore, loadBest, saveBest } from './logic/scoring.js';
import { parseParams } from './logic/params.js';

const TALLY_AUTO_MS = 10000; // seam: Task 18's tally UI emits `tallydone` itself and replaces this fallback

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

// window.localStorage can throw on access (sandboxed iframe, private-browsing
// / enterprise policy), which would otherwise crash finishRide() right as a
// ride ends — probe once and fall back to an in-memory stub.
function safeStorage() {
  try {
    const probeKey = '__starthrower_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

function register() {
  AFRAME.registerComponent('game-manager', {
    init() {
      this.params = parseParams(window.location.search);
      this.state = 'hangar';
      this.ride = createRide(RIDE);
      this.score = createScore();
      this.rigEl = this.el.querySelector('#rig');
      this.tallyElapsedMs = 0;
      this._debugPos = new THREE.Vector3();
      this.storage = safeStorage();

      this.onTargetHit = this.onTargetHit.bind(this);
      this.onProjectileExpired = this.onProjectileExpired.bind(this);
      this.onTallyDone = this.onTallyDone.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);

      this.el.addEventListener('targethit', this.onTargetHit);
      this.el.addEventListener('projectileexpired', this.onProjectileExpired);
      this.el.addEventListener('tallydone', this.onTallyDone);
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      const self = this;
      window.__starthrower = {
        get state() { return self.state; },
        get score() { return self.score.score(); },
        get distance() { return self.ride.distance(); },
        pressCore() { self.startRide(); },
        fire(dir) {
          const headEl = self.el.querySelector('#head');
          let origin = { x: 0, y: 1.6, z: 0 };
          if (headEl && headEl.object3D) {
            headEl.object3D.getWorldPosition(self._debugPos);
            origin = { x: self._debugPos.x, y: self._debugPos.y, z: self._debugPos.z };
          }
          self.el.emit('fired', { origin, dir, hand: 'debug' });
        },
      };
    },

    remove() {
      this.el.removeEventListener('targethit', this.onTargetHit);
      this.el.removeEventListener('projectileexpired', this.onProjectileExpired);
      this.el.removeEventListener('tallydone', this.onTallyDone);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    },

    tick(t, dt) {
      if (!dt) return;
      if (this.state === 'riding') {
        const events = this.ride.advance(dt * this.params.speed);
        this.routeEvents(events);
      } else if (this.state === 'tally') {
        this.tallyElapsedMs += dt;
        if (this.tallyElapsedMs >= TALLY_AUTO_MS) {
          this.tallyElapsedMs = 0;
          this.el.emit('tallydone');
        }
      }
    },

    routeEvents(events) {
      for (const e of events) {
        if (e.type === 'spawn') {
          this.el.emit('spawntarget', { target: e.target, pos: e.pos, period: e.period, duty: e.duty });
        } else if (e.type === 'beat') {
          this.el.emit('beatchanged', { name: e.name });
        } else if (e.type === 'bossphase') {
          this.el.emit('bossphase', { phase: e.phase });
        } else if (e.type === 'end') {
          this.finishRide();
        }
      }
    },

    startRide() {
      if (this.state !== 'hangar') return;
      this.score.reset();
      this.state = 'riding';
      this.el.emit('ridestarted');
      if (this.params.dist > 0) {
        const dtMs = (this.params.dist / RIDE.speed) * 1000;
        this.routeEvents(this.ride.advance(dtMs));
      }
    },

    finishRide() {
      const score = this.score.score();
      const prevBest = loadBest(this.storage);
      const newBest = saveBest(this.storage, score);
      const best = newBest ? score : prevBest;
      this.state = 'tally';
      this.tallyElapsedMs = 0;
      this.el.emit('ridedone', { score, best, newBest });
    },

    onTargetHit(evt) {
      const { type, point, id } = evt.detail;
      if (type === 'core') {
        if (this.state === 'hangar') this.startRide();
        return;
      }
      if (this.state !== 'riding') return;
      const points = this.score.hit(type);
      this.el.emit('scored', { points, score: this.score.score(), multiplier: this.score.multiplier(), point, type, id });
    },

    onProjectileExpired(evt) {
      if (this.state !== 'riding') return;
      this.score.miss();
      this.el.emit('combobroken', { point: evt.detail.point });
    },

    onTallyDone() {
      if (this.state !== 'tally') return;
      this.ride = createRide(RIDE);
      this.tallyElapsedMs = 0;
      if (this.rigEl && this.rigEl.object3D) {
        this.rigEl.object3D.position.set(0, 0, 0);
        this.rigEl.object3D.rotation.set(0, 0, 0);
      }
      this.state = 'hangar';
    },

    onVisibilityChange() {
      if (document.hidden) {
        this.el.emit('gamehidden');
      } else {
        this.el.emit('gameshown', { state: this.state });
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
