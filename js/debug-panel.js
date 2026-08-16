import { VERSION } from './version.js';
import { createTuning } from './logic/tuning.js';
import { parseParams } from './logic/params.js';

const UPDATE_INTERVAL_MS = 250;

function formatTunedLine(overrides) {
  if (!overrides.length) return null;
  return `TUNED: ${overrides.map(({ key, value }) => `${key}=${value}`).join(' ')}`;
}

function formatHandLine(info) {
  if (!info) return '(hand-thrower missing)';
  const wrist = info.hasWrist
    ? `${Math.round(info.handPos.x * 100)},${Math.round(info.handPos.y * 100)},${Math.round(info.handPos.z * 100)}cm vis:${info.wristVisible ? 'y' : 'n'}`
    : 'none';
  const baseline = Number.isFinite(info.baseline) ? info.baseline.toFixed(2) : '-';
  const threshold = Number.isFinite(info.threshold) ? info.threshold.toFixed(2) : '-';
  const dir = info.lastDir
    ? `${info.lastDir.x.toFixed(2)},${info.lastDir.y.toFixed(2)},${info.lastDir.z.toFixed(2)}`
    : '-';
  const offsets = info.lastOffsets
    ? `down:${info.lastOffsets.down.toFixed(2)} lat:${info.lastOffsets.lateral.toFixed(2)}`
    : '-';
  return (
    `${info.hand.toUpperCase()}  htc:${info.hasTrackingControls ? 'y' : 'n'}` +
    `  poses:${info.hasPoses ? 'y' : 'n'}  wrist:${wrist}  dist:${info.dist.toFixed(2)}m` +
    `  base:${baseline}  thr:${threshold}  state:${info.state}  fired:${info.firedCount}` +
    `  dir:${dir}  shoulder:${offsets}`
  );
}

function formatGameLine(gm) {
  if (!gm) return '(game-manager missing)';
  return `STATE:${gm.state}  dist:${gm.ride.distance().toFixed(1)}m  score:${gm.score.score()}`;
}

function register() {
  AFRAME.registerComponent('debug-panel', {
    init() {
      // Off by default (pre-release requirement): no entities, no per-tick work.
      this.enabled = parseParams(window.location.search).debug;
      if (!this.enabled) return;

      this.lastUpdate = -Infinity;
      this.handL = this.el.querySelector('#handL');
      this.handR = this.el.querySelector('#handR');
      // Reads location.search once — URL params don't change mid-session.
      this.tunedLine = formatTunedLine(createTuning(window.location.search).overrides());

      this.panelEl = document.createElement('a-entity');
      this.panelEl.setAttribute('position', '0 2.4 -5.9');
      this.panelEl.setAttribute('text', {
        value: `STARTHROWER ${VERSION}`,
        font: 'lib/fonts/Roboto-msdf.json',
        fontImage: 'lib/fonts/Roboto-msdf.png',
        negate: true,
        color: '#f4f1ff',
        width: 4,
        wrapCount: 64,
        align: 'left',
        anchor: 'center',
      });
      this.el.appendChild(this.panelEl);
    },

    getInfo(handEl) {
      const thrower = handEl && handEl.components['hand-thrower'];
      return thrower ? thrower.debugInfo() : null;
    },

    tick(t) {
      if (!this.enabled) return;
      if (t - this.lastUpdate < UPDATE_INTERVAL_MS) return;
      this.lastUpdate = t;

      const gm = this.el.components['game-manager'];
      const lines = [
        `STARTHROWER ${VERSION}`,
        formatGameLine(gm),
        formatHandLine(this.getInfo(this.handL)),
        formatHandLine(this.getInfo(this.handR)),
      ];
      if (this.tunedLine) lines.push(this.tunedLine);
      this.panelEl.setAttribute('text', 'value', lines.join('\n'));
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
