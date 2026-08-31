# Calcura Plots

Standalone graphing lab for validating an eventual Calcura function-graph feature without modifying Calcura.

## Current phase: Phase 4

The project now accepts Calcura-style serialized LaTeX while keeping mathematical expression semantics and rendering isolated.

Stack:

- Vite + React + TypeScript
- `function-plot@1.25.4` for sampling/rendering/pan/zoom
- `mathjs@12.4.0` for Calcura-aligned parsing and numeric compilation
- Calcura-style LaTeX input normalization
- strict graph-expression AST whitelist
- explicit domain and excluded-point semantics
- semantic open-circle overlays for removable discontinuities
- Node unit/corpus tests
- Playwright Chromium browser regressions
- GitHub Actions validation

No Calcura source code is imported or modified.

## Architecture

```text
Calcura-style serialized LaTeX
        ↓
latexToGraphExpression
        ↓
strict mathjs AST validation
        ↓
safe real f(x) callback
        ↓
FunctionGraph
        ↓
function-plot

semantic exclusions ──────→ open-circle SVG overlay
```

See:

- `docs/PHASE2_AUDIT.md`
- `docs/PHASE3_ARCHITECTURE.md`
- `docs/PHASE4_INPUT_COMPATIBILITY.md`

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
type GraphInputFormat = 'mathjs' | 'latex'

interface GraphFunctionDefinition {
  id: string
  expression: string
  inputFormat?: GraphInputFormat
  variable?: string
  domain?: [number, number]
  exclusions?: Array<{ x: number; y?: number }>
  color?: string
}
```

An eventual Calcura call can pass its serialized Mathfield LaTeX directly:

```tsx
<FunctionGraph
  functions={[
    {
      id: 'f',
      expression: serializedLatex,
      inputFormat: 'latex',
    },
  ]}
  viewport={{
    x: [-10, 10],
    y: [-10, 10],
  }}
/>
```

The graph repository remains independent of Calcura's grading/equivalence machinery.
