# verification-gates

Small, deterministic tools for testing generated content: seeded property sweeps,
domain invariants, and snapshot baselines. Zero runtime dependencies.

```bash
git clone https://github.com/ahreinhardt/verification-gates && cd verification-gates
npm run verify        # tests + baseline + the worked example. No install step.
```

---

## The problem

Generated content may vary on every run, so one fixture cannot represent the
possible output. The generator and its invariants become the test surface.
Several common defects remain valid JavaScript and pass a one-sample unit test:

| Failure | Types | Lint | Unit test on one sample |
|---|:--:|:--:|:--:|
| `undefined` interpolated into user-facing text | ✗ | ✗ | ✗ |
| A velocity of `4.2e17 m/s` — finite, formatted, absurd | ✗ | ✗ | ✗ |
| Degrees passed where radians are required | ✗ | ✗ | sometimes |
| The answer displayed beside the question | ✗ | ✗ | ✗ |
| A model quietly rewriting an answer that was already verified | ✗ | ✗ | ✗ |

The library is based on verification patterns used by
[PhabPhysics](https://github.com/ahreinhardt/phabphysics), a live AP Physics
platform with randomized problems and LLM-assisted curriculum authoring.

---

## What it looks like when it works

`npm run demo` runs the gates against four example generators. Three carry bugs
drawn from real production defects; each produces output that is finite,
well-formatted, and entirely plausible to a human reading one sample.

```
verification-gates — example sweep (200 draws per generator)

  ok    freeFall  (200 draws)
  FAIL  pendulumSpeed  (10+ failing draws in the first 10, stopped early)
          [invariant:energyConservation] energy not conserved: mgh=0.2605 but ½mv²=31.5401
          reproduce: seed 1
          [invariant:energyConservation] energy not conserved: mgh=1.9539 but ½mv²=6.8166
          reproduce: seed 2
          [invariant:energyConservation] energy not conserved: mgh=0.3493 but ½mv²=18.9279
          reproduce: seed 3
          … 7 more
  FAIL  projectileRange  (10+ failing draws in the first 28, stopped early)
          [noTemplateArtifacts] template artifact "undefined" at $.prompt: "A ball leaves the ground at 30.07 m/s across undefined. Find its horizontal range."
          reproduce: seed 5
          [noTemplateArtifacts] template artifact "undefined" at $.prompt: "A ball leaves the ground at 13 m/s across undefined. Find its horizontal range."
          reproduce: seed 8
          [noTemplateArtifacts] template artifact "undefined" at $.prompt: "A ball leaves the ground at 14.36 m/s across undefined. Find its horizontal range."
          reproduce: seed 9
          … 7 more
  FAIL  collisionMomentum  (10+ failing draws in the first 10, stopped early)
          [noAnswerLeak] answer "1.06" leaks into $.table[2][2]: "1.06"
          reproduce: seed 1
          [noAnswerLeak] answer "3.44" leaks into $.table[2][2]: "3.44"
          reproduce: seed 2
          [noAnswerLeak] answer "1.4" leaks into $.table[2][2]: "1.4"
          reproduce: seed 3
          … 7 more

3 of 4 generators FAILED

detection check — did each gate catch what it should?

  ok    freeFall           expected clean                         got clean
  ok    pendulumSpeed      expected invariant:energyConservation  got invariant:energyConservation
  ok    projectileRange    expected noTemplateArtifacts           got noTemplateArtifacts
  ok    collisionMomentum  expected noAnswerLeak                  got noAnswerLeak

how often each bug surfaces (exhaustive, 2000 draws)

  freeFall           clean
  pendulumSpeed      100.0% of draws
  projectileRange    50.7% of draws — one spot-check would likely miss it
  collisionMomentum  98.8% of draws

all gates behaved as expected
```

Each draw has its own seed, so `reproduce: seed N` identifies a failing case with
one integer. Seed reporting is tested in
[`test/sweep.test.js`](test/sweep.test.js).

---

## Core components

### 1. Seeded property sweeps

Define conditions that should hold for every draw, then sample the generator
repeatedly.

```js
import { sweep, noTemplateArtifacts, finiteNumbers, magnitudeBand } from './src/index.js';

const result = sweep({
  name: 'projectileRange',
  generate: (rng) => makeProblem(rng),   // rng is seeded per draw
  checks: [noTemplateArtifacts(), finiteNumbers(), magnitudeBand({ min: 1e-3, max: 1e6 })],
  runs: 200,
});
// → { ok, drawsTaken, truncated, failures: [{ seed, check, message }] }
```

The demo also measures detection frequency. The `projectileRange` defect appears
in **50.7%** of draws, so one manual sample has roughly even odds of missing it.
The degrees/radians defect in `pendulumSpeed` appears on every draw but still
produces finite numbers and readable text; the energy invariant detects it.

### 2. Domain invariants

Some things are only wrong if you know the domain.

```js
const energyConservation = invariant('energyConservation', (d) =>
  closeTo(d.energy.potential, d.energy.kinetic, 1e-3) ||
  `energy not conserved: mgh=${d.energy.potential} but ½mv²=${d.energy.kinetic}`
);
```

Return `true` to pass or a string that explains the violation. The string is
included in the failure report.

Built in and reusable: `noTemplateArtifacts`, `finiteNumbers`, `magnitudeBand`,
`noAnswerLeak`. That last one comes from a real defect — a summary table rendered
beside a question displayed the exact intermediate the student was asked to derive.

### 3. Snapshot baselines

Pin the generated surface to a committed file. Drift fails the build. Re-approving
is a **separate, deliberate command**:

```bash
node examples/physics/baseline.js            # check — fails on drift
node examples/physics/baseline.js --update   # re-approve, and review the diff
```

Generated samples are stored in a committed baseline. Any drift fails the check;
updating the baseline is an explicit command whose diff can be reviewed.

Baselines normalize floating-point values to 12 significant digits and sort
keys. The [CI matrix](.github/workflows/ci.yml) verifies identical output across
three operating systems and three Node versions.

---

## Limits and review

These checks cover conditions that can be expressed deterministically. They do
not judge pedagogy, ambiguity, or whether a physically valid prompt is useful.
In PhabPhysics, a different model independently re-derives LLM-authored physics
content, and a human approves changes that affect correctness. The process is
described in the
[PhabPhysics case study](https://github.com/ahreinhardt/phabphysics#llm-assisted-development).

---

## API

| Export | Purpose |
|---|---|
| `sweep(spec)` / `sweepAll(specs)` | Run a generator N times, apply checks, collect reproducible failures |
| `formatReport(result)` | Readable output; reports truncation honestly |
| `rngFor(seed)` | Seeded PRNG — `float`, `int`, `pick`, `bool` |
| `check(name, assert)` | Define a check; `assert` throws on failure |
| `invariant(name, test)` | Domain assertion; returns `true` or an explanatory string |
| `noTemplateArtifacts()` | `undefined` / `NaN` / `[object Object]` / `{{…}}` in any string |
| `finiteNumbers()` | No `NaN`, no `Infinity` |
| `magnitudeBand({min,max,only})` | Plausible magnitudes; `only` filters by path |
| `noAnswerLeak({answer,prompt})` | The answer must not appear in pre-solve text |
| `sample` / `compareBaseline` / `writeBaseline` | Snapshot baselines |
| `walk(value)` | Every leaf with its path — build your own checks on this |

**Requirements:** Node ≥ 20. The package has no runtime or development
dependencies.

## Repository

```
src/         random.js · checks.js · sweep.js · snapshot.js · index.js
examples/    physics/ — 4 generators (1 clean, 3 realistically broken) + demo + baseline
test/        27 tests, node:test
```

Start with [`examples/physics/gates.js`](examples/physics/gates.js) — it's the
shortest thing in the repo that shows the whole idea.

## Licence

MIT — Alex Reinhardt
