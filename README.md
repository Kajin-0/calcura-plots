# Calcura Plots

Standalone function-plot integration lab for evaluating arbitrary function graphing before any Calcura integration.

## Phase 1 scope

This phase intentionally stays small:

- Vite + React + TypeScript
- `function-plot@1.25.4`
- one responsive `FunctionGraph` wrapper
- direct function-plot expression input
- explicit x/y viewport controls
- pan and zoom enabled
- a small preset corpus including smooth, restricted-domain, asymptotic, removable-discontinuity, and oscillatory cases
- CI typecheck/build validation

No Calcura code is imported or modified.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Current boundary

Phase 1 deliberately lets function-plot parse expressions such as:

```text
sin(x)
1 / x
sqrt(x)
(x^2 - 1) / (x - 1)
```

That is temporary. Calcura-style LaTeX parsing, expression validation, evaluator ownership, pathological-function regression testing, and the permanent Calcura-facing graph contract are later phases.

## Next phase

Phase 2 should torture-test mathematical correctness and rendering behavior, especially:

- false connections across vertical asymptotes
- restricted domains
- removable discontinuities / holes
- high-frequency oscillation
- resize behavior
- touch pan / pinch zoom
- mobile WebView performance
