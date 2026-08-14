import { VERSION } from './version.js';

const UPDATE_INTERVAL_MS = 250;

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
  return (
    `${info.hand.toUpperCase()}  htc:${info.hasTrackingControls ? 'y' : 'n'}` +
    `  poses:${info.hasPoses ? 'y' : 'n'}  wrist:${wrist}  dist:${info.dist.toFixed(2)}m` +
    `  base:${baseline}  thr:${threshold}  state:${info.state}  fired:${info.firedCount}  dir:${dir}`
  );
}

function register() {
  AFRAME.registerComponent('debug-panel', {
    init() {
      this.lastUpdate = -Infinity;
      this.handL = this.el.querySelector('#handL');
      this.handR = this.el.querySelector('#handR');

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
      if (t - this.lastUpdate < UPDATE_INTERVAL_MS) return;
      this.lastUpdate = t;

      const lines = [
        `STARTHROWER ${VERSION}`,
        formatHandLine(this.getInfo(this.handL)),
        formatHandLine(this.getInfo(this.handR)),
      ];
      this.panelEl.setAttribute('text', 'value', lines.join('\n'));
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
