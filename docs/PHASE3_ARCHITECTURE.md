# Phase 3: Expression and Domain Adapter

Date: 2026-08-31

## Objective

Move mathematical expression ownership out of `function-plot` and into a small Calcura-compatible graph layer while keeping this repository fully standalone.

## Dependency alignment

The adapter pins:

```text
mathjs 12.4.0
```

which matches Calcura's current production dependency.

No Calcura source code is imported.

## Permanent boundary

```text
GraphFunctionDefinition
        |
        v
expressionAdapter
  - parse
  - AST whitelist
  - compile
  - real-number guard
  - domain guard
  - exclusion guard
        |
        v
safe numeric callback
        |
        v
FunctionGraph
        |
        +----> function-plot (sampling, axes, pan/zoom, SVG)
        |
        +----> semanticOverlay (holes/exclusions)
```

`function-plot` no longer receives user expression strings.

## Graph contract

```ts
interface GraphFunctionDefinition {
  id: string
  expression: string
  variable?: string
  domain?: [number, number]
  exclusions?: Array<{
    x: number
    y?: number
  }>
  color?: string
}
```

The public React boundary is:

```tsx
<FunctionGraph
  functions={definitions}
  viewport={{
    x: [-10, 10],
    y: [-10, 10]
  }}
/>
```

This supports multiple functions even though the current lab UI edits one function at a time.

## AST safety policy

Allowed expression constructs:

- numeric constants
- the declared graph variable
- constants `pi` and `e`
- parentheses
- arithmetic operators `+ - * / ^`
- a curated mathematical function whitelist

Rejected constructs include:

- assignments
- function definitions
- arrays
- accessors/indexing
- objects
- blocks
- arbitrary symbols
- arbitrary function calls
- comparison/relational operators
- units and other non-graph syntax

The compiled evaluator returns `NaN` for:

- non-finite x
- values outside an explicit domain
- explicitly excluded x-values
- complex-valued results
- infinities
- runtime evaluation failures

This is intentional because `function-plot`'s built-in sampler skips `NaN` while it considers JavaScript `Infinity` a valid number.

## Removable discontinuities

Phase 2 established that `function-plot@1.25.4` does not emit semantic hole markers by itself.

Phase 3 fixes that at the adapter boundary:

```ts
{
  id: 'f',
  expression: '(x^2 - 1) / (x - 1)',
  exclusions: [{ x: 1, y: 2 }]
}
```

The evaluator preserves the exclusion at `x = 1`, and `semanticOverlay.ts` renders the open circle at `(1, 2)`.

The `y` value is optional when the original expression is still finite at the excluded x-value. For a true removable `0/0` discontinuity, the semantic y-value must currently be supplied by the caller. Automatic limit/domain analysis is intentionally deferred.

## Explicit non-goals

Phase 3 does not:

- import Calcura's LaTeX parser;
- simplify expressions;
- infer all domain holes automatically;
- perform symbolic equivalence;
- grade answers;
- implement implicit, polar, or parametric plotting;
- certify Android WebView behavior.

Those remain separate concerns.
