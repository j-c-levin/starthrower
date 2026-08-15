import { PALETTE } from './palette.js';
import { makeRng, skyColorAt, skyPalette } from './sky.js';
import { WAYPOINTS, EVENTS } from './logic/script.js';
import { createSpline } from './logic/spline.js';

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

  // ---- derelict beat (540-900m): a colossal broken ship in two sections.
  // Forward hull looms to port of the outward-bulging rail; the aft engine
  // section lies to starboard past the break; the rail dives through the gap.
  // Rail-anchored parts (window sockets, rib rings) are computed from the
  // shipped spline + spawn events so they stay aligned with script.js.
  const rail = createSpline(WAYPOINTS);
  const derelictPopups = EVENTS.filter(
    (e) => e.type === 'spawn' && e.target === 'popup' && e.at >= 540 && e.at < 900
  );
  const FWD = { x: -14, y: 4, z: -655, ry: -0.05 };
  const AFT = { x: 38, y: 2, z: -884, ry: 0.18, rz: -0.3 };
  // popups these indices are windows in solid hull; the rest ride torn debris rafts
  const HULL_POPUPS = new Set([2, 3, 4, 5, 6, 7, 9]);
  const RING_N = 14;
  const RINGS = [
    { at: 745, R: 11.5, lift: 2.5, drop: [8, 9, 10], tint: 'amber' },
    { at: 772, R: 10.5, lift: 2, drop: [3, 4], tint: 'magenta' },
    { at: 802, R: 12.5, lift: 3, drop: [11, 12, 13], tint: 'amber' },
  ];

  const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
  const mFwd = () => xf(FWD.x, FWD.y, FWD.z, 0, FWD.ry, 0);
  const mAft = () => xf(AFT.x, AFT.y, AFT.z, 0, AFT.ry, AFT.rz);

  function ringSegs(ring) {
    const p = rail.pointAt(ring.at);
    const segs = [];
    for (let i = 0; i < RING_N; i++) {
      const a = -Math.PI / 2 + (i / RING_N) * Math.PI * 2;
      segs.push({
        i,
        kept: !ring.drop.includes(i),
        edge: !ring.drop.includes(i) &&
          (ring.drop.includes((i + 1) % RING_N) || ring.drop.includes((i + RING_N - 1) % RING_N)),
        x: p.x + ring.R * Math.cos(a),
        y: p.y + ring.lift + ring.R * Math.sin(a),
        z: p.z,
        a,
      });
    }
    return segs;
  }

  // perimeter of a w x h rectangle centered on the origin -> position + edge angle
  function rimPoint(w, h, t) {
    const per = 2 * (w + h);
    let d = ((t % 1) + 1) % 1 * per;
    if (d < w) return { x: -w / 2 + d, y: -h / 2, a: 0 };
    d -= w;
    if (d < h) return { x: w / 2, y: -h / 2 + d, a: Math.PI / 2 };
    d -= h;
    if (d < w) return { x: w / 2 - d, y: h / 2, a: 0 };
    d -= w;
    return { x: -w / 2, y: h / 2 - d, a: Math.PI / 2 };
  }

  function ribArc(parts, col, m, cx, cy, lz, R, a0, a1, n, th) {
    const seg = (Math.abs(a1 - a0) * R) / n * 1.18;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0);
      const local = xf(cx + R * Math.cos(a), cy + R * Math.sin(a), lz, 0, 0, a + Math.PI / 2);
      parts.push([box(th, seg, th), col, m ? mul(m, local) : local]);
    }
  }

  // world x of the forward hull's starboard flank at a given world z
  const fwdFlankX = (z) => FWD.x + 21 + (z - FWD.z) * FWD.ry;

  function scatterDebris(parts, rng, cols, z0, z1, count, distOfZ) {
    for (let i = 0; i < count; i++) {
      const z = z0 + rng() * (z1 - z0);
      const side = rng() < 0.5 ? -1 : 1;
      const p = rail.pointAt(distOfZ(z));
      const x = p.x + side * (6 + rng() * 11);
      const y = p.y + (rng() - 0.42) * 14;
      const col = cols[i % cols.length];
      if (rng() < 0.62) {
        parts.push([box(2 + rng() * 5, 1.5 + rng() * 3.5, 0.6 + rng() * 0.8), col,
          xf(x, y, z, rng() * 3, rng() * 3, rng() * 3)]);
      } else {
        const s = 1 + rng() * 2.6;
        parts.push([new THREE.IcosahedronGeometry(1, 0), col,
          xf(x, y, z, rng() * 3, rng() * 3, rng() * 3, s, s * 0.8, s * 1.1)]);
      }
    }
  }

  function buildWreckPlates() {
    const rng = makeRng(6021);
    const cDark = mixc(PALETTE.space, PALETTE.amber, 0.05).multiplyScalar(0.72);
    const cMid = mixc(PALETTE.space, PALETTE.amber, 0.09).multiplyScalar(1.05);
    const cCool = mixc(PALETTE.space, PALETTE.violet, 0.24).multiplyScalar(0.8);
    const cRust = mixc(PALETTE.space, PALETTE.amber, 0.18).multiplyScalar(0.9);
    const parts = [];
    const mF = mFwd();
    const mA = mAft();
    const fp = (geo, col, local) => parts.push([geo, col, mul(mF, local)]);
    const ap = (geo, col, local) => parts.push([geo, col, mul(mA, local)]);

    // forward hull: keel slab + upper works + belly, ~170m of ship
    fp(box(42, 24, 168), cDark, xf(0, 0, 0));
    fp(box(34, 10, 146), cMid, xf(-2, 15, -8));
    fp(box(36, 9, 150), cMid, xf(1, -14, 6));
    fp(box(16, 12, 44), cMid, xf(-4, 24, 18));
    fp(box(9, 9, 24), cCool, xf(-7, 32, 8));
    fp(box(5, 26, 5), cDark, xf(-1, 40, 38, 0, 0, 0.1));
    fp(box(7, 3, 7), cMid, xf(-1.5, 53, 37.5, 0, 0, 0.1));
    // prow wedge pointing back up the rail (dresses the 540-560m approach)
    fp(box(16, 15, 30), cMid, xf(-6, 1, 92, 0, 0.3, 0));
    fp(box(16, 15, 30), cDark, xf(6, 1, 92, 0, -0.3, 0));
    fp(box(8, 8, 18), cDark, xf(0, 2, 108));
    fp(box(6, 5, 10), cMid, xf(-1, 0, 116, 0, 0.12, 0));
    fp(box(10, 3.5, 14), cRust, xf(-6, 8.5, 96, 0, 0.3, 0));
    fp(box(9, 2.5, 10), cCool, xf(-8, -5, 90, 0, 0.3, 0));
    // dorsal fin blade + deck clutter so the bow-on silhouette reads "ship"
    fp(box(2.2, 21, 36), cMid, xf(2, 13, 62));
    fp(box(2.8, 7, 9), cDark, xf(2, 24, 52));
    fp(box(5, 3, 6), cCool, xf(-8, 12, 68));
    fp(box(3.5, 2.5, 4.5), cRust, xf(7, 11.7, 74, 0, 0.4, 0));
    // torn notch at the bow's port corner
    fp(box(5, 6, 8), cDark, xf(-17, 3, 88, 0.3, 0.5, 0.4));
    fp(box(4, 5, 6), cMid, xf(-19, -2, 94, 0.6, 0.2, 0.7));
    // starboard flank pilaster plates the window rows run between
    for (let lz = -76; lz <= 64; lz += 14) {
      fp(box(1.2, 10 + (lz % 3), 3.6), lz % 28 ? cMid : cRust, xf(21.2, 2 + (lz % 5) * 0.6, lz));
    }
    // torn stern rim: jagged shredded plating
    for (let i = 0; i < 16; i++) {
      const r = rimPoint(38, 22, i / 16 + 0.02);
      fp(box(2 + rng() * 3, 3 + rng() * 3.5, 1 + rng() * 1.4), i % 3 ? cDark : cRust,
        xf(r.x + (rng() - 0.5) * 2, r.y + 1 + (rng() - 0.5) * 2, -84 + (rng() - 0.5) * 4,
          rng() * 0.8, rng() * 0.8, r.a + (rng() - 0.5) * 1.1));
    }

    // aft engine section, listing hard
    ap(box(40, 28, 116), cDark, xf(0, 0, 0));
    ap(box(30, 10, 92), cMid, xf(0, 17, -6));
    ap(box(3.5, 24, 56), cCool, xf(2, -22, -12));
    ap(box(34, 22, 20), cMid, xf(0, 0, 50));
    for (const [ex, ey] of [[-11, 4], [11, 4], [0, -6]]) {
      ap(new THREE.TorusGeometry(6.5, 1.9, 6, 18), cDark, xf(ex, ey, 60));
      ap(box(9, 9, 2.4), cMid, xf(ex, ey, 59));
    }
    // port flank plating the exit stretch slides along
    for (let lz = -46; lz <= 32; lz += 13) {
      ap(box(1.1, 7 + (lz % 3), 3.4), lz % 26 ? cMid : cCool, xf(-20.6, 1 + (lz % 4), lz));
    }
    ap(box(1.4, 14, 30), cDark, xf(-20.9, 6, 14));
    // torn bow rim on the lower half (the break faces the oncoming rail)
    for (let i = 0; i < 12; i++) {
      const r = rimPoint(36, 24, 0.5 + i / 24 + 0.02);
      ap(box(2 + rng() * 3, 3 + rng() * 3, 1 + rng() * 1.2), i % 3 ? cDark : cMid,
        xf(r.x + (rng() - 0.5) * 2, r.y + (rng() - 0.5) * 2, 58 + (rng() - 0.5) * 4,
          rng() * 0.8, rng() * 0.8, r.a + (rng() - 0.5) * 1.1));
    }

    // window sockets behind every popup spawn; free-floaters get a wreckage raft
    derelictPopups.forEach((e, i) => {
      const [px, py, pz] = e.pos;
      parts.push([box(3.4, 3.4, 2.8), cDark, xf(px, py, pz - 1.7)]);
      parts.push([box(4.4, 0.9, 2.2), cMid, xf(px, py - 2, pz - 1.9, 0, 0, 0.06)]);
      if (!HULL_POPUPS.has(i)) {
        parts.push([box(7.5, 5.5, 1.2), cDark, xf(px + 0.8, py - 0.6, pz - 3.2, 0.12, 0.14, 0.2)]);
        parts.push([box(4, 3, 0.9), cMid, xf(px - 2.6, py + 1.9, pz - 2.7, -0.2, 0, -0.5)]);
        parts.push([box(1, 1, 2.4), cRust, xf(px + 2.8, py - 2.2, pz - 2.4, 0, 0, 0.6)]);
      }
    });

    // debris: approach trail, break-gap wreckage, exit stragglers
    const cols = [cMid, cCool, cRust, cDark];
    scatterDebris(parts, rng, cols, -614, -544, 11, (z) => -z + 10.5);
    scatterDebris(parts, rng, cols, -808, -746, 10, (z) => -z + 12);
    scatterDebris(parts, rng, cols, -872, -828, 7, (z) => -z + 14);

    return merged(parts);
  }

  function buildWreckRibs() {
    const rng = makeRng(7433);
    const cRib = mixc(PALETTE.space, PALETTE.magenta, 0.14).multiplyScalar(0.55);
    const cRibDark = mixc(PALETTE.space, PALETTE.magenta, 0.1).multiplyScalar(0.35);
    const parts = [];
    const mF = mFwd();
    const mA = mAft();

    // free-floating broken rib rings the rail threads in the gap
    for (const ring of RINGS) {
      const seg = (Math.PI * 2 * ring.R) / RING_N * 1.12;
      for (const s of ringSegs(ring)) {
        if (!s.kept) continue;
        const jag = s.edge ? (rng() - 0.5) * 0.5 : 0;
        parts.push([box(1.5, s.edge ? seg * 0.7 : seg, 1.7), s.i % 2 ? cRib : cRibDark,
          xf(s.x, s.y, s.z + (s.i % 3) * 0.4, 0, 0, s.a + Math.PI / 2 + jag)]);
      }
    }

    // exposed skeleton where the forward hull's stern was shredded
    ribArc(parts, cRib, mF, 0, 2, -78, 14.5, 0.25, Math.PI - 0.25, 7, 1.3);
    ribArc(parts, cRibDark, mF, 0, 2, -68, 16, 0.55, Math.PI - 0.7, 5, 1.2);
    // and around the aft section's torn bow, lower half
    ribArc(parts, cRib, mA, 0, -2, 52, 16, Math.PI + 0.3, Math.PI * 2 - 0.3, 6, 1.3);

    // snapped keel spines jutting into the gap, passing overhead as the rail dives
    parts.push([box(3.2, 2.4, 28), cRib, xf(14, 12.5, -752, 0, 0.24, 0.1)]);
    parts.push([box(2.6, 2.1, 24), cRibDark, xf(24, 9.5, -801, 0.08, -0.3, -0.12)]);
    parts.push([box(1.2, 15, 1.2), cRibDark, xf(20, 4, -778, 0, 0, 0.32)]);
    // torn spar carrying the popup at the aft bow corner + a rib cluster mid-gap
    parts.push([box(19, 1.6, 1.6), cRib, xf(20.9, 0.8, -817.5, 0, 0.63, 0.06)]);
    parts.push([box(7, 1.4, 1.4), cRibDark, xf(21.5, -2.6, -777.5, 0, 0.4, 0.5)]);
    parts.push([box(5, 1.2, 1.2), cRib, xf(22.5, 0.6, -776.8, 0, -0.2, 1.1)]);

    // masts and antennae off the forward superstructure
    parts.push([box(0.7, 24, 0.7), cRibDark, mul(mF, xf(-4, 42, 30, 0, 0, 0.24))]);
    parts.push([box(0.6, 15, 0.6), cRib, mul(mF, xf(-8, 38, -2, 0, 0, -0.38))]);
    parts.push([box(0.5, 11, 0.5), cRibDark, mul(mF, xf(2, 10, 100, 0, 0, 1.2))]);

    return merged(parts);
  }

  function buildWreckGlow() {
    const rng = makeRng(8377);
    const amber = new THREE.Color(PALETTE.amber);
    const amberDim = shade(PALETTE.amber, 0.55);
    const magenta = shade(PALETTE.magenta, 0.95);
    const magentaDim = shade(PALETTE.magenta, 0.5);
    const parts = [];
    const mF = mFwd();
    const mA = mAft();

    // breach lines: jagged glow tracing both torn rims
    for (let i = 0; i < 22; i++) {
      const r = rimPoint(39, 23, i / 22);
      const col = i % 5 === 0 ? magenta : i % 2 ? amber : amberDim;
      parts.push([box(0.55, 2.4 + rng() * 2.4, 0.55), col,
        mul(mF, xf(r.x + (rng() - 0.5) * 1.5, r.y + 1 + (rng() - 0.5) * 1.5,
          -85.5 + (rng() - 0.5) * 3, 0, 0, r.a + (rng() - 0.5) * 0.9))]);
    }
    for (let i = 0; i < 13; i++) {
      const r = rimPoint(37, 25, 0.5 + i / 26);
      const col = i % 4 === 0 ? amber : i % 2 ? magenta : magentaDim;
      parts.push([box(0.5, 2.2 + rng() * 2.2, 0.5), col,
        mul(mA, xf(r.x + (rng() - 0.5) * 1.5, r.y + (rng() - 0.5) * 1.5,
          59.5 + (rng() - 0.5) * 3, 0, 0, r.a + (rng() - 0.5) * 0.9))]);
    }
    // a crack crawling up the flank from the stern tear
    for (let i = 0; i < 6; i++) {
      parts.push([box(0.35, 3.2, 0.35), i % 2 ? magentaDim : magenta,
        mul(mF, xf(21.4, 4 + i * 2.3, -82 + i * 3.1, 0, 0, (i % 2 ? 1 : -1) * 0.55))]);
    }
    // a second breach line across the aft port flank
    for (let i = 0; i < 7; i++) {
      parts.push([box(0.4, 3, 0.4), i % 3 ? magentaDim : magenta,
        mul(mA, xf(-20.7, 9 - i * 2.4, -32 + i * 8.5, 0, 0, (i % 2 ? 1 : -1) * 0.5))]);
    }
    // and one splitting the prow face, seen head-on up the whole approach
    for (let i = 0; i < 5; i++) {
      parts.push([box(0.7, 4.6, 0.7), i % 2 ? magenta : magentaDim,
        mul(mF, xf(-1 - i * 1.53, 6.5 - i * 2.9, 106.5 + i * 0.44, 0, 0.3, (i % 2 ? 1 : -1) * 0.55))]);
    }
    // a surviving porthole row across the upper prow face
    for (let i = 0; i < 5; i++) {
      const u = -5.5 + i * 2.6;
      parts.push([box(1.15, 1.15, 0.45), i % 2 ? shade(PALETTE.amber, 0.3) : amber,
        mul(mF, xf(-1.6 + u * 0.955, 4.6, 106.5 - u * 0.296, 0, 0.3, 0))]);
    }
    // amber jags around the bow's torn port corner + bow running lights
    for (let i = 0; i < 3; i++) {
      parts.push([box(0.45, 2.2, 0.45), i % 2 ? amberDim : amber,
        mul(mF, xf(-16.5 - i * 1.4, 4 - i * 3.2, 90 + i * 2.5, 0.2, 0.4, 0.5 - i * 0.5))]);
    }
    parts.push([box(0.8, 0.8, 0.8), amber, mul(mF, xf(0.5, 6.2, 107.5))]);
    parts.push([box(0.7, 0.7, 0.7), amberDim, mul(mF, xf(-3.5, -4.5, 107))]);
    parts.push([box(0.7, 0.7, 0.7), magenta, mul(mF, xf(-1.5, 54.8, 37.5))]);

    // window rows along the starboard flank: mostly dead, a few still lit
    for (let lz = -80; lz <= 60; lz += 8) {
      for (const [wy, jitter] of [[2.5, 0], [7, 4]]) {
        const roll = rng();
        const col = roll < 0.3 ? amber : roll < 0.38 ? magentaDim : shade(PALETTE.amber, 0.18);
        parts.push([box(0.35, 1, 2.1), col, mul(mF, xf(21.15, wy, lz + jitter))]);
      }
    }
    // a lit row on the superstructure face, seen head-on during the approach
    for (const wx of [-9, -6, -3, 0, 3]) {
      parts.push([box(1, 0.9, 0.4), rng() < 0.55 ? amber : shade(PALETTE.amber, 0.25),
        mul(mF, xf(wx, 25, 40.3))]);
    }

    // glow rim framing every popup window socket
    derelictPopups.forEach((e, i) => {
      const [px, py, pz] = e.pos;
      const col = i % 4 === 3 ? magenta : amber;
      const colDim = i % 4 === 3 ? magentaDim : amberDim;
      parts.push([box(3.9, 0.45, 0.45), col, xf(px, py + 1.85, pz - 0.4)]);
      parts.push([box(3.9, 0.45, 0.45), colDim, xf(px, py - 1.85, pz - 0.4)]);
      parts.push([box(0.45, 3.35, 0.45), colDim, xf(px - 1.85, py, pz - 0.4)]);
      parts.push([box(0.45, 3.35, 0.45), col, xf(px + 1.85, py, pz - 0.4)]);
    });

    // hot tips where the rib rings snapped
    for (const ring of RINGS) {
      const col = ring.tint === 'amber' ? amber : magenta;
      for (const s of ringSegs(ring)) {
        if (s.edge) parts.push([box(0.7, 1.6, 0.7), col, xf(s.x, s.y, s.z, 0, 0, s.a)]);
      }
    }

    // dying engines: dim magenta discs deep in the cones
    for (const [ex, ey] of [[-11, 4], [11, 4], [0, -6]]) {
      parts.push([box(7.6, 7.6, 1), magentaDim, mul(mA, xf(ex, ey, 59.2))]);
      parts.push([new THREE.OctahedronGeometry(1.6, 0), magenta, mul(mA, xf(ex, ey, 60.5, 0, 0, 0, 1, 1, 0.5))]);
    }
    // running lights: keel line still blinking out its pattern, frozen
    for (let lz = -60; lz <= 60; lz += 30) {
      parts.push([box(0.6, 0.6, 0.6), lz % 60 ? amberDim : amber, mul(mF, xf(0, -19, lz))]);
    }
    for (let lz = -40; lz <= 40; lz += 20) {
      parts.push([box(0.55, 0.55, 0.55), lz % 40 ? magentaDim : magenta, mul(mA, xf(-20.8, 3, lz))]);
    }
    // embers adrift in the break
    for (let i = 0; i < 9; i++) {
      const z = -748 - rng() * 58;
      const p = rail.pointAt(-z + 12);
      parts.push([new THREE.OctahedronGeometry(0.28 + rng() * 0.3, 0), i % 3 ? amberDim : magentaDim,
        xf(p.x + (rng() - 0.5) * 16, p.y + (rng() - 0.35) * 10, z, rng(), rng(), rng())]);
    }

    return merged(parts);
  }

  // ---- boss beat (900-1170m): the sentinel approach. Gate monoliths pace the
  // straight run from the derelict exit to the arena, then a ring of boundary
  // markers and outer monoliths give the circled Guardian a place to stand.
  function buildBossApproach() {
    const rng = makeRng(3251);
    const cSlab = mixc(PALETTE.space, PALETTE.violet, 0.28).multiplyScalar(1.35);
    const cSlabDark = mixc(PALETTE.space, PALETTE.violet, 0.18).multiplyScalar(0.8);
    const cyan = new THREE.Color(PALETTE.cyan);
    const cyanDim = shade(PALETTE.cyan, 0.5);
    const magentaDim = shade(PALETTE.magenta, 0.55);
    const parts = [];

    [910, 936, 962, 988, 1014].forEach((d, i) => {
      const p = rail.pointAt(d);
      const h = 8 + i * 1.7;
      for (const s of [-1, 1]) {
        const x = p.x + s * 8.5;
        parts.push([box(2.3, h, 1.5), i % 2 ? cSlab : cSlabDark, xf(x, p.y + h / 2 - 3, p.z)]);
        parts.push([box(1.5, 1.2, 1.1), cSlabDark, xf(x, p.y + h - 2.6, p.z)]);
        parts.push([box(0.5, 0.5, 0.5), i % 2 ? magentaDim : cyan, xf(x, p.y + h - 1.7, p.z)]);
        parts.push([box(0.35, h * 0.55, 0.2), cyanDim, xf(x - s * 1.2, p.y + h * 0.22 - 3, p.z + 0.1)]);
      }
    });

    // arena boundary: a broken ring of floor segments just outside the rail circle
    const CX = 0, CZ = -1050, AR = 27.5;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x = CX + AR * Math.sin(a);
      const z = CZ - AR * Math.cos(a);
      parts.push([box(5.2, 0.55, 1.9), i % 2 ? cSlab : cSlabDark, xf(x, -4.5, z, 0, -a, 0)]);
      if (i % 4 === 0) parts.push([box(0.6, 1.5, 0.6), cyanDim, xf(x, -3.4, z, 0, -a, 0)]);
    }
    // dais below the Guardian
    parts.push([box(14, 1.4, 14), cSlabDark, xf(CX, -7.6, CZ, 0, 0.4, 0)]);
    parts.push([box(10, 1.2, 10), cSlab, xf(CX, -6.4, CZ, 0, 0.15, 0)]);

    // outer monoliths ringing the arena at a distance
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const r = 52 + rng() * 20;
      const h = 16 + rng() * 14;
      const x = CX + r * Math.sin(a);
      const z = CZ - r * Math.cos(a);
      const ry = -a + (rng() - 0.5) * 0.4;
      parts.push([box(5 + rng() * 4, h, 3.5), i % 2 ? cSlabDark : cSlab,
        xf(x, h / 2 - 10, z, 0, ry, 0)]);
      parts.push([box(1.2, 1.2, 1.2), i % 2 ? cyanDim : magentaDim, xf(x, h - 9.2, z)]);
      parts.push([box(0.7, h * 0.55, 0.4), i % 2 ? magentaDim : cyanDim,
        xf(x - 2.0 * Math.sin(a), h * 0.28 - 10, z + 2.0 * Math.cos(a), 0, ry, 0)]);
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
        derelict: group(buildWreckPlates(), buildWreckRibs(), buildWreckGlow()),
        boss: group(buildBossApproach()),
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
