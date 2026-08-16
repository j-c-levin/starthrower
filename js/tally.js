import { PALETTE } from './palette.js';

const FONT = 'lib/fonts/Roboto-msdf.json';
const FONT_IMAGE = 'lib/fonts/Roboto-msdf.png';
const COUNT_MS = 3000;
const UPDATE_INTERVAL_MS = 100; // ~10Hz, per the brief's count-up granularity allowance
const AUTO_MS = 10000; // sole owner of the tally timeout (game.js only consumes tallydone)
const ORB_RADIUS = 0.7;
const FLOURISH_SCALE = 2.75;

function textEntity({ width, color, position, value = '' }) {
  const el = document.createElement('a-entity');
  if (position) el.setAttribute('position', position);
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

const easeOutQuad = (f) => 1 - (1 - f) * (1 - f);

function register() {
  AFRAME.registerComponent('tally', {
    init() {
      this.sceneEl = this.el.sceneEl;
      this.el.setAttribute('visible', false);

      this.scoreEl = textEntity({ width: 5, color: PALETTE.ink, position: '0 0.6 0', value: '0' });
      this.el.appendChild(this.scoreEl);

      this.bestEl = textEntity({ width: 2, color: PALETTE.amber, position: '0 -0.35 0' });
      this.bestEl.setAttribute('visible', false);
      this.el.appendChild(this.bestEl);

      this.orbEl = document.createElement('a-entity');
      this.orbEl.setAttribute('position', '0 -1.4 0');
      this.orbEl.setAttribute('geometry', `primitive: sphere; radius: ${ORB_RADIUS}; segmentsWidth: 16; segmentsHeight: 12`);
      this.orbEl.setAttribute('material', `shader: flat; color: ${PALETTE.cyan}`);
      this.orbEl.setAttribute('hit-target', `type: again; radius: ${ORB_RADIUS}; pokeable: true`);
      this.el.appendChild(this.orbEl);

      this.orbLabelEl = textEntity({
        width: 1.6, color: PALETTE.ink, position: `0 -1.4 ${ORB_RADIUS + 0.05}`, value: 'AGAIN',
      });
      this.el.appendChild(this.orbLabelEl);

      this.score = 0;
      this.best = 0;
      this.newBest = false;
      this.counting = false;
      this.displayed = -1;
      this.countMs = 0;
      this.autoMs = 0;
      this.lastUpdateAt = -Infinity;
      this.worldPos = new THREE.Vector3();

      this.onRideDone = this.onRideDone.bind(this);
      this.onTargetHit = this.onTargetHit.bind(this);
      this.sceneEl.addEventListener('ridedone', this.onRideDone);
      this.sceneEl.addEventListener('targethit', this.onTargetHit);
    },

    remove() {
      this.sceneEl.removeEventListener('ridedone', this.onRideDone);
      this.sceneEl.removeEventListener('targethit', this.onTargetHit);
    },

    onRideDone(evt) {
      const { score, best, newBest } = evt.detail;
      this.score = score;
      this.best = best;
      this.newBest = newBest;
      this.countMs = 0;
      this.autoMs = 0;
      this.lastUpdateAt = -Infinity;
      this.displayed = -1;

      this.el.setAttribute('visible', true);
      this.bestEl.setAttribute('visible', false);
      this.bestEl.removeAttribute('animation__pulse');
      this.bestEl.object3D.scale.set(1, 1, 1);

      this.setScore(0);
      if (score > 0) {
        this.counting = true;
      } else {
        this.counting = false;
        this.revealBest();
      }
    },

    setScore(v) {
      if (v === this.displayed) return;
      this.displayed = v;
      this.scoreEl.setAttribute('text', 'value', String(v));
    },

    revealBest() {
      this.bestEl.setAttribute('text', 'value', `BEST: ${this.best}`);
      this.bestEl.setAttribute('visible', true);
      if (this.newBest) this.flourish();
    },

    flourish() {
      const manager = this.sceneEl.components['target-manager'];
      if (manager) {
        this.bestEl.object3D.getWorldPosition(this.worldPos);
        manager.burst({ x: this.worldPos.x, y: this.worldPos.y, z: this.worldPos.z }, FLOURISH_SCALE);
      }
      this.bestEl.removeAttribute('animation__pulse');
      this.bestEl.setAttribute('animation__pulse', {
        property: 'scale',
        from: '1 1 1',
        to: '1.3 1.3 1.3',
        dur: 550,
        dir: 'alternate',
        loop: 2,
        easing: 'easeInOutQuad',
      });
    },

    finish() {
      this.el.setAttribute('visible', false);
      this.sceneEl.emit('tallydone');
    },

    onTargetHit(evt) {
      if (evt.detail.type !== 'again') return;
      const gm = this.sceneEl.components['game-manager'];
      if (!gm || gm.state !== 'tally') return;
      this.finish();
    },

    tick(t, dt) {
      const gm = this.sceneEl.components['game-manager'];
      if (!gm || gm.state !== 'tally') return;
      if (!dt) return;

      this.autoMs += dt;
      if (this.autoMs >= AUTO_MS) {
        this.finish();
        return;
      }

      if (!this.counting) return;
      this.countMs += dt;
      const frac = Math.min(1, this.countMs / COUNT_MS);
      const finished = frac >= 1;
      if (!finished && t - this.lastUpdateAt < UPDATE_INTERVAL_MS) return;
      this.lastUpdateAt = t;

      this.setScore(Math.round(easeOutQuad(frac) * this.score));
      if (finished) {
        this.counting = false;
        this.setScore(this.score);
        this.revealBest();
      }
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
