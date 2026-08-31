# Phase 5: Integration Readiness

Date: 2026-08-31

## Objective

Freeze a small public graph API, prove multiple-curve behavior, and produce a reusable library artifact without moving any code into Calcura yet.

## Public package surface

The library entrypoint is:

```text
src/index.ts
```

It exports only:

- `FunctionGraph`;
- `FunctionGraphProps`;
- graph data/viewport types;
- `createCalcuraGraphFunction`;
- `createCalcuraGraphFunctions`.

Parsing/compiler internals, semantic-overlay internals, presets, and the lab application are not public API.

## Calcura-facing adapter

An eventual Calcura integration can remain very small:

```ts
const functions = createCalcuraGraphFunctions([
  {
    id: 'integrand',
    latex: serializeToLatex(mathfieldModel),
  },
])

return (
  <FunctionGraph
    functions={functions}
    viewport={{ x: [-10, 10], y: [-10, 10] }}
  />
)
```

Calcura supplies serialized LaTeX. The graph package owns graph normalization, validation, safe evaluation, rendering, and semantic exclusions.

The adapter clones domain/exclusion arrays so the graph contract does not retain mutable references to host state.

## Library build

```bash
npm run build:lib
npm run verify:lib
```

emits:

```text
dist-lib/
├── calcura-plots.js
├── calcura-plots.css
└── types/
    └── index.d.ts
```

React, `function-plot`, and `mathjs` remain external runtime dependencies. They are not bundled into `calcura-plots.js`.

This avoids:

- a second React runtime;
- a duplicate mathjs engine inside Calcura;
- hiding function-plot inside an opaque bundle.

## Styling boundary

Reusable graph CSS moved out of the lab's global stylesheet and is scoped under:

```css
.calcura-function-graph
```

The component exposes `className` for host-level styling.

Core colors are exposed through CSS custom properties:

```css
--calcura-plot-background
--calcura-plot-axis-text
--calcura-plot-error-border
--calcura-plot-error-background
--calcura-plot-error-text
```

This keeps the graph renderer independently styleable without importing Calcura's app-wide CSS.

## Multiple curves

The existing `functions: GraphFunctionDefinition[]` API is now browser-certified with two simultaneous functions.

The integration fixture combines:

- `sin(x)`;
- `(x^2-1)/(x-1)` with a semantic hole at `(1,2)`.

The browser test requires:

- both function-plot series to render;
- their explicit colors to remain distinct;
- the semantic hole to remain attached to the correct function id;
- pan/zoom behavior to remain intact.

## Public API certification

Phase 5 adds a compile-only consumer fixture:

```text
tests/type/public-api-consumer.tsx
```

It imports only from the package-style `src/index.ts` surface and constructs a two-function scene.

CI now verifies:

1. unit/corpus tests;
2. application typecheck;
3. public consumer typecheck;
4. demo build;
5. library build + declaration emission;
6. library artifact shape/size;
7. Chromium browser regressions.

## Still intentionally deferred

Phase 5 does not:

- modify Calcura;
- publish an npm package;
- replace Calcura's existing piecewise-linear pedagogical renderer;
- certify Android WebView;
- add polar/parametric/implicit graphs;
- infer removable discontinuities symbolically.

The next meaningful gate before Calcura integration is Android/Capacitor WebView validation or one deliberately narrow Calcura integration spike.
