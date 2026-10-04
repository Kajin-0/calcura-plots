import assert from 'node:assert/strict'
import test from 'node:test'
import { create, all } from 'mathjs'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'

const math = create(all)
const expressions = [
  'x', 'x^2', 'x^3', '2*x*(x^2+6)^4', '3*x*((x^2+3))^2',
  '(x+1)*(x-2)/(x^2+1)', '(x^2)^3', 'x^(1/3)', 'abs(x^(1/3))',
  'abs(x)', 'sqrt(x)', 'sqrt(x^2)', 'abs(sqrt(x))', 'sqrt(x)*sqrt(x)',
  'nthRoot(x,3)', 'nthRoot(x,-3)', 'nthRoot(x,2)', 'nthRoot(x,2.5)',
  'exp(x)', 'log(x)', 'log(x,2)', 'log10(x)', 'abs(log(x))',
  'sin(x)', 'cos(x)', 'tan(x)', 'sec(x)', 'csc(x)', 'cot(x)',
  'asin(x)', 'acos(x)', 'atan(x)', 'sin(asin(x))', 'cos(acos(x))',
  'sinh(x)', 'cosh(x)', 'tanh(x)', 'sech(x)', 'csch(x)', 'coth(x)',
  'asinh(x)', 'acosh(x)', 'atanh(x)', 'abs(acosh(x))',
  'sin(sqrt(abs(x)))', 'atan(abs(2x))', 'sin(30x)', 'sin(1/x)',
  'abs(sin(x))', 'e^(-x)*cos(pi*x)', '1/log(x)',
  'round(x)', 'round(x,2)', 'round(x,-1)', 'round(x,1.5)', 'floor(x)', 'ceil(x)', 'sign(x)',
  '(sqrt(x))^2', '(x^(1/2))^2', 'log(x)-log(x)',
]

test('validated graph evaluator agrees with mathjs, including real results of complex intermediates', () => {
  const failures: string[] = []
  let evaluations = 0
  let maxRelativeError = 0
  const xs = new Set<number>([0, -0, -1, 1, -0.5, 0.5, -2.5, 2.5, Math.PI / 2, Math.PI, 1e-12, -1e-12])
  for (const span of [1, 10, 100]) for (let i = 0; i <= 512; i++) xs.add(-span + 2 * span * i / 512)
  for (const boundary of [-1, 0, 1, Math.PI / 2, Math.PI]) {
    for (const epsilon of [1e-3, 1e-7, 1e-12]) xs.add(boundary + epsilon).add(boundary - epsilon)
  }
  for (const expression of expressions) {
    const actual = compileGraphFunction({ id: 'differential', expression }).evaluate
    // Use the same normalized validated expression, not a separate LaTeX parser.
    const compiled = math.compile(compileGraphFunction({ id: 'reference', expression }).normalizedExpression)
    for (const x of xs) {
      let expected = NaN
      try {
        const value = compiled.evaluate({ x })
        if (typeof value === 'number' && Number.isFinite(value)) expected = value
      } catch { /* same failure contract */ }
      const value = actual(x)
      evaluations++
      if (Number.isFinite(value) !== Number.isFinite(expected)) {
        if (!failures.some(f => f.startsWith(`${expression} at `))) failures.push(`${expression} at ${x}: ${value} vs ${expected}`)
      } else if (Number.isFinite(expected)) {
        const error = Math.abs(value - expected) / Math.max(1, Math.abs(expected))
        maxRelativeError = Math.max(maxRelativeError, error)
        if (error > 1e-10 && !failures.some(f => f.startsWith(`${expression} at `))) failures.push(`${expression} at ${x}: ${value} vs ${expected}`)
      }
    }
  }
  console.log(JSON.stringify({ audit: 'evaluator-differential', expressions: expressions.length, evaluations, maxRelativeError, failures }))
  assert.deepEqual(failures, [])
})
