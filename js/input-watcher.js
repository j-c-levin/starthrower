import { PALETTE } from './palette.js';

const FONT = 'lib/fonts/Roboto-msdf.json';
const FONT_IMAGE = 'lib/fonts/Roboto-msdf.png';
const ABSENCE_MS = 6000;
const AHEAD_M = 2;
const FOLLOW_TAU_MS = 700;
const WAVE_W = 0.005; // rad/ms -> ~0.8Hz, under the 1Hz cap
const BOB_W = 0.0012;
const TAU = Math.PI * 2;

function isHandTracked(handEl) {
  const htc = handEl && handEl.components['hand-tracking-controls'];
  if (!htc) return false;
  const wrist = htc.wristObject3D;
  return !!(htc.hasPoses && wrist && wrist.visible);
}

function register() {
  function textEntity({ width, color, position, value }) {
    const el = document.createElement('a-entity');
    el.setAttribute('position', position);
    el.setAttribute('text', {
      value,
      font: FONT,
      fontImage: FONT_IMAGE,
      negate: true,
      color,
      width,
      align: 'center',
      anchor: 'center',
    });
    return el;
  }

  function buildHandMesh() {
    const positions = [];
    const colors = [];
    const box = (w, h, d, px, py, pz, rz, color) => {
      const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      if (rz) geo.rotateZ(rz);
      geo.translate(px, py, pz);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        colors.push(color.r, color.g, color.b);
      }
      geo.dispose();
    };

    const amber = new THREE.Color(PALETTE.amber);
    const amberHi = amber.clone().offsetHSL(0, 0, 0.09);
    const cuff = new THREE.Color(PALETTE.violet).lerp(new THREE.Color(PALETTE.space), 0.35);

    box(0.15, 0.14, 0.04, 0, 0.07, 0, 0, amber);
    box(0.03, 0.095, 0.035, -0.051, 0.187, 0, 0.08, amberHi);
    box(0.03, 0.12, 0.035, -0.017, 0.2, 0, 0.03, amber);
    box(0.03, 0.125, 0.035, 0.017, 0.202, 0, -0.03, amberHi);
    box(0.03, 0.1, 0.035, 0.051, 0.19, 0, -0.08, amber);
    box(0.03, 0.085, 0.035, 0.098, 0.1, 0, -0.7, amberHi);
    box(0.12, 0.05, 0.05, 0, -0.028, 0, 0, cuff);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  }

  AFRAME.registerComponent('input-watcher', {
    init() {
      this.rigEl = this.el.querySelector('#rig');
      this.headEl = this.el.querySelector('#head');
      this.handL = this.el.querySelector('#handL');
      this.handR = this.el.querySelector('#handR');

      this.absMs = 0;
      this.forced = false;
      this.showing = false;
      this.hangarLine = null;
      this.euler = new THREE.Euler();
      this.tx = 0;
      this.ty = 0;
      this.tz = 0;
      this.tyaw = 0;

      this.group = document.createElement('a-entity');
      this.group.setAttribute('visible', false);

      this.inner = document.createElement('a-entity');
      this.group.appendChild(this.inner);

      this.handMesh = buildHandMesh();
      this.handMesh.position.set(0, 0.16, 0);
      const attachMesh = () => this.inner.object3D.add(this.handMesh);
      if (this.inner.object3D) attachMesh();
      else this.inner.addEventListener('loaded', attachMesh, { once: true });

      this.line1 = textEntity({
        width: 1.5,
        color: PALETTE.ink,
        position: '0 -0.06 0',
        value: 'turn on hand tracking in settings',
      });
      this.inner.appendChild(this.line1);

      this.line2 = textEntity({
        width: 1.3,
        color: PALETTE.amber,
        position: '0 -0.2 0',
        value: 'or tap the glowing pad',
      });
      this.line2.setAttribute('visible', false);
      this.inner.appendChild(this.line2);

      if (this.rigEl) this.rigEl.appendChild(this.group);
    },

    remove() {
      this.group.remove();
    },

    forceShow(on = true) {
      this.forced = on !== false;
      if (!this.forced) {
        this.absMs = 0;
        this.hide();
      }
    },

    computeTarget() {
      const head = this.headEl.object3D;
      this.euler.setFromQuaternion(head.quaternion, 'YXZ');
      const yaw = this.euler.y;
      this.tx = head.position.x - Math.sin(yaw) * AHEAD_M;
      this.ty = head.position.y;
      this.tz = head.position.z - Math.cos(yaw) * AHEAD_M;
      this.tyaw = yaw;
    },

    show() {
      this.showing = true;
      this.computeTarget();
      const g = this.group.object3D;
      g.position.set(this.tx, this.ty, this.tz);
      g.rotation.set(0, this.tyaw, 0);
      g.visible = true;
    },

    hide() {
      if (!this.showing) return;
      this.showing = false;
      this.group.object3D.visible = false;
    },

    tick(t, dt) {
      if (!dt) return;
      if (!this.headEl || !this.headEl.object3D || !this.group.object3D) return;

      let shouldShow = true;
      if (!this.forced) {
        const tracked = isHandTracked(this.handL) || isHandTracked(this.handR);
        if (tracked || !this.el.is('vr-mode')) this.absMs = 0;
        else this.absMs += dt;
        shouldShow = this.absMs >= ABSENCE_MS;
      }
      if (!shouldShow) {
        this.hide();
        return;
      }
      if (!this.showing) this.show();

      this.computeTarget();
      const g = this.group.object3D;
      const k = 1 - Math.exp(-dt / FOLLOW_TAU_MS);
      g.position.x += (this.tx - g.position.x) * k;
      g.position.y += (this.ty - g.position.y) * k;
      g.position.z += (this.tz - g.position.z) * k;
      let dyaw = (((this.tyaw - g.rotation.y + Math.PI) % TAU) + TAU) % TAU - Math.PI;
      g.rotation.y += dyaw * k;

      this.inner.object3D.position.y = 0.03 * Math.sin(t * BOB_W);
      this.handMesh.rotation.z = 0.2 * Math.sin(t * WAVE_W);

      const gm = this.el.components['game-manager'];
      const hangar = !!(gm && gm.state === 'hangar');
      if (hangar !== this.hangarLine) {
        this.hangarLine = hangar;
        if (this.line2.object3D) this.line2.object3D.visible = hangar;
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
