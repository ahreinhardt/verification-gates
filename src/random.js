// Seeded PRNG. Every draw in a sweep gets its own seed so that any failure is
// reproducible from the seed alone — the single most important property of a
// randomized harness. A failure you cannot re-run is a rumour, not a bug report.

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the RNG handed to a generator. Deterministic for a given seed. */
export function rngFor(seed) {
  const next = mulberry32(seed);
  return {
    seed,
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    bool: (p = 0.5) => next() < p,
  };
}
