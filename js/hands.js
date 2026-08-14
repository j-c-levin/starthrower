import { createHandTracker, throwThreshold } from './logic/firing.js';
import { createHeightSampler } from './logic/heights.js';
import { armRayDir, armOffsets } from './logic/aim.js';
import { createTuning } from './logic/tuning.js';

const THRESHOLD_RECREATE_DELTA = 0.02;

function isAncestorVisible(object3D) {
  let node = object3D;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

function register() {
  // Shared across calibration + hand-thrower below: one parse of the URL
  // per session, read here (init-safe: register() only runs under AFRAME).
  const tuning = createTuning(window.location.search);
  const thrOpts = {
    thrFactor: tuning.get('thrFactor'),
    thrMin: tuning.get('thrMin'),
    thrMax: tuning.get('thrMax'),
  };
  const shoulderOpts = {
    downFrac: tuning.get('shoulderDownFrac'),
    downMin: tuning.get('shoulderDownMin'),
    downMax: tuning.get('shoulderDownMax'),
    latFrac: tuning.get('shoulderLatFrac'),
    latMin: tuning.get('shoulderLatMin'),
    latMax: tuning.get('shoulderLatMax'),
  };

  AFRAME.registerComponent('calibration', {
    init() {
      this.sampler = createHeightSampler();
      this.headEl = this.el.querySelector('#head');
      this.headPos = new THREE.Vector3();
      this.camDir = new THREE.Vector3();
      this.camQuat = new THREE.Quaternion();

      this.onClick = this.onClick.bind(this);
      this.desktop = window.location.search.includes('desktop');
      if (this.desktop) window.addEventListener('click', this.onClick);
    },

    remove() {
      if (this.desktop) window.removeEventListener('click', this.onClick);
    },

    tick() {
      if (!this.headEl || !this.headEl.object3D) return;
      const gm = this.el.sceneEl.components['game-manager'];
      if (gm && gm.state !== 'hangar') return;
      this.headEl.object3D.getWorldPosition(this.headPos);
      this.sampler.addSample(this.headPos.y);
    },

    threshold() {
      return throwThreshold(this.sampler.stable(), thrOpts);
    },

    height() {
      return this.sampler.stable();
    },

    onClick() {
      const camera = this.el.camera;
      const camEl = camera && camera.el;
      if (!camEl) return;
      camEl.object3D.getWorldPosition(this.headPos);
      camEl.object3D.getWorldQuaternion(this.camQuat);
      this.camDir.set(0, 0, -1).applyQuaternion(this.camQuat);
      const origin = { x: this.headPos.x, y: this.headPos.y, z: this.headPos.z };
      const dir = { x: this.camDir.x, y: this.camDir.y, z: this.camDir.z };
      this.el.emit('fired', { origin, dir, hand: 'desktop' });
    },
  });

  AFRAME.registerComponent('hand-thrower', {
    schema: { hand: { default: 'left' } },

    init() {
      this.headEl = this.el.sceneEl.querySelector('#head');
      this.headPos = new THREE.Vector3();
      this.handPos = new THREE.Vector3();
      this.camQuat = new THREE.Quaternion();
      this.camEuler = new THREE.Euler();
      this.tracker = null;
      this.lastThreshold = null;
      this.firedCount = 0;
      this.lastDir = null;
      this.lastOffsets = null;
    },

    tick(t) {
      const calib = this.el.sceneEl.components.calibration;
      if (!calib || !this.headEl || !this.headEl.object3D) return;

      const threshold = calib.threshold();
      if (this.tracker === null || Math.abs(threshold - this.lastThreshold) > THRESHOLD_RECREATE_DELTA) {
        this.tracker = createHandTracker({
          threshold,
          cooldownMs: tuning.get('cooldownMs'),
          rearmFrac: tuning.get('rearmFrac'),
        });
        this.lastThreshold = threshold;
      }

      this.headEl.object3D.getWorldPosition(this.headPos);

      // hand-tracking-controls zeroes el.object3D.position every tick and
      // instead tracks the wrist pose on a separate Object3D it parents
      // directly to the scene (wristObject3D) — read that when present.
      const htc = this.el.components['hand-tracking-controls'];
      let confident;
      if (htc) {
        const wrist = htc.wristObject3D;
        if (wrist) {
          wrist.getWorldPosition(this.handPos);
          confident = !!(htc.hasPoses && wrist.visible);
        } else {
          confident = false;
        }
      } else {
        this.el.object3D.getWorldPosition(this.handPos);
        confident = isAncestorVisible(this.el.object3D);
      }

      const result = this.tracker.update({
        headPos: this.headPos,
        handPos: this.handPos,
        confident,
        t,
      });

      if (result) {
        this.firedCount++;
        const origin = { x: result.origin.x, y: result.origin.y, z: result.origin.z };

        // Arm-ray aim, computed fresh at the fire instant only — no
        // per-tick allocation, since this branch only runs on a fire.
        this.headEl.object3D.getWorldQuaternion(this.camQuat);
        this.camEuler.setFromQuaternion(this.camQuat, 'YXZ');
        const yaw = this.camEuler.y;
        const height = calib.height();

        const dir = armRayDir(
          { x: this.headPos.x, y: this.headPos.y, z: this.headPos.z },
          yaw,
          origin,
          this.data.hand,
          height,
          shoulderOpts
        );

        this.lastDir = dir;
        this.lastOffsets = armOffsets(height, shoulderOpts);
        this.el.sceneEl.emit('fired', { origin, dir, hand: this.data.hand });
      }
    },

    // Called ~4x/sec by debug-panel, never from the per-frame tick path —
    // safe to allocate a small plain object here.
    debugInfo() {
      const htc = this.el.components['hand-tracking-controls'];
      const wrist = htc && htc.wristObject3D;
      return {
        hand: this.data.hand,
        hasTrackingControls: !!htc,
        hasPoses: !!(htc && htc.hasPoses),
        hasWrist: !!wrist,
        wristVisible: !!(wrist && wrist.visible),
        handPos: { x: this.handPos.x, y: this.handPos.y, z: this.handPos.z },
        dist: this.headPos.distanceTo(this.handPos),
        baseline: this.tracker ? this.tracker.baseline() : Infinity,
        threshold: this.lastThreshold,
        state: this.tracker ? this.tracker.state() : 'none',
        firedCount: this.firedCount,
        lastDir: this.lastDir,
        lastOffsets: this.lastOffsets,
      };
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
