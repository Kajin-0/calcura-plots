# Calcura Plots

Standalone `function-plot` integration lab for evaluating arbitrary function graphing before any Calcura integration.

## Phase 2

The repo now runs a browser-level capability audit against `function-plot@1.25.4`.

Current stack:

- Vite + React + TypeScript
- `function-plot@1.25.4`
- Playwright + Chromium regression tests
- responsive `FunctionGraph` wrapper
- direct function-plot expression input
- explicit x/y viewport controls
- pan and zoom enabled
- smooth, domain-restricted, asymptotic, removable-discontinuity, and oscillatory presets
- GitHub Actions typecheck, production build, and browser audit

No Calcura code is imported or modified.

## Run locally

You do not need to install anything merely to inspect the repository. To run the lab locally:

```bash
npm install
npx playwright install chromium
npm run dev
```

Production validation:

```bash
npm run typecheck
npm run build
npm run test:e2e
```

## What Phase 2 tests

The browser audit verifies:

- ordinary smooth functions render
- `1/x` is split across its vertical asymptote
- `1/(x-2)` is split across its vertical asymptote
- `tan(x)` produces multiple disconnected SVG paths
- `sqrt(x)` handles its restricted real domain without throwing
- invalid expressions surface an error and recover
- invalid viewports are rejected and recover
- responsive resizing rebuilds the SVG
- mouse-wheel zoom changes the plotted geometry
- drag-to-pan changes the plotted geometry
- a 390 px mobile viewport does not overflow
- removable-hole behavior is explicitly characterized
- `sin(1/x)` behavior at the origin is explicitly characterized

### Important capability boundary

A removable discontinuity such as:

```text
(x^2 - 1) / (x - 1)
```

is mathematically different from the simplified line `x + 1`: the original expression is undefined at `x = 1`.

The Phase 2 audit therefore does **not** assume that a visually continuous curve is correct. It records whether `function-plot` emits an explicit hole marker. If it does not, that is treated as a known backend limitation to solve in a later wrapper/evaluator phase rather than silently simplifying the original domain away.

## Current expression boundary

The lab still lets `function-plot` parse expressions directly:

```text
sin(x)
1 / x
sqrt(x)
(x^2 - 1) / (x - 1)
```

Calcura-style LaTeX parsing, AST validation, evaluator ownership, and the permanent Calcura-facing graph contract remain later phases.

## CI

Every push to `main` runs:

1. dependency installation
2. TypeScript typecheck
3. production Vite build
4. Chromium installation
5. Playwright Phase 2 audit

Failure reports and traces are retained as a short-lived GitHub Actions artifact.
