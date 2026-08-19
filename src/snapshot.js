// Snapshot baselines.
//
// Pin the output of a generator set to a committed file. Drift fails the build;
// changing the baseline is an explicit, reviewed act rather than a side effect.
// This is what makes it safe to let a model rewrite a body of content: it can
// change anything it likes, but it cannot quietly change something already
// verified without that showing up as a diff a human has to approve.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { rngFor } from './random.js';

/** Deterministic sample of a generator: the same seeds every time. */
export function sample({ name, generate, runs = 20, seed = 1, project = (d) => d }) {
  const draws = [];
  for (let i = 0; i < runs; i++) draws.push(project(generate(rngFor(seed + i))));
  return { name, seed, runs, draws };
}

function stable(value) {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'number' && Number.isFinite(value)
      ? Number(value.toPrecision(12)) // kill float noise across platforms
      : value;
  }
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
}

/**
 * Compare samples against a committed baseline.
 * @returns {{ok, added, removed, changed}} `changed` names generators whose draws drifted.
 */
export function compareBaseline(samples, baselinePath) {
  const current = Object.fromEntries(samples.map((s) => [s.name, stable(s)]));
  if (!existsSync(baselinePath)) {
    return { ok: false, missing: true, added: Object.keys(current), removed: [], changed: [] };
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const added = Object.keys(current).filter((k) => !(k in baseline));
  const removed = Object.keys(baseline).filter((k) => !(k in current));
  const changed = Object.keys(current).filter(
    (k) => k in baseline && JSON.stringify(baseline[k]) !== JSON.stringify(current[k])
  );
  return { ok: !added.length && !removed.length && !changed.length, missing: false, added, removed, changed };
}

/** Re-approve the baseline. Should be a deliberate command, never automatic. */
export function writeBaseline(samples, baselinePath) {
  const payload = Object.fromEntries(samples.map((s) => [s.name, stable(s)]));
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');
  return payload;
}
