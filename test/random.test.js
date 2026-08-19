import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rngFor } from '../src/random.js';

test('same seed produces an identical sequence', () => {
  const a = Array.from({ length: 20 }, (_, i) => rngFor(7).float(0, 1) + i * 0);
  const b = Array.from({ length: 20 }, () => rngFor(7).float(0, 1));
  assert.deepEqual(a, b);
});

test('different seeds diverge', () => {
  assert.notEqual(rngFor(1).float(0, 1), rngFor(2).float(0, 1));
});

test('a single rng advances rather than repeating', () => {
  const rng = rngFor(42);
  const draws = Array.from({ length: 10 }, () => rng.next());
  assert.equal(new Set(draws).size, 10);
});

test('helpers respect their bounds', () => {
  const rng = rngFor(3);
  for (let i = 0; i < 500; i++) {
    const f = rng.float(2, 5);
    assert.ok(f >= 2 && f < 5, `float out of range: ${f}`);
    const n = rng.int(1, 6);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 6, `int out of range: ${n}`);
    assert.ok(['a', 'b', 'c'].includes(rng.pick(['a', 'b', 'c'])));
  }
});
