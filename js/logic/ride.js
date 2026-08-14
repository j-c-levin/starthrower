export function createRide(ride) {
  const queue = ride.events
    .map((e) => ({ e, due: e.type === 'spawn' ? Math.max(0, e.at - 40) : e.at }))
    .sort((a, b) => a.due - b.due);
  let distance = 0, cursor = 0, done = false;
  return {
    advance(dtMs) {
      if (done) return [];
      distance += (ride.speed * dtMs) / 1000;
      const out = [];
      while (cursor < queue.length && queue[cursor].due <= distance) {
        out.push(queue[cursor].e);
        if (queue[cursor].e.type === 'end') { done = true; }
        cursor += 1;
        if (done) break;
      }
      return out;
    },
    distance: () => distance,
    done: () => done,
  };
}
