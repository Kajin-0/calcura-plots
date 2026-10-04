import assert from 'node:assert/strict'
import test from 'node:test'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'

test('certified interval enclosures contain dense numeric values; unknown ranges never authorize culling', () => {
  const expressions = ['x', 'x^2', 'x^3', '2*x*(x^2+6)^4', 'abs(x)', 'sqrt(x)', 'sin(30x)', 'cos(x)', 'tan(3x+.2)', 'sec(x)', 'csc(x)', 'cot(x)', 'log(x)', 'asin(x)', 'acos(x)', 'atan(x)', 'sinh(x)', 'cosh(x)', 'sech(x)', 'tanh(x)', 'csch(x)', 'coth(x)', 'exp(x)', 'x*exp(x)', '1/(x-.0137)', '1e8*(x-.017931)^2-5']
  let enclosures = 0, values = 0
  for (const expression of expressions) {
    const fn = compileGraphFunction({ id: expression, expression })
    for (let i = 0; i < 240; i++) {
      const lo = -6 + i * .05, hi = lo + .06
      const range = fn.range(lo, hi)
      if (!range) continue
      enclosures++
      for (let n = 0; n <= 32; n++) {
        const y = fn.evaluate(lo + (hi - lo) * n / 32)
        assert.ok(Number.isFinite(y), `${expression}: nonfinite inside certified interval ${lo},${hi}`)
        assert.ok(y >= range[0] - 1e-10 * Math.max(1, Math.abs(y)) && y <= range[1] + 1e-10 * Math.max(1, Math.abs(y)), `${expression}: ${y} outside ${range}`)
        values++
      }
    }
  }
  console.log(JSON.stringify({ audit: 'interval-enclosures', expressions: expressions.length, enclosures, values }))
  assert.ok(enclosures > 4000)
})

test('a reciprocal can certify both offscreen branches without bridging its pole', () => {
  const fn = compileGraphFunction({ id: 'poles', expression: '1/(cos(5*x)*cos(10*x))' })
  assert.equal(fn.range.outside?.(Math.PI / 20 - 1e-5, Math.PI / 20 + 1e-5, -30, 30), true)
  assert.equal(fn.range.outside?.(0, .01, -30, 30), false)
  const cancellation = compileGraphFunction({ id: 'not-cullable', expression: 'x/x' })
  assert.equal(cancellation.range.outside?.(-1e-5, 1e-5, -30, 30), false)
})
