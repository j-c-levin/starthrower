import { PALETTE } from './palette.js';

const POP_POOL_SIZE = 6;
const POP_RISE_M = 0.5;
const POP_DUR_MS = 600;
const CHIP_COLORS = { 2: PALETTE.cyan, 3: PALETTE.magenta, 4: PALETTE.amber };
const FONT = 'lib/fonts/Roboto-msdf.json';
const FONT_IMAGE = 'lib/fonts/Roboto-msdf.png';

function textEntity({ width, color, position }) {
  const el = document.createElement('a-entity');
  if (position) el.setAttribute('position', position);
  el.setAttribute('text', {
    value: '',
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

function register() {
  AFRAME.registerComponent('hud', {
    init() {
      this.sceneEl = this.el.sceneEl;
      this.seq = 0;
      this.el.setAttribute('visible', false);

      this.scoreEl = textEntity({ width: 1, color: PALETTE.ink, position: '0 0 0' });
      this.el.appendChild(this.scoreEl);

      this.chipEl = textEntity({ width: 0.6, color: PALETTE.cyan, position: '0.55 0 0' });
      this.chipEl.setAttribute('visible', false);
      this.el.appendChild(this.chipEl);

      // Point pops report world hit positions, so the pool lives directly on
      // the scene (identity transform) rather than under the moving rig.
      this.pool = [];
      for (let i = 0; i < POP_POOL_SIZE; i++) {
        const el = textEntity({ width: 0.6, color: PALETTE.ink });
        el.setAttribute('visible', false);
        const slot = { el, active: false, seq: 0 };
        el.addEventListener('animationcomplete__fade', () => this.releaseSlot(slot));
        this.sceneEl.appendChild(el);
        this.pool.push(slot);
      }

      this.onScored = this.onScored.bind(this);
      this.onComboBroken = this.onComboBroken.bind(this);
      this.onRideStarted = this.onRideStarted.bind(this);
      this.onRideDone = this.onRideDone.bind(this);
      this.sceneEl.addEventListener('scored', this.onScored);
      this.sceneEl.addEventListener('combobroken', this.onComboBroken);
      this.sceneEl.addEventListener('ridestarted', this.onRideStarted);
      this.sceneEl.addEventListener('ridedone', this.onRideDone);
    },

    remove() {
      this.sceneEl.removeEventListener('scored', this.onScored);
      this.sceneEl.removeEventListener('combobroken', this.onComboBroken);
      this.sceneEl.removeEventListener('ridestarted', this.onRideStarted);
      this.sceneEl.removeEventListener('ridedone', this.onRideDone);
      for (const slot of this.pool) slot.el.remove();
      this.scoreEl.remove();
      this.chipEl.remove();
    },

    onRideStarted() {
      this.el.setAttribute('visible', true);
      this.scoreEl.setAttribute('text', 'value', '0');
      this.setChip(1);
      for (const slot of this.pool) this.releaseSlot(slot);
    },

    onRideDone() {
      this.el.setAttribute('visible', false);
      this.setChip(1);
      for (const slot of this.pool) this.releaseSlot(slot);
    },

    onComboBroken() {
      this.setChip(1);
    },

    setChip(multiplier) {
      const color = CHIP_COLORS[multiplier];
      if (!color) {
        this.chipEl.setAttribute('visible', false);
        return;
      }
      this.chipEl.setAttribute('text', { value: `×${multiplier}`, color });
      this.chipEl.setAttribute('visible', true);
    },

    onScored(evt) {
      const { score, multiplier, points, point } = evt.detail;
      this.scoreEl.setAttribute('text', 'value', String(score));
      this.setChip(multiplier);
      if (point) this.popAt(point, points);
    },

    acquireSlot() {
      let slot = null;
      let oldest = null;
      for (const s of this.pool) {
        if (!s.active) { slot = s; break; }
        if (!oldest || s.seq < oldest.seq) oldest = s;
      }
      return slot || oldest;
    },

    releaseSlot(slot) {
      slot.active = false;
      slot.el.setAttribute('visible', false);
      slot.el.removeAttribute('animation__rise');
      slot.el.removeAttribute('animation__fade');
    },

    popAt(point, points) {
      const slot = this.acquireSlot();
      if (!slot) return;
      slot.active = true;
      slot.seq = ++this.seq;

      slot.el.setAttribute('position', `${point.x} ${point.y} ${point.z}`);
      slot.el.setAttribute('text', { value: `+${points}`, opacity: 1 });
      slot.el.setAttribute('visible', true);

      // Remove-then-set: restarts the animation cleanly on a recycled slot
      // that was mid-flight (rapid re-hits reuse pooled entities).
      slot.el.removeAttribute('animation__rise');
      slot.el.setAttribute('animation__rise', {
        property: 'position',
        from: `${point.x} ${point.y} ${point.z}`,
        to: `${point.x} ${point.y + POP_RISE_M} ${point.z}`,
        dur: POP_DUR_MS,
        easing: 'easeOutQuad',
      });

      slot.el.removeAttribute('animation__fade');
      slot.el.setAttribute('animation__fade', {
        property: 'text.opacity',
        from: 1,
        to: 0,
        dur: POP_DUR_MS,
        easing: 'linear',
      });
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
