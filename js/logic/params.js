export function parseParams(search) {
  const q = new URLSearchParams(search || '');
  const num = (k, fallback) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return { desktop: q.has('desktop'), dist: num('dist', 0), speed: num('speed', 1) };
}
