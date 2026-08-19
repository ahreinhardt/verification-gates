#!/usr/bin/env node
// Runs the gates against the example generators and prints the report.
//
// Three of the four generators are deliberately broken. This script asserts that
// each one is caught and that the correct generator passes clean — so CI stays
// green while proving the gates actually detect, rather than merely running.

import { sweep, sweepAll, formatReport } from '../../src/index.js';
import { specs } from './gates.js';

const report = sweepAll(specs, { runs: 200, seed: 1 });

console.log('\nverification-gates — example sweep (200 draws per generator)\n');
console.log(formatReport(report));

const byName = Object.fromEntries(report.results.map((r) => [r.name, r]));
const expected = {
  freeFall: null,
  pendulumSpeed: 'invariant:energyConservation',
  projectileRange: 'noTemplateArtifacts',
  collisionMomentum: 'noAnswerLeak',
};

let bad = 0;
console.log('\ndetection check — did each gate catch what it should?\n');
for (const [name, wanted] of Object.entries(expected)) {
  const r = byName[name];
  const got = r.ok ? null : r.failures[0].check;
  const ok = got === wanted;
  if (!ok) bad++;
  const detail = wanted === null ? 'expected clean' : `expected ${wanted}`;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(18)} ${detail.padEnd(38)} got ${got ?? 'clean'}`);
}

// How often does each bug actually surface? This is the argument for sweeping
// rather than spot-checking, stated in numbers instead of asserted.
console.log('\nhow often each bug surfaces (exhaustive, 2000 draws)\n');
for (const s of specs) {
  const full = sweep({ ...s, runs: 2000, seed: 1, maxFailures: Infinity });
  const pct = (100 * full.failures.length / full.runs).toFixed(1);
  const note = full.failures.length === 0 ? 'clean'
    : Number(pct) < 75 ? `${pct}% of draws — one spot-check would likely miss it`
    : `${pct}% of draws`;
  console.log(`  ${s.name.padEnd(18)} ${note}`);
}

console.log(
  bad === 0
    ? '\nall gates behaved as expected\n'
    : `\n${bad} gate(s) did not behave as expected\n`
);
process.exit(bad === 0 ? 0 : 1);
