// Four problem generators. One is correct. Three reproduce defect classes seen
// in production while still returning finite, well-formatted output.

const G = 9.8;
const round = (x, n = 2) => Number(x.toFixed(n));

/** CORRECT. Drop from rest; find the speed at the ground. */
export function freeFall(rng) {
  const h = round(rng.float(1.5, 45));
  const v = Math.sqrt(2 * G * h);
  return {
    id: 'freeFall',
    prompt: `An object is released from rest at a height of ${h} m. What is its speed just before it hits the ground?`,
    given: { height: h, g: G },
    answer: { value: round(v), unit: 'm/s' },
    energy: { potential: G * h, kinetic: 0.5 * v * v },
  };
}

/**
 * BUG — degrees passed where radians are required.
 *
 * The stated rise height uses a correct conversion; the answer re-derives the
 * same quantity inline and forgets it. Two implementations of one formula
 * drifted apart. Numbers stay finite and the prompt reads perfectly, so only an
 * energy-conservation check detects it.
 */
export function pendulumSpeed(rng) {
  const L = round(rng.float(0.5, 2.5));
  const thetaDeg = rng.int(10, 60);
  const rad = (thetaDeg * Math.PI) / 180;
  const h = L * (1 - Math.cos(rad));                        // correct
  const v = Math.sqrt(2 * G * L * (1 - Math.cos(thetaDeg))); // BUG: degrees
  return {
    id: 'pendulumSpeed',
    prompt: `A pendulum bob on a ${L} m string is released from rest at ${thetaDeg}° from vertical. How fast is it moving at the lowest point?`,
    given: { length: L, angleDeg: thetaDeg, riseHeight: round(h, 4), g: G },
    answer: { value: round(v), unit: 'm/s' },
    energy: { potential: G * h, kinetic: 0.5 * v * v },
  };
}

/**
 * BUG — an optional field is interpolated unguarded.
 *
 * `surface` is only set on the angled branch, so the flat branch renders the
 * string "undefined" straight into the student-facing prompt.
 */
export function projectileRange(rng) {
  const v0 = round(rng.float(8, 40));
  const angled = rng.bool(0.5);
  const theta = angled ? rng.int(15, 75) : 0;
  const surface = angled ? rng.pick(['level grass', 'packed sand', 'a flat roof']) : undefined;
  const rad = (theta * Math.PI) / 180;
  const range = angled ? (v0 * v0 * Math.sin(2 * rad)) / G : 0;
  return {
    id: 'projectileRange',
    prompt: `A ball leaves the ground at ${v0} m/s across ${surface}. Find its horizontal range.`,
    given: { speed: v0, angleDeg: theta, g: G },
    answer: { value: round(range), unit: 'm' },
  };
}

/**
 * BUG — the answer leaks into the prompt.
 *
 * A summary table rendered beside the question displays the very quantity the
 * student is being asked to compute. The physics is valid, but the prompt no
 * longer tests the intended calculation.
 */
export function collisionMomentum(rng) {
  const m1 = round(rng.float(1, 6), 1);
  const v1 = round(rng.float(2, 12), 1);
  const m2 = round(rng.float(1, 6), 1);
  const vFinal = round((m1 * v1) / (m1 + m2));
  return {
    id: 'collisionMomentum',
    prompt: `A ${m1} kg cart moving at ${v1} m/s strikes a stationary ${m2} kg cart and they couple together. Find their common final speed.`,
    table: [
      ['quantity', 'before', 'after'],
      ['total momentum (kg·m/s)', String(round(m1 * v1)), String(round(m1 * v1))],
      ['common speed (m/s)', '—', String(vFinal)], // leaks the answer
    ],
    given: { m1, v1, m2 },
    answer: { value: vFinal, unit: 'm/s' },
  };
}

export const generators = { freeFall, pendulumSpeed, projectileRange, collisionMomentum };
