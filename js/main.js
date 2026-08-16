import { VERSION } from './version.js';
import './palette.js';
import './sky.js';
import './ambient.js';
import './hands.js';
import './targets.js';
import './boss.js';
import './projectiles.js';
import './rail.js';
import './game.js';
import './input-watcher.js';
import './hud.js';
import './tally.js';
import './audio.js';
import './debug-panel.js';

// The debug panel only renders behind ?debug; this is the always-on way to
// confirm which build a session is running (console is available on Quest too).
console.log('starthrower ' + VERSION);
