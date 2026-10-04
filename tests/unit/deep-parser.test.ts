import assert from 'node:assert/strict'
import test from 'node:test'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'

test('nested roots, explicit nested absolute values and function compositions remain structural', () => {
  const cases: Array<[string, (x: number) => number]> = [
    ['\\sqrt{\\sqrt{x}}', x => Math.sqrt(Math.sqrt(x))],
    ['\\sin\\sqrt{\\sqrt{x}}', x => Math.sin(Math.sqrt(Math.sqrt(x)))],
    ['\\sin\\cos\\sqrt{x}', x => Math.sin(Math.cos(Math.sqrt(x)))],
    ['\\left|\\left|x\\right|-1\\right|', x => Math.abs(Math.abs(x) - 1)],
    ['\\arctan\\left|2x\\right|', x => Math.atan(Math.abs(2 * x))],
    ['xsin(x)', x => x * Math.sin(x)],
    ['\\sin^{2}(3x)', x => Math.sin(3 * x) ** 2],
    ['3x((x^2+3))^2', x => 3 * x * (x * x + 3) ** 2],
  ]
  for (const [expression, reference] of cases) {
    const fn = compileGraphFunction({ id: expression, expression, inputFormat: 'latex' })
    for (const x of [0, .1, 1, 2, 9]) assert.ok(Math.abs(fn.evaluate(x) - reference(x)) < 1e-10, expression)
  }
  for (const expression of ['\\left|x', 'x\\right|', 'x=2', '\\int x dx']) {
    assert.throws(() => compileGraphFunction({ id: expression, expression, inputFormat: 'latex' }), undefined, expression)
  }
})
