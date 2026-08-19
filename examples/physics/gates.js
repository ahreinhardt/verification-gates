// Wiring the gates to the generators. This file is the thing worth copying: it
// is what "define the properties, then take a lot of draws" looks like in
// practice.

import {
  noTemplateArtifacts, finiteNumbers, magnitudeBand, noAnswerLeak, invariant, closeTo,
} from '../../src/index.js';
import { generators } from './generators.js';

/** Applied to every generator, regardless of what it produces. */
export const universalChecks = [
  noTemplateArtifacts(),
  finiteNumbers(),
  magnitudeBand({ min: 1e-3, max: 1e6 }),
  noAnswerLeak({
    answer: (d) => d.answer?.value,
    format: (v) => String(v),
    // every string a student can read before solving
    prompt: (d) => [
      ['$.prompt', d.prompt],
      ...(d.table ?? []).flatMap((row, i) => row.map((cell, j) => [`$.table[${i}][${j}]`, cell])),
    ],
  }),
];

/** Domain assertions — the layer no static check can reach. */
export const energyConservation = invariant('energyConservation', (d) => {
  if (!d.energy) return true;
  const { potential, kinetic } = d.energy;
  return (
    closeTo(potential, kinetic, 1e-3) ||
    `energy not conserved: mgh=${potential.toFixed(4)} but ½mv²=${kinetic.toFixed(4)}`
  );
});

export const specs = [
  { name: 'freeFall', generate: generators.freeFall, checks: [...universalChecks, energyConservation] },
  { name: 'pendulumSpeed', generate: generators.pendulumSpeed, checks: [...universalChecks, energyConservation] },
  { name: 'projectileRange', generate: generators.projectileRange, checks: universalChecks },
  { name: 'collisionMomentum', generate: generators.collisionMomentum, checks: universalChecks },
];
