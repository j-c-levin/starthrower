import { createHandTracker, throwThreshold } from './logic/firing.js';
import { createHeightSampler } from './logic/heights.js';

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
      this.headEl.object3D.getWorldPosition(this.headPos);
      this.sampler.addSample(this.headPos.y);
    },

    threshold() {
      return throwThreshold(this.sampler.stable());
    },

    onClick() {
      const camera = this.el.camera;
      const camEl = camera && camera.el;
      if (!camEl) return;
      camEl.object3D.getWorldPosition(this.headPos);
      camEl.object3D.getWorldQuaternion(this.camQuat);
      this.camDir.set(0, 0, -1).applyQuaternion(this.camQuat);
      const origin = { x: this.headPos.x, y: this.headPos.y, z: this.headPos.z };
      const through = {
        x: origin.x + this.camDir.x,
        y: origin.y + this.camDir.y,
        z: origin.z + this.camDir.z,
      };
      this.el.emit('fired', { origin, through, hand: 'desktop' });
    },
  });

  AFRAME.registerComponent('hand-thrower', {
    schema: { hand: { default: 'left' } },

    init() {
      this.headEl = this.el.sceneEl.querySelector('#head');
      this.headPos = new THREE.Vector3();
      this.handPos = new THREE.Vector3();
      this.tracker = null;
      this.lastThreshold = null;
    },

    tick(t) {
      const calib = this.el.sceneEl.components.calibration;
      if (!calib || !this.headEl || !this.headEl.object3D) return;

      const threshold = calib.threshold();
      if (this.tracker === null || Math.abs(threshold - this.lastThreshold) > THRESHOLD_RECREATE_DELTA) {
        this.tracker = createHandTracker({ threshold });
        this.lastThreshold = threshold;
      }

      this.headEl.object3D.getWorldPosition(this.headPos);
      this.el.object3D.getWorldPosition(this.handPos);
      const confident = isAncestorVisible(this.el.object3D);

      const result = this.tracker.update({
        headPos: this.headPos,
        handPos: this.handPos,
        confident,
        t,
      });

      if (result) {
        const origin = { x: result.origin.x, y: result.origin.y, z: result.origin.z };
        const through = { x: result.through.x, y: result.through.y, z: result.through.z };
        this.el.sceneEl.emit('fired', { origin, through, hand: this.data.hand });
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
