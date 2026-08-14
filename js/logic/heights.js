export function createHeightSampler() {
  const samples = [];
  return {
    addSample(y) {
      if (typeof y === 'number' && y > 0.5 && y < 2.6) samples.push(y);
    },
    stable() {
      if (!samples.length) return 0;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
    },
    count: () => samples.length,
  };
}
