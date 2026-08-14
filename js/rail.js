import { createSpline } from './logic/spline.js';
import { RIDE } from './logic/script.js';

const MAX_YAW_RATE = (30 * Math.PI) / 180; // rad/s — matches validate.js's comfort cap

function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function register() {
  AFRAME.registerComponent('rail-mover', {
    init() {
      this.spline = createSpline(RIDE.waypoints);
      this.pos = new THREE.Vector3();
      this.yaw = 0;
      this.wasRiding = false;
    },

    tick(t, dt) {
      const gm = this.el.sceneEl.components['game-manager'];
      if (!gm || gm.state !== 'riding') {
        this.wasRiding = false;
        return;
      }
      if (!dt) return;

      const distance = gm.ride.distance();
      const p = this.spline.pointAt(distance);
      this.pos.set(p.x, p.y, p.z);
      this.el.object3D.position.copy(this.pos);

      const tangent = this.spline.tangentAt(distance);
      const targetYaw = Math.atan2(-tangent.x, -tangent.z);

      if (!this.wasRiding) {
        // Just entered 'riding' — snap instead of lerping from a stale
        // heading (also what makes a ?dist= fast-forward land instantly).
        this.yaw = targetYaw;
        this.wasRiding = true;
      } else {
        const maxStep = MAX_YAW_RATE * (dt / 1000);
        const delta = shortestAngleDelta(this.yaw, targetYaw);
        this.yaw += Math.max(-maxStep, Math.min(maxStep, delta));
      }

      this.el.object3D.rotation.set(0, this.yaw, 0);
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
