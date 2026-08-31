# Calcura Plots

Standalone graphing lab for validating an eventual Calcura function-graph feature without modifying Calcura.

## Current phase: Phase 3

The project now separates mathematical expression semantics from the rendering backend.

Stack:

- Vite + React + TypeScript
- `function-plot@1.25.4` for sampling/rendering/pan/zoom
- `mathjs@12.4.0` for Calcura-aligned parsing and numeric compilation
- a strict graph-expression AST whitelist
- explicit domain and excluded-point semantics
- semantic open-circle overlays for removable discontinuities
- Node unit tests
- Playwright Chromium browser regressions
- GitHub Actions validation

No Calcura source code is imported or modified.

## Architecture

```text
GraphFunctionDefinition
        ↓
Calcura-owned expression/domain adapter
        ↓
safe f(x) callback
        ↓
FunctionGraph
        ↓
function-plot

semantic exclusions ──────→ open-circle SVG overlay
```

`function-plot` no longer receives raw expression strings from the lab UI.

See:

- `docs/PHASE2_AUDIT.md`
- `docs/PHASE3_ARCHITECTURE.md`

## Run locally

Local installation is optional unless you want to run the lab yourself.

```bash
npm install
npx playwright install chromium
npm run dev
```

Validation:

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
```

GitHub Actions runs the validation automatically on every push to `main`.

## Current graph contract

```ts
interface GraphFunctionDefinition {
  id: string
  expression: string
  variable?: string
  domain?: [number, number]
  exclusions?: Array<{ x: number; y?: number }>
  color?: string
}
```

The permanent component boundary is:

```tsx
<FunctionGraph
  functions={definitions}
  viewport={{
    x: [-10, 10],
    y: [-10, 10],
  }}
/>
```

## Important boundary

This phase still accepts math-expression text such as:

```text
sin(x)
1 / x
sqrt(x)
(x^2 - 1) / (x - 1)
```

Calcura LaTeX-to-graph adaptation is intentionally not coupled into this standalone repository yet. The renderer also remains independent of Calcura's grading/equivalence machinery.
