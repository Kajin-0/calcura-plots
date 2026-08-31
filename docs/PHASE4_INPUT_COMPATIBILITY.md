# Phase 4: Calcura Input Compatibility

Date: 2026-08-31

## Objective

Accept the same style of serialized LaTeX produced by Calcura's Mathfield while preserving the standalone graph repository's mathematical and security boundaries.

No Calcura source code is imported at runtime.

## Source compatibility target

The conversion grammar was derived from Calcura at:

```text
49c0b52f3941ce481e015d5faa413732d3bb5e63
```

Relevant Calcura sources:

```text
services/mathfield/serialize.ts
packages/calculus-equivalence/src/parsing/latexToMathJs.ts
packages/calculus-equivalence/src/normalization/harmlessGroupingBrackets.ts
packages/calculus-equivalence/src/normalization/latexConstantVariableSpacing.ts
```

The graph adapter intentionally reuses syntax conventions, not equivalence behavior.

## Updated contract

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

`mathjs` remains the backwards-compatible default. An eventual Calcura caller uses:

```ts
{
  id: 'f',
  expression: serializedMathfieldLatex,
  inputFormat: 'latex'
}
```

## Pipeline

```text
Calcura Mathfield
      |
serializeToLatex
      |
      v
GraphFunctionDefinition { inputFormat: 'latex' }
      |
      v
latexToGraphExpression
  - fractions
  - roots
  - trig/hyperbolic functions
  - inverse trig
  - function powers
  - absolute values
  - pi
  - e^(...)
  - implicit multiplication
  - left/right delimiters
      |
      v
mathjs AST whitelist
      |
      v
safe compiled real evaluator
      |
      v
function-plot
```

## Important semantic choice: indexed roots

Calcura's equivalence parser may represent an indexed root algebraically as a fractional power. The graph adapter instead converts:

```latex
\sqrt[3]{x}
```

to:

```text
nthRoot(x, 3)
```

This is deliberate. A real Cartesian graph of cube root must include the negative branch:

```text
x = -8 -> y = -2
```

where a principal complex fractional power would be inappropriate for this renderer.

## Explicitly excluded syntax

The graph-input grammar rejects:

- integrals and differentials;
- equations/assignments through the AST gate;
- summations/products/limits;
- inequality operators;
- arbitrary Greek constants/variables;
- arbitrary LaTeX commands;
- symbolic grading constructs.

These are outside `y=f(x)` Cartesian plotting.

## No symbolic simplification

The adapter does not simplify input.

For example:

```latex
\frac{x^2-1}{x-1}
```

is not rewritten to `x+1`. Domain exclusions remain caller-owned metadata so the original hole can be preserved.

## Regression strategy

Phase 4 adds a committed Calcura-style LaTeX corpus covering:

- fractions;
- trig function commands;
- pre/post function powers;
- implicit multiplication;
- ordinary and indexed radicals;
- ln/log;
- exponentials;
- pi;
- adjacent parenthesized factors;
- tall left/right delimiters;
- absolute values;
- inverse trig;
- hyperbolic functions.

The browser torture suite itself now uses LaTeX presets, so asymptote and discontinuity behavior is verified through the complete conversion path rather than only through unit tests.
