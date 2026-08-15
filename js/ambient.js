import { PALETTE } from './palette.js';
import { makeRng, skyColorAt, skyPalette } from './sky.js';

const BEATS = ['departure', 'asteroids', 'derelict', 'boss', 'tally'];
const NEBULA_DIST = 2350;

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

  // like targets.js merged(), plus color: null keeps a part's own vertex colors
  function merged(parts) {
    const positions = [];
    const colors = [];
    for (const [geo, color, transform] of parts) {
      const src = geo.index ? geo.toNonIndexed() : geo;
      if (transform) src.applyMatrix4(transform);
      const pos = src.getAttribute('position');
      const own = color ? null : src.getAttribute('color');
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (own) colors.push(own.getX(i), own.getY(i), own.getZ(i));
        else colors.push(color.r, color.g, color.b);
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

  function buildHangarShell() {
    const cFloor = shade(PALETTE.space, 1.3);
    const cPlateA = shade(PALETTE.space, 1.75);
    const cPlateB = shade(PALETTE.space, 1.05);
    const cWall = mixc(PALETTE.space, PALETTE.violet, 0.22).multiplyScalar(1.35);
    const cRib = mixc(PALETTE.space, PALETTE.violet, 0.35).multiplyScalar(1.9);
    const cDark = shade(PALETTE.space, 0.85);
    const cMachine = mixc(PALETTE.space, PALETTE.violet, 0.3).multiplyScalar(2.4);

    const parts = [
      [box(22, 0.8, 40), cFloor, xf(0, -0.4, -4)],
      [box(22, 0.8, 40), cDark, xf(0, 10.4, -4)],
      [box(1, 11, 35), cWall, xf(-8.5, 5.5, -5.5)],
      [box(1, 11, 35), cWall, xf(8.5, 5.5, -5.5)],
      [box(18, 11, 1), cWall, xf(0, 5.5, 12.5)],
      [box(3.75, 11, 1), cWall, xf(-6.125, 5.5, -22.5)],
      [box(3.75, 11, 1), cWall, xf(6.125, 5.5, -22.5)],
      [box(8.5, 4, 1), cWall, xf(0, 9, -22.5)],
    ];

    for (let i = 0; i < 6; i++) {
      const z = 2 - i * 4;
      parts.push([box(3.4, 0.07, 3.4), i % 2 ? cPlateA : cPlateB, xf(-2.1, 0.03, z)]);
      parts.push([box(3.4, 0.07, 3.4), i % 2 ? cPlateB : cPlateA, xf(2.1, 0.03, z)]);
    }

    for (const z of [10, 6, 2, -2, -6, -10, -14, -18]) {
      parts.push([box(0.5, 10, 0.9), cRib, xf(-7.75, 5, z)]);
      parts.push([box(0.5, 10, 0.9), cRib, xf(7.75, 5, z)]);
      parts.push([box(16, 0.7, 0.9), cRib, xf(0, 9.65, z)]);
    }

    for (const s of [-1, 1]) {
      parts.push([box(1.6, 0.25, 30), cRib, xf(s * 6.9, 6, -6)]);
      parts.push([box(0.1, 0.9, 30), cDark, xf(s * 6.15, 6.6, -6)]);
      for (const z of [4, -4, -12]) parts.push([box(0.3, 6, 0.3), cDark, xf(s * 6.9, 3, z)]);
    }
    parts.push([box(12.2, 0.25, 1.6), cRib, xf(0, 6, -11)]);
    parts.push([box(12.2, 0.1, 0.12), cDark, xf(0, 6.9, -11.7)]);
    parts.push([box(12.2, 0.1, 0.12), cDark, xf(0, 6.9, -10.3)]);

    parts.push([box(2.6, 0.5, 2.6), cMachine, xf(0, 0.25, -6)]);
    parts.push([box(1.4, 0.45, 1.4), cRib, xf(0, 0.72, -6)]);
    parts.push([box(0.7, 0.3, 0.7), cMachine, xf(0, 1.05, -6)]);
    parts.push([box(0.2, 6.6, 0.2), cDark, xf(0, 6.7, -6)]);
    parts.push([box(0.9, 0.5, 0.9), cMachine, xf(0, 9.6, -6)]);

    for (const s of [-1, 1]) {
      parts.push([box(1.8, 1.1, 0.9), cRib, xf(s * 3.4, 0.55, -7.6, 0, -s * 0.5, 0)]);
    }

    const stack = [
      [-6.4, 0.7, 9, 1.4, 0], [-5.9, 2, 8.8, 1.2, 0.3], [-6.6, 0.6, 7.2, 1.2, 0.5],
      [6.3, 0.75, 9, 1.5, 0.2], [6.4, 2.05, 9.1, 1.1, 0.6], [5.6, 0.6, 7.4, 1.2, 0.9],
    ];
    for (const [x, y, z, s, ry] of stack) {
      parts.push([box(s, s, s), cRib, xf(x, y, z, 0, ry, 0)]);
    }

    return merged(parts);
  }

  function buildHangarGlow() {
    const cyan = new THREE.Color(PALETTE.cyan);
    const cyanDim = shade(PALETTE.cyan, 0.55);
    const amber = new THREE.Color(PALETTE.amber);
    const amberDim = shade(PALETTE.amber, 0.6);
    const magenta = shade(PALETTE.magenta, 0.85);
    const magentaDim = shade(PALETTE.magenta, 0.5);
    const violetHi = shade(PALETTE.violet, 1.8);

    const parts = [
      [box(0.35, 7.3, 0.35), cyan, xf(-4.5, 3.65, -21.9)],
      [box(0.35, 7.3, 0.35), cyan, xf(4.5, 3.65, -21.9)],
      [box(9.7, 0.35, 0.35), cyan, xf(0, 7.15, -21.9)],
      [box(9, 0.07, 0.45), shade(PALETTE.cyan, 1.15), xf(0, 0.045, -21.6)],
      [box(0.22, 0.06, 26), amberDim, xf(-1.7, 0.045, -9)],
      [box(0.22, 0.06, 26), amberDim, xf(1.7, 0.045, -9)],
    ];

    for (const z of [-10, -13, -16, -19]) {
      parts.push([box(1.1, 0.055, 0.4), amber, xf(-0.5, 0.05, z, 0, 0.5, 0)]);
      parts.push([box(1.1, 0.055, 0.4), amber, xf(0.5, 0.05, z, 0, -0.5, 0)]);
    }

    for (const s of [-1, 1]) {
      parts.push([box(0.12, 0.3, 31), cyanDim, xf(s * 7.95, 3.4, -5.5)]);
      parts.push([box(0.12, 0.2, 31), magentaDim, xf(s * 7.95, 8.2, -5.5)]);
      for (const z of [2, -2, -6, -10, -14]) {
        parts.push([box(0.18, 0.08, 0.18), amber, xf(s * 6.2, 6.16, z)]);
      }
      parts.push([box(1.5, 0.6, 0.07), s < 0 ? cyanDim : magentaDim, xf(s * 3.4, 1.35, -7.15, -0.35, -s * 0.5, 0)]);
    }

    parts.push([new THREE.TorusGeometry(1.6, 0.12, 6, 28), violetHi, xf(0, 5.8, 11.9)]);
    parts.push([new THREE.OctahedronGeometry(0.5, 0), amber, xf(0, 5.8, 11.85, 0, 0, 0, 1, 1.3, 0.4)]);

    for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      parts.push([box(dz ? 2.8 : 0.14, 0.1, dx ? 2.8 : 0.14), amberDim, xf(dx, 0.52, -6 + dz)]);
    }
    parts.push([new THREE.OctahedronGeometry(0.5, 0), amber, xf(0, 3.15, -6, 0, 0, 0, 0.75, 1.15, 0.75)]);

    return merged(parts);
  }

  function buildCorridor() {
    const cPylon = mixc(PALETTE.space, PALETTE.violet, 0.28).multiplyScalar(1.5);
    const cBeam = shade(PALETTE.space, 1.1);
    const cyan = new THREE.Color(PALETTE.cyan);
    const magenta = shade(PALETTE.magenta, 0.9);
    const amberDim = shade(PALETTE.amber, 0.55);
    const parts = [];

    const gates = [-34, -56, -78, -100, -122, -144, -166];
    gates.forEach((z, i) => {
      const tip = i % 2 ? magenta : cyan;
      for (const s of [-1, 1]) {
        parts.push([box(1.0, 9, 1.0), cPylon, xf(s * 7.5, 2, z)]);
        parts.push([box(0.45, 0.45, 0.45), tip, xf(s * 7.5, 6.9, z)]);
        parts.push([box(0.18, 2.4, 0.2), tip.clone().multiplyScalar(0.55), xf(s * 7.02, 2.2, z)]);
      }
      parts.push([box(16, 0.5, 0.5), cBeam, xf(0, 7.2, z)]);
      if (i % 2 === 0) parts.push([box(0.7, 0.28, 0.28), amberDim, xf(0, 6.75, z)]);
    });

    for (let z = -26; z >= -174; z -= 12) {
      parts.push([box(0.18, 0.12, 2.2), amberDim, xf(-2.4, -0.6, z)]);
      parts.push([box(0.18, 0.12, 2.2), amberDim, xf(2.4, -0.6, z)]);
    }

    return merged(parts);
  }

  const railX = (z) => 18 * Math.sin(((z + 180) / -360) * Math.PI * 2);

  function rockPart(parts, rng, x, y, z, s, col, colHi) {
    const rx = rng() * Math.PI, ry = rng() * Math.PI, rz = rng() * Math.PI;
    const sy = 0.7 + rng() * 0.5, sz = 0.75 + rng() * 0.5;
    parts.push([new THREE.IcosahedronGeometry(1, 0), col, xf(x, y, z, rx, ry, rz, s, s * sy, s * sz)]);
    if (rng() < 0.5) {
      const c = s * (0.35 + rng() * 0.25);
      parts.push([new THREE.IcosahedronGeometry(1, 0), colHi,
        xf(x + s * 0.5, y + s * 0.35 * (rng() - 0.5), z + s * 0.3, ry, rz, rx, c, c * 1.3, c)]);
    }
  }

  function buildFieldNear() {
    const rng = makeRng(9151);
    const parts = [];
    const shades = [
      mixc(PALETTE.space, PALETTE.violet, 0.35).multiplyScalar(0.85),
      mixc(PALETTE.space, PALETTE.violet, 0.5).multiplyScalar(0.65),
      shade(PALETTE.violet, 0.26),
    ];
    const hi = shade(PALETTE.violet, 0.5);
    for (let i = 0; i < 28; i++) {
      const z = -172 - rng() * 410;
      const side = rng() < 0.5 ? -1 : 1;
      const lat = 13 + rng() * 44;
      const y = 2 + (rng() - 0.42) * 58;
      const clearance = Math.hypot(lat, y - 2);
      const s = 2.5 + rng() * (clearance > 30 ? 9 : 5);
      rockPart(parts, rng, railX(z) + side * lat, y, z, s, shades[i % 3], hi);
    }
    return merged(parts);
  }

  function buildFieldFar() {
    const rng = makeRng(40317);
    const parts = [];
    const cA = shade(PALETTE.space, 1.2);
    const cB = mixc(PALETTE.space, PALETTE.violet, 0.32).multiplyScalar(0.45);
    const hi = mixc(PALETTE.space, PALETTE.violet, 0.45).multiplyScalar(0.8);
    for (let i = 0; i < 12; i++) {
      const z = -140 - rng() * 580;
      const side = i % 2 ? -1 : 1;
      const lat = 140 + rng() * 220;
      const y = 2 + (rng() - 0.5) * 260;
      const s = 16 + rng() * 26;
      rockPart(parts, rng, side * lat, y, z, s, rng() < 0.5 ? cA : cB, hi);
    }
    return merged(parts);
  }

  function nebulaPlane(parts, azimuthDeg, elevDeg, w, h, core, skyCols, seed) {
    const rng = makeRng(seed);
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevDeg * Math.PI) / 180;
    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)
    );
    const center = dir.clone().multiplyScalar(NEBULA_DIST);
    const m = new THREE.Matrix4().lookAt(center, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    m.setPosition(center);

    const geo = new THREE.PlaneGeometry(w, h, 24, 14);
    geo.rotateY(Math.PI); // lookAt points +z away from the origin; the plane must face it
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const world = new THREE.Vector3();
    const pA = rng() * Math.PI * 2, pB = rng() * Math.PI * 2;
    const mid = core.clone().multiplyScalar(0.55);
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i) / (w * 0.5);
      const ly = pos.getY(i) / (h * 0.5);
      world.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      const edge = skyColorAt(world.y / world.length(), skyCols);
      const wob = 0.16 * Math.sin(lx * 5.1 + pA) + 0.13 * Math.sin(ly * 4.3 + lx * 2.2 + pB);
      const r = Math.min(1, Math.hypot(lx, ly) * (1 + wob));
      const t = r * r * (3 - 2 * r);
      const f = (t - 0.55) / 0.45;
      const c = t < 0.55
        ? core.clone().lerp(mid, t / 0.55)
        : new THREE.Color(
            mid.r + (edge.r - mid.r) * f,
            mid.g + (edge.g - mid.g) * f,
            mid.b + (edge.b - mid.b) * f
          );
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push([geo, null, m]);
  }

  function buildNebulae() {
    const skyCols = skyPalette();
    const parts = [];
    const magentaCore = mixc(PALETTE.magenta, PALETTE.violet, 0.45).multiplyScalar(0.5);
    const cyanCore = mixc(PALETTE.cyan, PALETTE.space, 0.55).multiplyScalar(0.75);
    const violetCore = shade(PALETTE.violet, 0.55);
    nebulaPlane(parts, -38, 9, 1500, 800, magentaCore, skyCols, 71);
    nebulaPlane(parts, 57, 22, 950, 540, cyanCore, skyCols, 72);
    nebulaPlane(parts, 168, 14, 1150, 620, violetCore, skyCols, 73);
    return merged(parts);
  }

  AFRAME.registerComponent('ambient-director', {
    init() {
      this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
      this.root = new THREE.Group();

      const mesh = (geo) => new THREE.Mesh(geo, this.material);
      const group = (...geos) => {
        const g = new THREE.Group();
        for (const geo of geos) g.add(mesh(geo));
        this.root.add(g);
        return g;
      };

      this.beatGroups = {
        departure: group(buildHangarShell(), buildHangarGlow(), buildCorridor()),
        asteroids: group(buildFieldNear(), buildFieldFar()),
      };
      this.nebulae = mesh(buildNebulae());
      this.nebulae.frustumCulled = false;
      this.root.add(this.nebulae);

      this.el.setObject3D('ambientScenery', this.root);
      this.setBeat('departure');
      this.rigEl = document.querySelector('#rig');

      this.onBeatChanged = (evt) => this.setBeat(evt.detail.name);
      this.onTallyDone = () => this.setBeat('departure');
      this.el.addEventListener('beatchanged', this.onBeatChanged);
      this.el.addEventListener('tallydone', this.onTallyDone);
    },

    // nebulae ride with the rig like the sky dome: baked sky-matched edges stay seamless
    tick() {
      if (this.rigEl) this.nebulae.position.copy(this.rigEl.object3D.position);
    },

    // previous beat stays visible (no pop at the boundary), next is pre-warmed
    setBeat(name) {
      const idx = BEATS.indexOf(name);
      if (idx === -1) return;
      for (const [beat, g] of Object.entries(this.beatGroups)) {
        const bi = BEATS.indexOf(beat);
        g.visible = bi >= idx - 1 && bi <= idx + 1;
      }
    },

    remove() {
      this.el.removeEventListener('beatchanged', this.onBeatChanged);
      this.el.removeEventListener('tallydone', this.onTallyDone);
      this.root.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
      this.material.dispose();
      this.el.removeObject3D('ambientScenery');
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
