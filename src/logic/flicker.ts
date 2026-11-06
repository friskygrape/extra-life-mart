export interface FlickerStep {
  on: boolean;
  ms: number;
}

/** A shelf light only stutters every so often: somewhere between 8 and 25 seconds apart. */
export function nextFlickerSeconds(rng: () => number = Math.random): number {
  return 8 + rng() * 17;
}

/** A quick stutter of two or three blinks, finishing with the light back on. */
export function flickerSteps(rng: () => number = Math.random): FlickerStep[] {
  const blinks = 2 + Math.floor(rng() * 2);
  const steps: FlickerStep[] = [];
  for (let i = 0; i < blinks; i++) {
    steps.push({ on: false, ms: 40 + Math.floor(rng() * 70) });
    steps.push({ on: true, ms: 30 + Math.floor(rng() * 50) });
  }
  return steps;
}
