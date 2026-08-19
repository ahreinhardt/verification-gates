import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sample, compareBaseline, writeBaseline } from '../src/snapshot.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'vg-'));
const gen = (bias = 0) => (rng) => ({ v: Number((rng.float(0, 1) + bias).toFixed(6)) });

test('sampling is deterministic for a fixed seed', () => {
  const a = sample({ name: 'g', generate: gen(), runs: 5, seed: 3 });
  const b = sample({ name: 'g', generate: gen(), runs: 5, seed: 3 });
  assert.deepEqual(a.draws, b.draws);
});

test('a fresh baseline is written, then matches itself', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'nested', 'baseline.json');
    const s = [sample({ name: 'g', generate: gen(), runs: 5 })];
    writeBaseline(s, p);
    assert.equal(compareBaseline(s, p).ok, true);
    assert.match(readFileSync(p, 'utf8'), /\n$/, 'baseline should end with a newline for clean diffs');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a missing baseline fails rather than silently passing', () => {
  const r = compareBaseline([sample({ name: 'g', generate: gen(), runs: 2 })], join(tmp(), 'absent.json'));
  assert.equal(r.ok, false);
  assert.equal(r.missing, true);
});

test('drift is detected and named', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'b.json');
    writeBaseline([sample({ name: 'g', generate: gen(0), runs: 5 })], p);
    const r = compareBaseline([sample({ name: 'g', generate: gen(0.5), runs: 5 })], p);
    assert.equal(r.ok, false);
    assert.deepEqual(r.changed, ['g']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('added and removed generators are reported separately from drift', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'b.json');
    writeBaseline([sample({ name: 'old', generate: gen(), runs: 2 })], p);
    const r = compareBaseline([sample({ name: 'new', generate: gen(), runs: 2 })], p);
    assert.deepEqual(r.added, ['new']);
    assert.deepEqual(r.removed, ['old']);
    assert.deepEqual(r.changed, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('float noise below 12 significant digits does not trip drift', () => {
  // Baselines that fail on the last bit of a double are baselines nobody trusts.
  const dir = tmp();
  try {
    const p = join(dir, 'b.json');
    writeBaseline([{ name: 'g', seed: 1, runs: 1, draws: [{ v: 0.1 + 0.2 }] }], p);
    const r = compareBaseline([{ name: 'g', seed: 1, runs: 1, draws: [{ v: 0.3 }] }], p);
    assert.equal(r.ok, true, '0.30000000000000004 and 0.3 must compare equal');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('key order does not affect the baseline', () => {
  const dir = tmp();
  try {
    const p = join(dir, 'b.json');
    writeBaseline([{ name: 'g', seed: 1, runs: 1, draws: [{ a: 1, b: 2 }] }], p);
    const r = compareBaseline([{ name: 'g', seed: 1, runs: 1, draws: [{ b: 2, a: 1 }] }], p);
    assert.equal(r.ok, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
