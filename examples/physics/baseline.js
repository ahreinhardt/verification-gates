#!/usr/bin/env node
// Snapshot baseline for the example generators.
//
//   node examples/physics/baseline.js            # check — fails on drift
//   node examples/physics/baseline.js --update   # re-approve, deliberately
//
// Checking and updating are separate commands so baseline changes are explicit
// and reviewable.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sample, compareBaseline, writeBaseline } from '../../src/index.js';
import { generators } from './generators.js';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(here, 'baseline.json');

// Project away nothing here, but in production you pin the student-visible
// surface — prompt, given values, answer — not internal scratch state.
const samples = Object.entries(generators).map(([name, generate]) =>
  sample({ name, generate, runs: 10, seed: 1 })
);

if (process.argv.includes('--update')) {
  writeBaseline(samples, BASELINE);
  console.log(`baseline re-approved: ${samples.length} generators → ${BASELINE}`);
  process.exit(0);
}

const r = compareBaseline(samples, BASELINE);
if (r.ok) {
  console.log(`baseline ok: ${samples.length} generators unchanged`);
  process.exit(0);
}
if (r.missing) console.error('no baseline committed — run with --update to create one');
if (r.changed.length) console.error(`drift in: ${r.changed.join(', ')}`);
if (r.added.length) console.error(`new generators: ${r.added.join(', ')}`);
if (r.removed.length) console.error(`removed generators: ${r.removed.join(', ')}`);
console.error('\nIf these changes are intended, re-approve with:\n  node examples/physics/baseline.js --update');
process.exit(1);
