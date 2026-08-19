// The property harness.
//
// The premise: when content is generated, there is no fixed answer key to diff
// against. The surface under test is the *generator*, so you assert properties
// that must hold for every draw and then take a lot of draws.

import { rngFor } from './random.js';

/**
 * Run `generate` many times and apply every check to each draw.
 *
 * @param {object}   spec
 * @param {string}   spec.name       Generator identity, used in reports.
 * @param {Function} spec.generate   (rng) => value
 * @param {Array}    spec.checks     Checks from ./checks.js
 * @param {number}   [spec.runs]     Draw count (default 100).
 * @param {number}   [spec.seed]     Base seed; draw i uses seed + i.
 * @param {number}   [spec.maxFailures] Stop collecting after this many (default 10).
 * @returns {{name, runs, ok, failures}} Failures carry the seed that reproduces them.
 */
export function sweep({ name, generate, checks = [], runs = 100, seed = 1, maxFailures = 10 }) {
  const failures = [];
  let drawsTaken = 0;

  for (let i = 0; i < runs; i++) {
    drawsTaken = i + 1;
    const drawSeed = seed + i;
    let draw;
    try {
      draw = generate(rngFor(drawSeed));
    } catch (err) {
      failures.push({ seed: drawSeed, check: 'generate', message: `threw: ${err.message}` });
      if (failures.length >= maxFailures) break;
      continue;
    }
    for (const { name: checkName, assert } of checks) {
      try {
        assert(draw);
      } catch (err) {
        failures.push({ seed: drawSeed, check: checkName, message: err.message, draw });
        break; // one failure per draw is enough to act on
      }
    }
    if (failures.length >= maxFailures) break;
  }

  // `truncated` matters: stopping at maxFailures means the failure count is a
  // floor, not a total. Reporting "10 of 200" when you stopped looking at 10
  // understates the blast radius.
  const truncated = failures.length >= maxFailures && drawsTaken < runs;
  return { name, runs, drawsTaken, truncated, ok: failures.length === 0, failures };
}

/** Run many sweeps. Returns the aggregate; never throws. */
export function sweepAll(specs, defaults = {}) {
  const results = specs.map((s) => sweep({ ...defaults, ...s }));
  return { ok: results.every((r) => r.ok), results };
}

/** Human-readable report. Returns a string; caller decides where it goes. */
export function formatReport({ results }) {
  const out = [];
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      out.push(`  ok    ${r.name}  (${r.runs} draws)`);
      continue;
    }
    failed++;
    const count = r.truncated
      ? `${r.failures.length}+ failing draws in the first ${r.drawsTaken} (stopped early)`
      : `${r.failures.length} of ${r.runs} draws`;
    out.push(`  FAIL  ${r.name}  (${count})`);
    for (const f of r.failures.slice(0, 3)) {
      out.push(`          [${f.check}] ${f.message}`);
      out.push(`          reproduce: seed ${f.seed}`);
    }
    if (r.failures.length > 3) out.push(`          … ${r.failures.length - 3} more`);
  }
  out.push('');
  out.push(failed === 0 ? `all ${results.length} generators passed` : `${failed} of ${results.length} generators FAILED`);
  return out.join('\n');
}
