// Reusable assertions applied to every draw of a sweep.
//
// A check receives the generated value and throws on failure. Failure messages
// include the offending path and value.

/** Define a check. `assert` throws on failure. */
export function check(name, assert) {
  return { name, assert };
}

/** Walk every leaf of a value, yielding [path, leaf]. */
export function* walk(value, path = '$') {
  if (value === null || typeof value !== 'object') {
    yield [path, value];
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walk(value[i], `${path}[${i}]`);
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* walk(v, `${path}.${k}`);
}

const ARTIFACT = /\b(undefined|NaN|Infinity|null)\b|\[object Object\]|\{\{|\}\}/;

/**
 * No template artifacts in any string. Broken interpolation commonly appears as
 * `undefined`, `NaN`, or `[object Object]` in user-facing text.
 */
export function noTemplateArtifacts({ only } = {}) {
  return check('noTemplateArtifacts', (draw) => {
    for (const [path, leaf] of walk(draw)) {
      if (typeof leaf !== 'string') continue;
      if (only && !only.test(path)) continue;
      const m = ARTIFACT.exec(leaf);
      if (m) throw new Error(`template artifact ${JSON.stringify(m[0])} at ${path}: ${JSON.stringify(leaf.slice(0, 120))}`);
    }
  });
}

/** Every number is finite — no NaN, no Infinity, no silent division by zero. */
export function finiteNumbers({ only } = {}) {
  return check('finiteNumbers', (draw) => {
    for (const [path, leaf] of walk(draw)) {
      if (typeof leaf !== 'number') continue;
      if (only && !only.test(path)) continue;
      if (!Number.isFinite(leaf)) throw new Error(`non-finite number at ${path}: ${leaf}`);
    }
  });
}

/**
 * Numbers land in a plausible magnitude band. Catches unit errors and runaway
 * arithmetic that remain finite and pass type checks.
 */
export function magnitudeBand({ min = 1e-6, max = 1e9, only, allowZero = true } = {}) {
  return check('magnitudeBand', (draw) => {
    for (const [path, leaf] of walk(draw)) {
      if (typeof leaf !== 'number' || !Number.isFinite(leaf)) continue;
      if (only && !only.test(path)) continue;
      const a = Math.abs(leaf);
      if (a === 0) {
        if (allowZero) continue;
        throw new Error(`zero not allowed at ${path}`);
      }
      if (a < min || a > max) throw new Error(`magnitude out of band at ${path}: ${leaf} (expected ${min}..${max})`);
    }
  });
}

/**
 * The answer must not appear verbatim in the text the user sees before solving.
 * Derived from a real production defect: a table rendered alongside the prompt
 * displayed the exact intermediate the student was being asked to compute.
 */
export function noAnswerLeak({ answer, prompt, format = (v) => String(v) }) {
  return check('noAnswerLeak', (draw) => {
    const a = answer(draw);
    if (a === undefined || a === null) return;
    const needle = format(a).trim();
    if (!needle || needle.length < 2) return;
    for (const [path, text] of prompt(draw)) {
      if (typeof text === 'string' && text.includes(needle)) {
        throw new Error(`answer ${JSON.stringify(needle)} leaks into ${path}: ${JSON.stringify(text.slice(0, 120))}`);
      }
    }
  });
}

/**
 * A domain invariant — the thing no static check can see. `test` returns true,
 * or a string explaining the violation.
 */
export function invariant(name, test) {
  return check(`invariant:${name}`, (draw) => {
    const r = test(draw);
    if (r === true || r === undefined) return;
    throw new Error(typeof r === 'string' ? r : `invariant "${name}" violated`);
  });
}

/** Helper: relative-tolerance comparison for physical quantities. */
export function closeTo(a, b, tol = 1e-6) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / scale <= tol;
}
