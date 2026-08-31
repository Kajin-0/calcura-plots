# Calcura Plots

Standalone graphing lab and package-ready graph module for an eventual Calcura function-graph feature.

## Current phase: Phase 5

The project now has a deliberately small reusable public API, Calcura serialized-LaTeX adapter helpers, a standalone library build, and browser-certified multiple-curve rendering.

Stack:

- Vite + React + TypeScript
- `function-plot@1.25.4` for sampling/rendering/pan/zoom
- `mathjs@12.4.0` for Calcura-aligned parsing and numeric compilation
- Calcura-style LaTeX input normalization
- strict graph-expression AST whitelist
- explicit domain and excluded-point semantics
- semantic open-circle overlays for removable discontinuities
- multiple simultaneous curves
- Node unit/corpus tests
- compile-only public API consumer test
- Playwright Chromium browser regressions
- separate demo and library builds

No Calcura source code is imported or modified.

## Public API

```ts
import {
  FunctionGraph,
  createCalcuraGraphFunctions,
  type PlotViewport,
} from 'calcura-plots'
```

An eventual Calcura caller can do:

```tsx
const functions = createCalcuraGraphFunctions([
  {
    id: 'integrand',
    latex: serializedMathfieldLatex,
  },
])

<FunctionGraph
  functions={functions}
  viewport={{
    x: [-10, 10],
    y: [-10, 10],
  }}
/>
```

The public surface intentionally does not expose parser/compiler internals.

## Library artifact

```bash
npm run build:lib
npm run verify:lib
```

produces:

```text
dist-lib/
├── calcura-plots.js
├── calcura-plots.css
└── types/
    └── index.d.ts
```

React, `function-plot`, and `mathjs` stay external. The wrapper does not duplicate those runtimes in its output.

## Styling

Reusable graph styles are scoped under:

```css
.calcura-function-graph
```

and can be adjusted by host CSS custom properties such as:

```css
--calcura-plot-background
--calcura-plot-axis-text
--calcura-plot-error-background
```

The lab's application chrome is not part of the library build.

## Validation

```bash
npm install
npm run test:unit
npm run typecheck
npm run test:public-api
npm run build
npm run verify:lib
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the full sequence automatically.

See:

- `docs/PHASE2_AUDIT.md`
- `docs/PHASE3_ARCHITECTURE.md`
- `docs/PHASE4_INPUT_COMPATIBILITY.md`
- `docs/PHASE5_INTEGRATION_READINESS.md`
