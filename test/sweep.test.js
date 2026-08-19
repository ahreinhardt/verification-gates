import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweep, sweepAll, formatReport } from '../src/sweep.js';
import { rngFor } from '../src/random.js';
import { check, finiteNumbers } from '../src/checks.js';

test('a clean generator passes every draw', () => {
  const r = sweep({ name: 'clean', generate: (rng) => ({ v: rng.float(1, 2) }), checks: [finiteNumbers()], runs: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.failures.length, 0);
  assert.equal(r.drawsTaken, 50);
});

test('a reported seed reproduces its failure', () => {
  const generate = (rng) => ({ v: rng.float(0, 1) > 0.8 ? Number.NaN : 1 });
  const r = sweep({ name: 'flaky', generate, checks: [finiteNumbers()], runs: 200 });
  assert.ok(r.failures.length > 0, 'expected at least one failure to test against');

  for (const f of r.failures) {
    const replay = generate(rngFor(f.seed));
    assert.ok(Number.isNaN(replay.v), `seed ${f.seed} did not reproduce the reported failure`);
  }
});

test('a generator that throws is reported, not swallowed', () => {
  const r = sweep({
    name: 'explodes',
    generate: () => { throw new Error('boom'); },
    checks: [finiteNumbers()],
    runs: 5,
    maxFailures: 3,
  });
  assert.equal(r.ok, false);
  assert.equal(r.failures[0].check, 'generate');
  assert.match(r.failures[0].message, /boom/);
});

test('truncation is reported rather than understated', () => {
  const r = sweep({
    name: 'allBad',
    generate: () => ({ v: Number.NaN }),
    checks: [finiteNumbers()],
    runs: 500,
    maxFailures: 4,
  });
  assert.equal(r.truncated, true);
  assert.equal(r.failures.length, 4);
  assert.ok(r.drawsTaken < 500);
  assert.match(formatReport({ results: [r] }), /stopped early/);
});

test('only the first failing check per draw is recorded', () => {
  const always = (name) => check(name, () => { throw new Error(`${name} failed`); });
  const r = sweep({ name: 'multi', generate: () => ({}), checks: [always('a'), always('b')], runs: 1 });
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].check, 'a');
});

test('sweepAll aggregates and never throws', () => {
  const agg = sweepAll([
    { name: 'good', generate: () => ({ v: 1 }), checks: [finiteNumbers()] },
    { name: 'bad', generate: () => ({ v: Number.NaN }), checks: [finiteNumbers()] },
  ], { runs: 10 });
  assert.equal(agg.ok, false);
  assert.equal(agg.results.length, 2);
  assert.match(formatReport(agg), /ok {4}good/);
  assert.match(formatReport(agg), /FAIL {2}bad/);
});
