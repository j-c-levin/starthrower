import { aimDirection, snapToTarget, segmentHit } from './logic/aim.js';

const SPEED = 40;
const MAX_RANGE = 60;
const POOL_SIZE = 12;
const NUDGE = 0.3;
const SNAP_CONE_DEG = 7;

function register() {
  AFRAME.registerComponent('projectile-pool', {
    init() {
      this.pool = [];
      this.nextIndex = 0;

      for (let i = 0; i < POOL_SIZE; i++) {
        const el = document.createElement('a-entity');
        el.setAttribute('geometry', 'primitive: sphere; radius: 0.12; segmentsWidth: 8; segmentsHeight: 6');
        el.setAttribute('material', 'shader: flat; color: #4de3ff; transparent: true; opacity: 0.9');
        el.setAttribute('visible', false);
        el.dataset.bolt = 'true';
        this.el.appendChild(el);
        this.pool.push({
          el,
          active: false,
          dir: { x: 0, y: 0, z: 0 },
          traveled: 0,
          prev: new THREE.Vector3(),
          cur: new THREE.Vector3(),
        });
      }

      this.onFired = this.onFired.bind(this);
      this.el.addEventListener('fired', this.onFired);
    },

    remove() {
      this.el.removeEventListener('fired', this.onFired);
    },

    acquire() {
      for (let i = 0; i < this.pool.length; i++) {
        const idx = (this.nextIndex + i) % this.pool.length;
        if (!this.pool[idx].active) {
          this.nextIndex = (idx + 1) % this.pool.length;
          return this.pool[idx];
        }
      }
      return null;
    },

    release(bolt) {
      bolt.active = false;
      bolt.el.setAttribute('visible', false);
    },

    onFired(evt) {
      const { origin, through } = evt.detail;
      const dir = aimDirection(origin, through);
      const manager = this.el.components['target-manager'];
      const active = manager ? manager.active() : [];
      const snap = snapToTarget(origin, dir, active, SNAP_CONE_DEG);

      const bolt = this.acquire();
      if (!bolt) return;

      bolt.dir.x = snap.dir.x;
      bolt.dir.y = snap.dir.y;
      bolt.dir.z = snap.dir.z;
      bolt.traveled = 0;
      bolt.cur.set(
        origin.x + snap.dir.x * NUDGE,
        origin.y + snap.dir.y * NUDGE,
        origin.z + snap.dir.z * NUDGE
      );
      bolt.prev.copy(bolt.cur);
      bolt.el.object3D.position.copy(bolt.cur);
      bolt.el.setAttribute('visible', true);
      bolt.active = true;
    },

    tick(t, dt) {
      if (!dt) return;
      const step = (SPEED * dt) / 1000;
      const manager = this.el.components['target-manager'];
      const active = manager ? manager.active() : [];

      for (const bolt of this.pool) {
        if (!bolt.active) continue;

        bolt.prev.copy(bolt.cur);
        bolt.cur.x += bolt.dir.x * step;
        bolt.cur.y += bolt.dir.y * step;
        bolt.cur.z += bolt.dir.z * step;
        bolt.traveled += step;
        bolt.el.object3D.position.copy(bolt.cur);

        const hitId = segmentHit(bolt.prev, bolt.cur, active);
        if (hitId !== null) {
          const hitTarget = active.find((a) => a.id === hitId);
          this.el.emit('targethit', {
            id: hitId,
            type: hitTarget ? hitTarget.type : null,
            point: { x: bolt.cur.x, y: bolt.cur.y, z: bolt.cur.z },
          });
          this.release(bolt);
          continue;
        }

        if (bolt.traveled >= MAX_RANGE) {
          this.el.emit('projectileexpired', { point: { x: bolt.cur.x, y: bolt.cur.y, z: bolt.cur.z } });
          this.release(bolt);
        }
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
