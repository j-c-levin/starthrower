import { createSpline } from './spline.js';

const BEAT_ORDER = ['departure', 'asteroids', 'derelict', 'boss', 'tally'];
const dist3 = (a, b) => Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export function validateRide(ride) {
  const errors = [];
  const { waypoints = [], events = [], speed = 6 } = ride || {};

  if (waypoints.length < 2) {
    errors.push('need at least 2 waypoints');
    return errors;
  }

  for (let i = 1; i < events.length; i++) {
    if (events[i].at < events[i - 1].at) {
      errors.push(`events out of order at index ${i} (${events[i].at} < ${events[i - 1].at})`);
    }
  }

  const ends = events.filter((e) => e.type === 'end');
  if (ends.length !== 1) {
    errors.push(`expected exactly one end event, found ${ends.length}`);
  } else if (events[events.length - 1].type !== 'end') {
    errors.push('end event must be the last event');
  }

  const spline = createSpline(waypoints);

  for (const e of events) {
    if (e.at < 0 || e.at > spline.length) {
      errors.push(`event at=${e.at} (${e.type}) out of range [0, ${spline.length.toFixed(2)}]`);
    }
  }

  for (const e of events) {
    if (e.type === 'spawn') {
      const rail = spline.pointAt(e.at);
      const d = dist3(rail, e.pos);
      if (d > 45) {
        errors.push(`spawn at=${e.at} (${e.target}) is ${d.toFixed(1)}m from the rail (max 45m)`);
      }
    }
  }

  const beats = events.filter((e) => e.type === 'beat').map((e) => e.name);
  let expectIdx = 0;
  for (const name of beats) {
    const idx = BEAT_ORDER.indexOf(name);
    if (idx === -1) {
      errors.push(`unknown beat name "${name}"`);
      continue;
    }
    if (idx < expectIdx) {
      errors.push(`beat "${name}" is out of spec order`);
    } else {
      expectIdx = idx;
    }
  }

  const STEP = 1;
  let prevTangent = spline.tangentAt(0);
  for (let d = STEP; d <= spline.length; d += STEP) {
    const t = spline.tangentAt(d);
    const cosAngle = Math.max(-1, Math.min(1, dot(prevTangent, t)));
    if (cosAngle <= 0) {
      errors.push(`reversal (tangent dot <= 0) near d=${d.toFixed(1)}`);
    } else {
      const { yaw, pitch } = angleComponents(prevTangent, t);
      const yawRate = yaw * speed;
      const pitchRate = pitch * speed;
      if (yawRate > 30) {
        errors.push(`yaw rate ${yawRate.toFixed(1)}°/s exceeds 30°/s near d=${d.toFixed(1)}`);
      }
      if (pitchRate > 10) {
        errors.push(`pitch rate ${pitchRate.toFixed(1)}°/s exceeds 10°/s near d=${d.toFixed(1)}`);
      }
    }
    prevTangent = t;
  }

  return errors;
}

function angleComponents(t0, t1) {
  const yaw0 = Math.atan2(t0.x, -t0.z);
  const yaw1 = Math.atan2(t1.x, -t1.z);
  let yawDelta = Math.abs(yaw1 - yaw0);
  if (yawDelta > Math.PI) yawDelta = 2 * Math.PI - yawDelta;

  const flat0 = Math.hypot(t0.x, t0.z) || 1e-9;
  const flat1 = Math.hypot(t1.x, t1.z) || 1e-9;
  const pitch0 = Math.atan2(t0.y, flat0);
  const pitch1 = Math.atan2(t1.y, flat1);
  const pitchDelta = Math.abs(pitch1 - pitch0);

  return { yaw: yawDelta * (180 / Math.PI), pitch: pitchDelta * (180 / Math.PI) };
}
