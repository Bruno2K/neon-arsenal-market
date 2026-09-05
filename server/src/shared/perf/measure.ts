export type TimingSummary = {
  samples: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
};

export async function timeAsync(operation: () => Promise<unknown>, samples: number): Promise<TimingSummary> {
  const durations: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    await operation();
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  return {
    samples,
    minMs: roundMs(durations[0]),
    maxMs: roundMs(durations[durations.length - 1]),
    p50Ms: roundMs(percentile(durations, 0.5)),
    p95Ms: roundMs(percentile(durations, 0.95)),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}
