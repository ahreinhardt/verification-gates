# verification-gates

**Deterministic verification for content you didn't write by hand.**
Property sweeps, domain invariants, and snapshot baselines. Zero runtime dependencies.

```bash
git clone https://github.com/ahreinhardt/verification-gates && cd verification-gates
npm run verify        # tests + baseline + the worked example. No install step.
```

---

## The problem

When content is generated — randomized per user, or authored by a language model,
or both — there is no fixed answer key to diff against. The thing under test is
not the output, it's the **generator**. And the failure modes are the ones that
survive every tool you already have:

| Failure | Types | Lint | Unit test on one sample |
|---|:--:|:--:|:--:|
| `undefined` interpolated into user-facing text | ✗ | ✗ | ✗ |
| A velocity of `4.2e17 m/s` — finite, formatted, absurd | ✗ | ✗ | ✗ |
| Degrees passed where radians are required | ✗ | ✗ | sometimes |
| The answer displayed beside the question | ✗ | ✗ | ✗ |
| A model quietly rewriting an answer that was already verified | ✗ | ✗ | ✗ |

Every one of these ships happily. This library is the set of gates that stop them.

It was extracted from [PhabPhysics](https://github.com/ahreinhardt/phabphysics), a
live AP Physics platform where the content is LLM-authored and randomized per
student, and a wrong answer is a production incident with a real teenager on the
other end.

---

## What it looks like when it works

`npm run demo` runs the gates against four example generators. Three carry bugs
drawn from real production defects; each produces output that is finite,
well-formatted, and entirely plausible to a human reading one sample.

```
verification-gates — example sweep (200 draws per generator)

  ok    freeFall  (200 draws)
  FAIL  pendulumSpeed  (10+ failing draws in the first 47, stopped early)
          [invariant:energyConservation] energy not conserved: mgh=0.2605 but ½mv²=31.5401
          reproduce: seed 1
  FAIL  projectileRange  (10+ failing draws in the first 21, stopped early)
          [noTemplateArtifacts] template artifact "undefined" at $.prompt:
              "A ball leaves the ground at 30.07 m/s across undefined. Find its horizontal range."
          reproduce: seed 5
  FAIL  collisionMomentum  (10+ failing draws in the first 10, stopped early)
          [noAnswerLeak] answer "1.06" leaks into $.table[2][2]: "1.06"
          reproduce: seed 1
```

Note `reproduce: seed N`. Every draw gets its own seed, so any failure re-runs
from one integer. **A failure you cannot re-run is a rumour, not a bug report** —
that property has its own test in [`test/sweep.test.js`](test/sweep.test.js).

---

## Three pillars

### 1. Property sweeps — because one sample proves nothing

Assert what must hold for *every* draw, then take many draws.

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

The `pendulumSpeed` bug above is a degrees/radians slip that violates energy
conservation on *most* draws but not all. A single spot-check had roughly even
odds of shipping it.

### 2. Domain invariants — the layer no static check can reach

Some things are only wrong if you know the domain.

```js
const energyConservation = invariant('energyConservation', (d) =>
  closeTo(d.energy.potential, d.energy.kinetic, 1e-3) ||
  `energy not conserved: mgh=${d.energy.potential} but ½mv²=${d.energy.kinetic}`
);
```

Return `true` to pass, or a **string explaining the violation** — because the
message is what someone reads at 7am, and "invariant failed" doesn't help them.

Built in and reusable: `noTemplateArtifacts`, `finiteNumbers`, `magnitudeBand`,
`noAnswerLeak`. That last one comes from a real defect — a summary table rendered
beside a question displayed the exact intermediate the student was asked to derive.

### 3. Snapshot baselines — so a model can't quietly rewrite what was verified

Pin the generated surface to a committed file. Drift fails the build. Re-approving
is a **separate, deliberate command**:

```bash
node examples/physics/baseline.js            # check — fails on drift
node examples/physics/baseline.js --update   # re-approve, and review the diff
```

This is what makes it safe to let a fleet of agents rewrite a body of content.
They can change anything they like; they cannot silently change something already
verified without a human approving the diff.

Baselines normalize float noise to 12 significant digits and sort keys, so they
are byte-identical across OS and Node version — [CI proves that](.github/workflows/ci.yml)
on a 3×3 matrix, because a baseline that fails on the last bit of a double is a
baseline nobody trusts.

---

## Where the human and the models fit

These gates are deliberately dumb. They don't have opinions, they can't be
argued with, and they run on every push. That's the floor.

They also cannot see pedagogy, ambiguity, or a physically valid problem that is
simply a bad question. In the system this came from, that layer is handled by
**multi-model adversarial review** — the model that authors a thing never
certifies it, verifiers are prompted to refute rather than review, and every
claimed defect carries a written record of which refutation paths were tried and
failed. That process is described in the
[PhabPhysics case study](https://github.com/ahreinhardt/phabphysics#how-this-was-built-adversarial-multi-model-authoring).

The division of labour is the actual design:

> **Deterministic gates** catch what is *checkable*, on every push, without judgment.
> **Adversarial review** catches what needs *judgment*, and is never trusted like a gate.
> **A human** signs off on anything that touches correctness.

Neither layer substitutes for the other. Verification that is itself probabilistic
is not verification.

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

**Requirements:** Node ≥ 20. No dependencies, runtime or dev — a verification tool
that can break from a transitive update is not a gate.

## Repository

```
src/         random.js · checks.js · sweep.js · snapshot.js · index.js
examples/    physics/ — 4 generators (1 clean, 3 realistically broken) + demo + baseline
test/        20 tests, node:test
```

Start with [`examples/physics/gates.js`](examples/physics/gates.js) — it's the
shortest thing in the repo that shows the whole idea.

## Licence

MIT — Alex Reinhardt
