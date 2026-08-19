import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  noTemplateArtifacts, finiteNumbers, magnitudeBand, noAnswerLeak, invariant, walk, closeTo,
} from '../src/checks.js';

const passes = (check, value) => { check.assert(value); return true; };
const failsWith = (check, value, re) => {
  assert.throws(() => check.assert(value), (e) => re.test(e.message), `expected failure matching ${re}`);
  return true;
};

test('walk yields every leaf with a path', () => {
  const paths = [...walk({ a: 1, b: { c: 'x' }, d: [true] })].map(([p]) => p);
  assert.deepEqual(paths, ['$.a', '$.b.c', '$.d[0]']);
});

test('noTemplateArtifacts catches broken interpolation, allows clean text', () => {
  const c = noTemplateArtifacts();
  assert.ok(passes(c, { prompt: 'A 5 kg cart on level grass.' }));
  failsWith(c, { prompt: 'A ball across undefined.' }, /undefined/);
  failsWith(c, { prompt: 'Speed is NaN m/s' }, /NaN/);
  failsWith(c, { prompt: 'Value: [object Object]' }, /object Object/);
  failsWith(c, { prompt: 'Hello {{name}}' }, /\{\{/);
});

test('noTemplateArtifacts does not false-positive on ordinary prose', () => {
  // words that merely contain the tokens must not trip the word-boundary regex
  assert.ok(passes(noTemplateArtifacts(), { prompt: 'The undefinedness of it. Nullable annulled.' }));
});

test('finiteNumbers catches NaN and Infinity', () => {
  const c = finiteNumbers();
  assert.ok(passes(c, { answer: 4.2, count: 0 }));
  failsWith(c, { answer: 0 / 0 }, /non-finite/);
  failsWith(c, { answer: 1 / 0 }, /non-finite/);
});

test('magnitudeBand catches plausible-looking absurdity', () => {
  const c = magnitudeBand({ min: 1e-3, max: 1e6 });
  assert.ok(passes(c, { v: 12.5 }));
  assert.ok(passes(c, { v: 0 }), 'zero allowed by default');
  failsWith(c, { v: 4.2e17 }, /out of band/);
  failsWith(c, { v: 1e-9 }, /out of band/);
});

test('magnitudeBand honours the `only` path filter', () => {
  const c = magnitudeBand({ min: 1, max: 10, only: /answer/ });
  assert.ok(passes(c, { answer: 5, internalSeed: 999999 }));
  failsWith(c, { answer: 5000 }, /out of band/);
});

test('noAnswerLeak finds the answer in visible text', () => {
  const c = noAnswerLeak({
    answer: (d) => d.answer,
    prompt: (d) => [['$.prompt', d.prompt], ...(d.table ?? []).map((t, i) => [`$.table[${i}]`, t])],
  });
  assert.ok(passes(c, { answer: 3.5, prompt: 'Find the speed.', table: ['momentum: 14'] }));
  failsWith(c, { answer: 3.5, prompt: 'Find the speed.', table: ['3.5'] }, /leaks into \$\.table\[0\]/);
});

test('noAnswerLeak ignores absent or trivially short answers', () => {
  const c = noAnswerLeak({ answer: (d) => d.answer, prompt: (d) => [['$.p', d.p]] });
  assert.ok(passes(c, { answer: undefined, p: 'anything' }));
  assert.ok(passes(c, { answer: 5, p: 'there are 5 carts' }), 'single chars are too noisy to flag');
});

test('invariant accepts true/undefined and reports the returned string', () => {
  assert.ok(passes(invariant('ok', () => true), {}));
  assert.ok(passes(invariant('ok', () => undefined), {}));
  failsWith(invariant('energy', () => 'mgh != half mv^2'), {}, /mgh != half/);
  failsWith(invariant('energy', () => false), {}, /violated/);
});

test('closeTo scales tolerance with magnitude', () => {
  assert.ok(closeTo(1e6, 1e6 + 0.5, 1e-6));
  assert.ok(!closeTo(1, 2, 1e-6));
  assert.ok(closeTo(0, 1e-9, 1e-6), 'near-zero compares against unit scale');
});
