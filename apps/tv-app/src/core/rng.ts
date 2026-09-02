/**
 * Tiny deterministic PRNG (mulberry32). Used so a Wall's mosaic layout and
 * initial style assignment are stable across app restarts for the same
 * `layoutSeed`, instead of reshuffling every time the screensaver launches.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, max) */
export function rngInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/** Float in [min, max) */
export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Pick a random element from a non-empty array. */
export function rngPick<T>(rng: Rng, items: readonly T[]): T {
  return items[rngInt(rng, items.length)];
}

/** Fisher-Yates shuffle using the given rng, returns a new array. */
export function rngShuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
