import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRide } from '../js/logic/ride.js';
import { RIDE } from '../js/logic/script.js';

const ride = { speed: 10, waypoints: [], events: [
  { at: 5, type: 'beat', name: 'departure' },
  { at: 60, type: 'spawn', target: 'crate', pos: [0, 0, -60] },
  { at: 100, type: 'end' },
] };

test('events emit once, in order, at distance', () => {
  const r = createRide(ride);
  assert.deepEqual(r.advance(400), []);           // 4m
  const first = r.advance(400);                    // 8m
  assert.equal(first.length, 1);
  assert.equal(first[0].type, 'beat');
  assert.deepEqual(r.advance(100), []);            // no repeats
});

test('spawns emit 40m early', () => {
  const r = createRide(ride);
  const due = r.advance(2100);                     // 21m — spawn at=60 due from 20m
  assert.ok(due.some((e) => e.type === 'spawn'));
});

test('ride completes exactly once', () => {
  const r = createRide(ride);
  const all = r.advance(60000);
  assert.equal(all.filter((e) => e.type === 'end').length, 1);
  assert.ok(r.done());
  assert.deepEqual(r.advance(1000), []);
});

test('ride data is deep frozen', () => {
  assert.ok(Object.isFrozen(RIDE));
  assert.ok(Object.isFrozen(RIDE.events));
  assert.ok(Object.isFrozen(RIDE.events[0]));
  const spawnEvent = RIDE.events.find((e) => e.type === 'spawn');
  assert.ok(Object.isFrozen(spawnEvent.pos));
});
