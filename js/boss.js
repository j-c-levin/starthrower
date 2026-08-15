import { PALETTE } from './palette.js';
import { makeRng } from './sky.js';
import { WAYPOINTS, BOSS } from './logic/script.js';
import { createSpline } from './logic/spline.js';
import { createGuardianPhases, ringAnchors, ANCHOR_RADIUS, RING_HEIGHTS } from './logic/bossphases.js';

const ANCHORS = ringAnchors(createSpline(WAYPOINTS), BOSS);

const DEBRIS_COUNT = 12;
const FINALE_BODY_MS = 5000;
const FINALE_DEBRIS_MS = 6500;
const BURST_AT_MS = [300, 1300, 2400];
const SPIN_RATE = 0.00012; // rad/ms — one halo revolution in ~52s
const RING_TILTS = { 1: '7 0 -4', 2: '-6 0 6', 3: '5 0 -8' };
const VISIBLE_BEATS = new Set(['derelict', 'boss', 'tally']);

function register() {
  const hslTmp = { h: 0, s: 0, l: 0 };
  function shade(hex, mult, satMult = 1) {
    const c = new THREE.Color(hex);
    c.getHSL(hslTmp);
    c.setHSL(hslTmp.h, Math.min(1, hslTmp.s * satMult), Math.min(1, hslTmp.l * mult));
    return c;
  }
  function mixc(hexA, hexB, f) {
    return new THREE.Color(hexA).lerp(new THREE.Color(hexB), f);
  }

  function xf(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    );
  }
  const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);

  function merged(parts) {
    const positions = [];
    const colors = [];
    for (const [geo, color, transform] of parts) {
      const src = geo.index ? geo.toNonIndexed() : geo;
      if (transform) src.applyMatrix4(transform);
      const pos = src.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        colors.push(color.r, color.g, color.b);
      }
      if (src !== geo) src.dispose();
      geo.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return out;
  }

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // point on the outward face at band angle a: u along the tangent, v vertical
  const outPos = (a, r, y, u = 0, v = 0) =>
    [r * Math.sin(a) + u * Math.cos(a), y + v, -r * Math.cos(a) + u * Math.sin(a)];

  function palette() {
    return {
      cHull: mixc(PALETTE.space, PALETTE.violet, 0.3).multiplyScalar(1.15),
      cDark: mixc(PALETTE.space, PALETTE.violet, 0.2).multiplyScalar(0.8),
      cPanel: mixc(PALETTE.space, PALETTE.violet, 0.42).multiplyScalar(1.5),
      cyan: new THREE.Color(PALETTE.cyan),
      cyanDim: shade(PALETTE.cyan, 0.5),
      magenta: shade(PALETTE.magenta, 0.9),
      magentaDim: shade(PALETTE.magenta, 0.5),
      amberDim: shade(PALETTE.amber, 0.5),
    };
  }

  // The Guardian: a monumental geometric sentinel machine, ~12m of hull with
  // thin spires beyond. Amber is reserved for the weak-point sockets so the
  // shootable rings read instantly against the violet structure.
  function buildStatic(cols, localAnchors) {
    const { cHull, cDark, cPanel, cyan, cyanDim, magenta, magentaDim, amberDim } = cols;
    const parts = [];

    parts.push([box(2.4, 12.4, 2.4), cHull, xf(0, 0.2, 0)]);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      parts.push([box(0.7, 12, 0.7), cDark, xf(sx * 1.35, 0.2, sz * 1.35)]);
    }
    parts.push([new THREE.OctahedronGeometry(3.6, 0), cPanel, xf(0, 0.8, 0, 0, 0, 0, 1, 1.1, 1)]);
    parts.push([new THREE.TorusGeometry(3.3, 0.35, 6, 24), cDark, xf(0, 0.8, 0, Math.PI / 2, 0, 0)]);
    for (const [ex, ez] of [[2.6, 2.6], [2.6, -2.6], [-2.6, 2.6], [-2.6, -2.6]]) {
      parts.push([new THREE.OctahedronGeometry(0.6, 0), cyan, xf(ex, 0.8, ez)]);
    }

    // three collar bands — one weak-point ring per phase lives on each
    RING_HEIGHTS.forEach((y, bi) => {
      parts.push([new THREE.TorusGeometry(6.9, 0.55, 6, 28), bi % 2 ? cDark : cHull,
        xf(0, y, 0, Math.PI / 2, 0, 0)]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + bi * 0.26;
        parts.push([box(0.5, 0.9, 0.5), i % 2 ? cyanDim : magentaDim,
          xf(...outPos(a, 7.35, y), 0, Math.PI - a, 0, 0.7)]);
      }
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5 + bi * 0.7;
        parts.push([box(0.5, 0.45, 4.9), cDark, xf(...outPos(a, 4.2, y), 0, -a, 0)]);
      }
    });

    // weak-point sockets at the exact spawn anchors, facing outward
    for (const ring of localAnchors) {
      for (const p of ring) {
        const ry = Math.PI - p.angle;
        parts.push([box(2.7, 2.7, 1.8), cDark, xf(...outPos(p.angle, ANCHOR_RADIUS - 0.9, p.y), 0, ry, 0)]);
        parts.push([box(2.9, 0.42, 0.42), amberDim, xf(...outPos(p.angle, ANCHOR_RADIUS - 0.35, p.y, 0, 1.55), 0, ry, 0)]);
        parts.push([box(2.9, 0.42, 0.42), amberDim, xf(...outPos(p.angle, ANCHOR_RADIUS - 0.35, p.y, 0, -1.55), 0, ry, 0)]);
        parts.push([box(0.42, 2.9, 0.42), amberDim, xf(...outPos(p.angle, ANCHOR_RADIUS - 0.35, p.y, 1.55), 0, ry, 0)]);
        parts.push([box(0.42, 2.9, 0.42), amberDim, xf(...outPos(p.angle, ANCHOR_RADIUS - 0.35, p.y, -1.55), 0, ry, 0)]);
      }
    }

    // outrigger pylons between the phase sectors
    for (const a of [-0.44, 1.01, 3.45]) {
      parts.push([box(1.6, 7.5, 1.1), cHull, xf(...outPos(a, 4.9, 2.6), 0, Math.PI - a, 0)]);
      parts.push([box(2.1, 0.9, 1.5), cPanel, xf(...outPos(a, 4.9, 6.6), 0, Math.PI - a, 0)]);
      parts.push([box(0.4, 0.4, 0.4), cyanDim, xf(...outPos(a, 4.9, 7.3), 0, Math.PI - a, 0)]);
    }

    // crown and keel
    parts.push([box(3.4, 1.1, 3.4), cDark, xf(0, 6.9, 0)]);
    parts.push([box(2.2, 1.0, 2.2), cHull, xf(0, 7.9, 0)]);
    parts.push([box(0.55, 3.2, 0.55), cDark, xf(0, 9.6, 0)]);
    parts.push([new THREE.OctahedronGeometry(0.95, 0), magenta, xf(0, 11.2, 0, 0, 0, 0, 1, 1.35, 1)]);
    parts.push([box(3.2, 1.2, 3.2), cDark, xf(0, -6.5, 0)]);
    parts.push([box(0.6, 3, 0.6), cHull, xf(0, -8, 0)]);
    parts.push([new THREE.OctahedronGeometry(0.5, 0), cyanDim, xf(0, -9.4, 0, 0, 0, 0, 1, 1.3, 1)]);

    // spine light strips
    for (const [i, [px, pz]] of [[1.25, 0], [0, 1.25], [-1.25, 0], [0, -1.25]].entries()) {
      parts.push([box(0.32, 9.4, 0.32), i % 2 ? cyanDim : cyan, xf(px, 0.5, pz)]);
    }

    return merged(parts);
  }

  // two counter-tilted halo rings, baked into one mesh; the group spins slowly
  function buildHalos(cols) {
    const { cHull, cPanel, cyan, cyanDim, magentaDim } = cols;
    const parts = [];
    const halo = (R, y, tilt, n, w, thick, studCol) => {
      const mTilt = xf(0, y, 0, tilt, 0, 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        parts.push([box(w, thick, 0.9), i % 2 ? cPanel : cHull,
          mul(mTilt, xf(R * Math.sin(a), 0, -R * Math.cos(a), 0, -a, 0))]);
        if (i % 2 === 0) {
          parts.push([box(0.45, thick + 0.55, 0.45), studCol,
            mul(mTilt, xf(R * Math.sin(a), 0, -R * Math.cos(a), 0, -a, 0))]);
        }
      }
    };
    halo(8.2, 6.0, 0.16, 12, 3.6, 0.5, cyan);
    halo(10.2, -3.6, -0.13, 14, 3.9, 0.6, magentaDim);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      parts.push([new THREE.OctahedronGeometry(0.8, 0), cyanDim,
        mul(xf(0, -3.6, 0, -0.13, 0, 0), xf(10.2 * Math.sin(a), 0, -10.2 * Math.cos(a)))]);
    }
    return merged(parts);
  }

  function buildChunkGeos(cols) {
    const { cHull, cDark, cPanel, cyanDim } = cols;
    const a = merged([
      [box(2.6, 1.5, 1.0), cDark],
      [box(1.4, 0.8, 1.6), cHull, xf(0.7, 0.55, 0.2, 0.3, 0.4, 0.2)],
      [box(0.5, 0.5, 0.5), cyanDim, xf(-0.8, 0.35, 0.4)],
    ]);
    const b = merged([
      [new THREE.OctahedronGeometry(1.1, 0), cHull, xf(0, 0, 0, 0.3, 0.5, 0.2, 1, 0.7, 1.2)],
      [box(1.8, 0.7, 0.9), cPanel, xf(-0.4, 0.4, -0.2, 0.2, 0.7, 0.4)],
    ]);
    return [a, b];
  }

  AFRAME.registerComponent('guardian', {
    init() {
      const c = BOSS.center;
      this.el.object3D.position.set(c.x, c.y, c.z);
      this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
      const cols = palette();
      const localAnchors = ANCHORS.map((ring) =>
        ring.map((p) => ({ x: p.x - c.x, y: p.y - c.y, z: p.z - c.z, angle: p.angle })));
      this.anchors = ANCHORS;

      this.el.setObject3D('guardianBody', new THREE.Mesh(buildStatic(cols, localAnchors), this.material));

      this.ringsEl = document.createElement('a-entity');
      this.el.appendChild(this.ringsEl);
      this.spinGroup = new THREE.Group();
      this.spinGroup.add(new THREE.Mesh(buildHalos(cols), this.material));
      this.ringsEl.setObject3D('guardianHalos', this.spinGroup);

      const rng = makeRng(517);
      const chunkGeos = buildChunkGeos(cols);
      this.debrisRoot = new THREE.Group();
      this.debrisRoot.visible = false;
      this.el.sceneEl.object3D.add(this.debrisRoot);
      this.debris = [];
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const mesh = new THREE.Mesh(chunkGeos[i % 2], this.material);
        this.debrisRoot.add(mesh);
        const ha = rng() * Math.PI * 2;
        const hr = 2.5 + rng() * 4;
        const home = new THREE.Vector3(hr * Math.sin(ha), -5 + rng() * 11.5, -hr * Math.cos(ha));
        const dir = new THREE.Vector3(Math.sin(ha) * 0.6, (rng() - 0.62) * 1.2, -Math.cos(ha) * 0.6).normalize();
        this.debris.push({
          mesh, home, dir,
          speed: 1.3 + rng() * 0.9,
          spin: 0.25 + rng() * 0.35,
          axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
          scale: 0.8 + rng() * 0.9,
        });
      }

      this.machine = createGuardianPhases();
      this.state = 'idle';
      this.beatVisible = false;
      this.finaleMs = 0;
      this.burstsFired = 0;
      this.spinPhase = 0;
      this.spinBoost = 1;
      this.el.object3D.visible = false;

      this.onBeatChanged = (evt) => {
        const name = evt.detail.name;
        if (name === 'tally') this.applyAction(this.machine.timeout());
        this.beatVisible = VISIBLE_BEATS.has(name);
        this.syncVisible();
      };
      this.onBossPhase = (evt) => this.applyAction(this.machine.phaseEvent(evt.detail.phase));
      this.onTargetHit = (evt) => {
        if (evt.detail.type === 'weakpoint') this.applyAction(this.machine.weakpointHit(evt.detail.id));
      };
      this.onRideStarted = () => this.reset();
      this.onTallyDone = () => { this.beatVisible = false; this.reset(); };
      const scene = this.el.sceneEl;
      scene.addEventListener('beatchanged', this.onBeatChanged);
      scene.addEventListener('bossphase', this.onBossPhase);
      scene.addEventListener('targethit', this.onTargetHit);
      scene.addEventListener('ridestarted', this.onRideStarted);
      scene.addEventListener('tallydone', this.onTallyDone);
    },

    remove() {
      const scene = this.el.sceneEl;
      scene.removeEventListener('beatchanged', this.onBeatChanged);
      scene.removeEventListener('bossphase', this.onBossPhase);
      scene.removeEventListener('targethit', this.onTargetHit);
      scene.removeEventListener('ridestarted', this.onRideStarted);
      scene.removeEventListener('tallydone', this.onTallyDone);
      scene.object3D.remove(this.debrisRoot);
      this.debrisRoot.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
      this.el.getObject3D('guardianBody').geometry.dispose();
      this.spinGroup.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
      this.el.removeObject3D('guardianBody');
      this.ringsEl.removeObject3D('guardianHalos');
      this.material.dispose();
    },

    manager() {
      return this.el.sceneEl.components['target-manager'];
    },

    syncVisible() {
      this.el.object3D.visible = this.beatVisible && this.state !== 'gone';
    },

    applyAction(action) {
      if (!action) return;
      const manager = this.manager();
      if (action.open) {
        this.state = 'active';
        this.syncVisible();
        if (manager) {
          manager.retireAll('weakpoint');
          const ring = this.anchors[action.open - 1];
          action.ids.forEach((id, i) => manager.spawnWeakpoint({ id, pos: ring[i] }));
        }
        this.reconfigure(action.open);
        if (action.early) this.el.sceneEl.emit('bossphase', { phase: action.open });
      } else if (action.defeated) {
        if (manager) manager.retireAll('weakpoint');
        this.el.sceneEl.emit('bossdefeated', { timedOut: action.timedOut });
        this.startFinale();
      }
    },

    reconfigure(phase) {
      this.spinBoost = 2.4;
      this.ringsEl.removeAttribute('animation__tilt');
      this.ringsEl.setAttribute('animation__tilt', {
        property: 'rotation', to: RING_TILTS[phase] || '0 0 0',
        dur: 1500, easing: 'easeInOutQuad',
      });
      this.el.removeAttribute('animation__pulse');
      this.el.setAttribute('animation__pulse', {
        property: 'scale', from: '1 1 1', to: '1.04 1.04 1.04',
        dur: 650, dir: 'alternate', loop: 2, easing: 'easeInOutQuad',
      });
    },

    startFinale() {
      this.state = 'finale';
      this.finaleMs = 0;
      this.burstsFired = 0;
      this.el.removeAttribute('animation__pulse');
      const c = BOSS.center;
      for (const d of this.debris) {
        d.mesh.position.set(c.x + d.home.x, c.y + d.home.y, c.z + d.home.z);
        d.mesh.rotation.set(0, 0, 0);
        d.mesh.scale.setScalar(d.scale);
      }
      this.debrisRoot.visible = true;
    },

    reset() {
      this.machine = createGuardianPhases();
      this.state = 'idle';
      this.finaleMs = 0;
      this.burstsFired = 0;
      this.spinBoost = 1;
      this.debrisRoot.visible = false;
      const c = BOSS.center;
      const o = this.el.object3D;
      o.position.set(c.x, c.y, c.z);
      o.scale.setScalar(1);
      o.rotation.set(0, 0, 0);
      this.el.removeAttribute('animation__pulse');
      this.ringsEl.removeAttribute('animation__tilt');
      this.ringsEl.object3D.rotation.set(0, 0, 0);
      this.syncVisible();
    },

    tick(t, dt) {
      if (!dt) return;
      this.spinBoost += (1 - this.spinBoost) * (1 - Math.exp(-dt / 1200));
      this.spinPhase += dt * SPIN_RATE * this.spinBoost;
      this.spinGroup.rotation.y = this.spinPhase;

      const o = this.el.object3D;
      const c = BOSS.center;
      if (this.state === 'idle' || this.state === 'active') {
        o.position.y = c.y + 0.4 * Math.sin(t * 0.0005); // ~0.08Hz hover
        return;
      }
      if (this.state !== 'finale') return;

      this.finaleMs += dt;
      const manager = this.manager();
      while (this.burstsFired < BURST_AT_MS.length && this.finaleMs >= BURST_AT_MS[this.burstsFired]) {
        const d = this.debris[(this.burstsFired * 5) % DEBRIS_COUNT];
        if (manager) manager.burst({ x: d.mesh.position.x, y: d.mesh.position.y, z: d.mesh.position.z }, 2.2);
        this.burstsFired += 1;
      }

      // the hull lingers huge, then folds in on itself while the chunks sail clear
      const k = Math.min(1, this.finaleMs / FINALE_BODY_MS);
      const s = Math.max(0.001, 1 - k * k * k * k);
      o.scale.setScalar(s);
      o.position.y = c.y - 3.5 * k * k * k;
      o.rotation.z = 0.12 * k;
      if (k >= 1 && this.el.object3D.visible) this.el.object3D.visible = false;

      const k2 = Math.min(1, this.finaleMs / FINALE_DEBRIS_MS);
      const fade = k2 < 0.55 ? 1 : Math.max(0.001, 1 - ((k2 - 0.55) / 0.45) ** 2);
      const step = dt / 1000;
      for (const d of this.debris) {
        d.mesh.position.addScaledVector(d.dir, d.speed * step);
        d.mesh.rotateOnAxis(d.axis, d.spin * step);
        d.mesh.scale.setScalar(d.scale * fade);
      }
      if (k2 >= 1) {
        this.debrisRoot.visible = false;
        this.state = 'gone';
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
