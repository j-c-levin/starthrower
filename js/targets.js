import { PALETTE } from './palette.js';

const POOL_SIZES = { crate: 8, asteroid: 12, drone: 8, popup: 8, weakpoint: 9 };
const RADII = { crate: 1.1, asteroid: 1.4, drone: 0.9, popup: 0.95, weakpoint: 0.9 };
const BURSTS = 3;
const SHARDS = 12;
const SHATTER_MS = 620;
const FIZZLE_MS = 680;
const POPUP_EASE_MS = 70;
const POPUP_LIVE_SCALE = 0.6;
const RETIRE_BEHIND_M = 30;
const POKE_COOLDOWN_MS = 1200;
const WEAKPOINT_PULSE_W = 0.005; // rad/ms -> ~0.8Hz, under the 1Hz cap
const GOLDEN = 2.399963229728653;
const TAU = Math.PI * 2;

function isAncestorVisible(object3D) {
  let node = object3D;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

let autoId = 0;

function register() {
  const hslTmp = { h: 0, s: 0, l: 0 };
  function shade(hex, mult, satMult = 1) {
    const c = new THREE.Color(hex);
    c.getHSL(hslTmp);
    c.setHSL(hslTmp.h, Math.min(1, hslTmp.s * satMult), Math.min(1, hslTmp.l * mult));
    return c;
  }

  function xf(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz)
    );
  }

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

  function buildGeometries() {
    const frame = shade(PALETTE.violet, 0.32);
    const amber = new THREE.Color(PALETTE.amber);
    const amberHi = shade(PALETTE.amber, 1.2);
    const crateParts = [[new THREE.BoxGeometry(1.6, 1.6, 1.6), frame]];
    const panelOffsets = [
      [0, 0, 0.79, 0, 0, 0], [0, 0, -0.79, 0, 0, 0],
      [0.79, 0, 0, 0, Math.PI / 2, 0], [-0.79, 0, 0, 0, Math.PI / 2, 0],
      [0, 0.79, 0, Math.PI / 2, 0, 0], [0, -0.79, 0, Math.PI / 2, 0, 0],
    ];
    panelOffsets.forEach(([px, py, pz, rx, ry, rz], i) => {
      crateParts.push([
        new THREE.BoxGeometry(1.06, 1.06, 0.16),
        i % 2 ? amberHi : amber,
        xf(px, py, pz, rx, ry, rz),
      ]);
    });
    const crate = merged(crateParts);

    const rockBody = shade(PALETTE.violet, 0.45);
    const rockHi = shade(PALETTE.violet, 1.2);
    const lavender = shade(PALETTE.violet, 2.0);
    const asteroid = merged([
      [new THREE.IcosahedronGeometry(1.05, 0), rockBody, xf(0, 0, 0, 0.4, 0.2, 0.1, 1, 0.85, 1)],
      [new THREE.IcosahedronGeometry(0.5, 0), rockHi, xf(0.55, 0.6, 0.25, 0.3, 0.8, 0.2, 0.6, 1.55, 0.6)],
      [new THREE.IcosahedronGeometry(0.42, 0), lavender, xf(-0.62, 0.4, -0.2, -0.5, 0.3, 0.6, 0.55, 1.35, 0.55)],
      [new THREE.IcosahedronGeometry(0.45, 0), rockHi, xf(0.12, -0.68, 0.3, 0.9, -0.4, 0.3, 0.6, 1.25, 0.6)],
      [new THREE.IcosahedronGeometry(0.34, 0), lavender, xf(-0.45, -0.35, 0.5, 0.5, 1.1, -0.4, 0.55, 1.2, 0.55)],
    ]);

    const cyan = new THREE.Color(PALETTE.cyan);
    const teal = shade(PALETTE.cyan, 0.45);
    const ink = new THREE.Color(PALETTE.ink);
    const drone = merged([
      [new THREE.OctahedronGeometry(0.45, 0), cyan, xf(0, 0, 0, 0, 0, 0, 1, 1, 1.25)],
      [new THREE.BoxGeometry(0.9, 0.06, 0.32), teal, xf(0.66, 0.06, 0, 0, -0.4, 0.3)],
      [new THREE.BoxGeometry(0.9, 0.06, 0.32), teal, xf(-0.66, 0.06, 0, 0, 0.4, -0.3)],
      [new THREE.OctahedronGeometry(0.14, 0), ink, xf(0, 0, 0.5)],
    ]);

    const panelBack = shade(PALETTE.violet, 0.3);
    const magenta = new THREE.Color(PALETTE.magenta);
    const magentaHi = shade(PALETTE.magenta, 1.25);
    const popup = merged([
      [new THREE.BoxGeometry(1.2, 1.2, 0.1), panelBack],
      [new THREE.TorusGeometry(0.5, 0.1, 8, 20), magenta, xf(0, 0, 0.1)],
      [new THREE.OctahedronGeometry(0.24, 0), magentaHi, xf(0, 0, 0.12, 0, 0, 0, 1, 1, 0.5)],
    ]);

    const amberDim = shade(PALETTE.amber, 0.5);
    const weakpoint = merged([
      [new THREE.IcosahedronGeometry(0.48, 1), amber],
      [new THREE.TorusGeometry(0.66, 0.05, 6, 24), amberDim, xf(0, 0, 0, 0.35, 0, 0)],
      [new THREE.TorusGeometry(0.66, 0.05, 6, 24), amberDim, xf(0, 0, 0, Math.PI / 2, 0, 0.35)],
    ]);

    return { crate, asteroid, drone, popup, weakpoint };
  }

  AFRAME.registerComponent('target-manager', {
    init() {
      this.targets = new Map();
      this.worldPos = new THREE.Vector3();
      this.now = 0;
      this.seq = 0;
      this.lastHitType = null;

      this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
      this.root = new THREE.Group();
      this.el.setObject3D('targetPools', this.root);

      const geos = buildGeometries();
      this.pools = {};
      this.allSlots = [];
      this.slotsById = new Map();
      for (const [type, size] of Object.entries(POOL_SIZES)) {
        const pool = [];
        for (let i = 0; i < size; i++) {
          const holder = new THREE.Group();
          holder.visible = false;
          holder.add(new THREE.Mesh(geos[type], this.material));
          this.root.add(holder);
          const k = (this.allSlots.length + 1) * GOLDEN;
          const slot = {
            type,
            holder,
            elLike: { object3D: holder },
            deployed: false,
            seq: 0,
            id: null,
            record: null,
            spawn: new THREE.Vector3(),
            pA: k % TAU,
            pB: (k * 1.7) % TAU,
            pC: (k * 2.3) % TAU,
            wA: 0.0002 + 0.0003 * ((i * 13) % 7) / 7,
            wB: 0.00015 + 0.00025 * ((i * 5) % 7) / 7,
            periodMs: 4000,
            duty: 0.5,
            bornAt: 0,
            scaleCur: 1,
          };
          pool.push(slot);
          this.allSlots.push(slot);
        }
        this.pools[type] = pool;
      }

      this.initParticles();

      const ink = new THREE.Color(PALETTE.ink);
      this.burstColors = {
        crate: [new THREE.Color(PALETTE.amber), ink],
        asteroid: [shade(PALETTE.violet, 1.45), ink],
        drone: [new THREE.Color(PALETTE.cyan), ink],
        popup: [new THREE.Color(PALETTE.magenta), ink],
        weakpoint: [new THREE.Color(PALETTE.amber), ink],
      };
      this.defaultBurst = [new THREE.Color(PALETTE.ink), new THREE.Color(PALETTE.amber)];
      this.fizzleColors = [shade(PALETTE.space, 4.0, 0.35), shade(PALETTE.space, 2.6, 0.3)];

      this.rigEl = document.querySelector('#rig');
      this.rigPos = new THREE.Vector3();
      this.rigFwd = new THREE.Vector3();
      this.tmp = new THREE.Vector3();

      this.onSpawnTarget = (evt) => this.spawn(evt);
      this.onTargetHit = this.onTargetHit.bind(this);
      this.onScored = this.onScored.bind(this);
      this.onComboBroken = this.onComboBroken.bind(this);
      this.onRideDone = this.onRideDone.bind(this);
      this.el.addEventListener('spawntarget', this.onSpawnTarget);
      this.el.addEventListener('targethit', this.onTargetHit);
      this.el.addEventListener('scored', this.onScored);
      this.el.addEventListener('combobroken', this.onComboBroken);
      this.el.addEventListener('ridedone', this.onRideDone);
    },

    remove() {
      this.el.removeEventListener('spawntarget', this.onSpawnTarget);
      this.el.removeEventListener('targethit', this.onTargetHit);
      this.el.removeEventListener('scored', this.onScored);
      this.el.removeEventListener('combobroken', this.onComboBroken);
      this.el.removeEventListener('ridedone', this.onRideDone);
      this.el.removeObject3D('targetPools');
    },

    add({ id, el, type, radius, pokeable }) {
      this.targets.set(id, { id, el, type, radius, pokeable: !!pokeable, lastPokeAt: -Infinity, live: true });
    },

    removeTarget(id) {
      this.targets.delete(id);
    },

    active() {
      const out = [];
      for (const t of this.targets.values()) {
        if (t.live === false) continue;
        if (!t.el.object3D || !isAncestorVisible(t.el.object3D)) continue;
        t.el.object3D.getWorldPosition(this.worldPos);
        out.push({
          id: t.id,
          pos: { x: this.worldPos.x, y: this.worldPos.y, z: this.worldPos.z },
          radius: t.radius,
          type: t.type,
          el: t.el,
        });
      }
      return out;
    },

    spawn(evt) {
      const { target, pos, period, duty } = evt.detail;
      return this.deploy(target, pos, { period, duty });
    },

    pokeCheck(handPos, t) {
      for (const rec of this.targets.values()) {
        if (!rec.pokeable || rec.live === false) continue;
        if (t - rec.lastPokeAt < POKE_COOLDOWN_MS) continue;
        if (!rec.el.object3D || !isAncestorVisible(rec.el.object3D)) continue;
        rec.el.object3D.getWorldPosition(this.worldPos);
        if (this.worldPos.distanceTo(handPos) > rec.radius) continue;
        rec.lastPokeAt = t;
        this.el.emit('targethit', {
          id: rec.id,
          type: rec.type,
          point: { x: this.worldPos.x, y: this.worldPos.y, z: this.worldPos.z },
        });
      }
    },

    spawnWeakpoint({ id, pos }) {
      return this.deploy('weakpoint', pos, { id });
    },

    retireAll(type) {
      for (const slot of this.pools[type] || []) this.releaseSlot(slot);
    },

    deploy(type, pos, opts = {}) {
      const pool = this.pools[type];
      if (!pool || !pos) return null;
      let slot = null;
      let oldest = null;
      for (const s of pool) {
        if (!s.deployed) { slot = s; break; }
        if (!oldest || s.seq < oldest.seq) oldest = s;
      }
      if (!slot) {
        slot = oldest;
        this.releaseSlot(slot);
      }
      const px = pos.x !== undefined ? pos.x : pos[0];
      const py = pos.y !== undefined ? pos.y : pos[1];
      const pz = pos.z !== undefined ? pos.z : pos[2];
      slot.spawn.set(px || 0, py || 0, pz || 0);
      slot.holder.position.copy(slot.spawn);
      slot.holder.rotation.set(0, 0, 0);
      slot.deployed = true;
      slot.seq = ++this.seq;
      slot.bornAt = this.now;
      if (type === 'popup') {
        slot.periodMs = (opts.period || 4) * 1000;
        slot.duty = opts.duty || 0.5;
        slot.scaleCur = 0.05;
        slot.holder.scale.setScalar(0.05);
      } else {
        slot.holder.scale.setScalar(1);
      }
      slot.holder.visible = true;
      const id = opts.id || `${type}-p${slot.seq}`;
      slot.id = id;
      this.slotsById.set(id, slot);
      this.add({ id, el: slot.elLike, type, radius: RADII[type] });
      slot.record = this.targets.get(id);
      if (type === 'popup') slot.record.live = false;
      return id;
    },

    releaseSlot(slot) {
      if (!slot.deployed) return;
      slot.deployed = false;
      slot.holder.visible = false;
      if (slot.id) {
        this.removeTarget(slot.id);
        this.slotsById.delete(slot.id);
      }
      slot.id = null;
      slot.record = null;
    },

    onTargetHit(evt) {
      this.lastHitType = evt.detail.type;
      const slot = this.slotsById.get(evt.detail.id);
      if (slot) this.releaseSlot(slot);
    },

    onScored(evt) {
      const pair = this.burstColors[this.lastHitType] || this.defaultBurst;
      this.lastHitType = null;
      this.triggerBurst('shatter', evt.detail.point, 1, pair[0], pair[1]);
    },

    onComboBroken(evt) {
      this.triggerBurst('fizzle', evt.detail.point, 1, this.fizzleColors[0], this.fizzleColors[1]);
    },

    burst(point, scale) {
      this.triggerBurst('shatter', point, scale || 1, this.defaultBurst[0], this.defaultBurst[1]);
    },

    onRideDone() {
      for (const slot of this.allSlots) this.releaseSlot(slot);
    },

    initParticles() {
      const tet = new THREE.TetrahedronGeometry(1);
      this.shardBase = new Float32Array(tet.getAttribute('position').array);
      tet.dispose();
      const totalVerts = BURSTS * SHARDS * 12;
      this.pPos = new Float32Array(totalVerts * 3);
      this.pCol = new Float32Array(totalVerts * 3);
      const geo = new THREE.BufferGeometry();
      this.pPosAttr = new THREE.BufferAttribute(this.pPos, 3);
      this.pPosAttr.setUsage(THREE.DynamicDrawUsage);
      this.pColAttr = new THREE.BufferAttribute(this.pCol, 3);
      this.pColAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', this.pPosAttr);
      geo.setAttribute('color', this.pColAttr);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      this.pMesh = new THREE.Mesh(geo, this.material);
      this.pMesh.frustumCulled = false;
      this.pMesh.visible = false;
      this.root.add(this.pMesh);

      this.spiral = new Float32Array(SHARDS * 3);
      for (let i = 0; i < SHARDS; i++) {
        const y = 1 - (2 * (i + 0.5)) / SHARDS;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * GOLDEN;
        this.spiral[i * 3] = r * Math.cos(a);
        this.spiral[i * 3 + 1] = y;
        this.spiral[i * 3 + 2] = r * Math.sin(a);
      }

      this.burstSlots = [];
      for (let b = 0; b < BURSTS; b++) {
        this.burstSlots.push({
          active: false,
          mode: 'shatter',
          elapsed: 0,
          seq: 0,
          scale: 1,
          ox: 0, oy: 0, oz: 0,
          base: b * SHARDS * 12 * 3,
          dirs: new Float32Array(SHARDS * 3),
          spd: new Float32Array(SHARDS),
          size: new Float32Array(SHARDS),
        });
      }
    },

    triggerBurst(mode, point, scale, colA, colB) {
      if (!point) return;
      let slot = null;
      let oldest = null;
      for (const b of this.burstSlots) {
        if (!b.active) { slot = b; break; }
        if (!oldest || b.seq < oldest.seq) oldest = b;
      }
      if (!slot) slot = oldest;
      slot.active = true;
      slot.seq = ++this.seq;
      slot.mode = mode;
      slot.elapsed = 0;
      slot.scale = scale;
      slot.ox = point.x;
      slot.oy = point.y;
      slot.oz = point.z;
      const fizzle = mode === 'fizzle';
      const yaw = Math.random() * TAU;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      for (let i = 0; i < SHARDS; i++) {
        const bx = this.spiral[i * 3];
        const by = this.spiral[i * 3 + 1];
        const bz = this.spiral[i * 3 + 2];
        let dx = bx * cy + bz * sy;
        let dz = -bx * sy + bz * cy;
        let dy = by;
        if (fizzle) {
          dx *= 0.4;
          dz *= 0.4;
          dy = -0.4 - Math.abs(by) * 0.5;
        } else {
          dy = by * 0.85 + 0.2;
        }
        if (dz > 0) dz *= 0.3; // comfort: never burst toward the player
        slot.dirs[i * 3] = dx;
        slot.dirs[i * 3 + 1] = dy;
        slot.dirs[i * 3 + 2] = dz;
        slot.spd[i] = fizzle
          ? 0.55 + 0.35 * ((i * 3) % 5) / 5
          : 2.3 + 1.4 * ((i * 5) % 7) / 7 + Math.random() * 0.5;
        slot.size[i] = fizzle
          ? 0.09 + 0.04 * ((i * 3) % 4) / 4
          : 0.16 + 0.1 * ((i * 7) % 5) / 5;
        const c = i % 3 === 0 ? colB : colA;
        let o = slot.base + i * 36;
        for (let v = 0; v < 12; v++) {
          this.pCol[o++] = c.r;
          this.pCol[o++] = c.g;
          this.pCol[o++] = c.b;
        }
      }
      this.pColAttr.needsUpdate = true;
      this.pMesh.visible = true;
    },

    tickParticles(dt) {
      let any = false;
      for (const b of this.burstSlots) {
        if (!b.active) continue;
        b.elapsed += dt;
        const dur = b.mode === 'fizzle' ? FIZZLE_MS : SHATTER_MS;
        const life = b.elapsed / dur;
        if (life >= 1) {
          b.active = false;
          this.pPos.fill(0, b.base, b.base + SHARDS * 12 * 3);
          this.pPosAttr.needsUpdate = true;
          continue;
        }
        any = true;
        const fizzle = b.mode === 'fizzle';
        const ease = fizzle ? life : 1 - (1 - life) * (1 - life);
        const drop = (fizzle ? 2.2 : 0.6) * life * life * b.scale;
        const shrink = fizzle ? 1 - life * life : 1 - life;
        for (let i = 0; i < SHARDS; i++) {
          const travel = b.spd[i] * ease * b.scale;
          const cx = b.ox + b.dirs[i * 3] * travel;
          const cyy = b.oy + b.dirs[i * 3 + 1] * travel - drop;
          const cz = b.oz + b.dirs[i * 3 + 2] * travel;
          const s = b.size[i] * b.scale * shrink;
          let o = b.base + i * 36;
          for (let v = 0; v < 12; v++) {
            this.pPos[o++] = cx + this.shardBase[v * 3] * s;
            this.pPos[o++] = cyy + this.shardBase[v * 3 + 1] * s;
            this.pPos[o++] = cz + this.shardBase[v * 3 + 2] * s;
          }
        }
        this.pPosAttr.needsUpdate = true;
      }
      this.pMesh.visible = any;
    },

    tick(t, dt) {
      this.now = t;
      if (!dt) return;
      const rig = this.rigEl && this.rigEl.object3D;
      let haveRig = false;
      if (rig) {
        rig.getWorldPosition(this.rigPos);
        this.rigFwd.set(0, 0, -1).applyQuaternion(rig.quaternion);
        haveRig = true;
      }
      for (const s of this.allSlots) {
        if (!s.deployed) continue;
        const h = s.holder;
        if (s.type === 'crate') {
          h.rotation.y = s.pA + t * 0.00025;
          h.rotation.x = 0.18 * Math.sin(s.pB);
        } else if (s.type === 'asteroid') {
          h.rotation.x = s.pA + t * s.wA;
          h.rotation.y = s.pB + t * s.wB;
        } else if (s.type === 'drone') {
          h.position.x = s.spawn.x + 1.05 * Math.sin(t * 0.0011 + s.pA) + 0.45 * Math.sin(t * 0.0029 + s.pB);
          h.position.y = s.spawn.y + 0.5 * Math.sin(t * 0.0017 + s.pC);
          h.rotation.z = -0.45 * Math.cos(t * 0.0011 + s.pA);
          h.rotation.y = 0.25 * Math.sin(t * 0.0013 + s.pB);
        } else if (s.type === 'popup') {
          const phase = ((t - s.bornAt) / s.periodMs) % 1;
          const up = phase < s.duty;
          const target = up ? 1 : 0.05;
          s.scaleCur += (target - s.scaleCur) * (1 - Math.exp(-dt / POPUP_EASE_MS));
          h.scale.setScalar(s.scaleCur);
          h.rotation.z = 0.1 * Math.sin(t * 0.0008 + s.pA);
          if (s.record) s.record.live = up && s.scaleCur > POPUP_LIVE_SCALE;
        } else if (s.type === 'weakpoint') {
          h.scale.setScalar(1 + 0.13 * Math.sin(t * WEAKPOINT_PULSE_W + s.pA));
          h.rotation.y = t * 0.0006 + s.pB;
        }
        if (haveRig && s.type !== 'weakpoint') {
          this.tmp.copy(h.position).sub(this.rigPos);
          if (this.tmp.dot(this.rigFwd) < -RETIRE_BEHIND_M) this.releaseSlot(s);
        }
      }
      this.tickParticles(dt);
    },
  });

  AFRAME.registerComponent('hit-target', {
    schema: {
      type: { type: 'string', default: '' },
      radius: { type: 'number', default: 0.5 },
      pokeable: { type: 'boolean', default: false },
    },
    play() {
      this.targetId = this.el.id || `target-${++autoId}`;
      const manager = this.el.sceneEl.components['target-manager'];
      if (manager) {
        manager.add({
          id: this.targetId,
          el: this.el,
          type: this.data.type,
          radius: this.data.radius,
          pokeable: this.data.pokeable,
        });
      }
    },
    remove() {
      const manager = this.el.sceneEl && this.el.sceneEl.components['target-manager'];
      if (manager && this.targetId) manager.removeTarget(this.targetId);
    },
  });

  AFRAME.registerComponent('hangar-only', {
    init() {
      this.onRideStarted = () => { this.el.object3D.visible = false; };
      this.onTallyDone = () => { this.el.object3D.visible = true; };
      this.el.sceneEl.addEventListener('ridestarted', this.onRideStarted);
      this.el.sceneEl.addEventListener('tallydone', this.onTallyDone);
    },
    remove() {
      this.el.sceneEl.removeEventListener('ridestarted', this.onRideStarted);
      this.el.sceneEl.removeEventListener('tallydone', this.onTallyDone);
    },
  });

  const FLASH_THROTTLE_MS = 1000;

  AFRAME.registerComponent('core-flash', {
    init() {
      this.lastFlashAt = -Infinity;
      this.onHit = this.onHit.bind(this);
      this.el.sceneEl.addEventListener('targethit', this.onHit);
    },
    remove() {
      this.el.sceneEl.removeEventListener('targethit', this.onHit);
    },
    onHit(evt) {
      if (evt.detail.type !== 'core') return;
      const now = performance.now();
      if (now - this.lastFlashAt < FLASH_THROTTLE_MS) return;
      this.lastFlashAt = now;
      this.el.removeAttribute('animation__flash');
      this.el.setAttribute('animation__flash', {
        property: 'scale',
        from: '1 1 1',
        to: '1.3 1.3 1.3',
        dur: 150,
        dir: 'alternate',
        loop: 2,
        easing: 'easeOutQuad',
      });
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
