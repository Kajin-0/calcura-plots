import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compileGraphFunction,
  compileGraphFunctions,
  GraphExpressionError,
} from '../../src/graph/expressionAdapter'

test('compiles and evaluates approved real expressions', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 'x^2 + sin(x) + pi - e',
  })

  const x = 1.25
  const expected = x ** 2 + Math.sin(x) + Math.PI - Math.E
  assert.ok(Math.abs(compiled.evaluate(x) - expected) < 1e-12)
})

test('supports an alternate validated variable name', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 't^2 + 1',
    variable: 't',
  })

  assert.equal(compiled.evaluate(3), 10)
})

test('enforces explicit graph domains', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 'sqrt(x)',
    domain: [0, 4],
  })

  assert.ok(Number.isNaN(compiled.evaluate(-1)))
  assert.equal(compiled.evaluate(4), 2)
  assert.ok(Number.isNaN(compiled.evaluate(5)))
})

test('enforces explicit excluded points and preserves semantic marker y', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: '(x^2 - 1) / (x - 1)',
    exclusions: [{ x: 1, y: 2 }],
  })

  assert.ok(Number.isNaN(compiled.evaluate(1)))
  assert.equal(compiled.resolvedExclusions[0].y, 2)
  assert.ok(Math.abs(compiled.evaluate(1.1) - 2.1) < 1e-12)
})

test('derives exclusion y when the original expression is defined there', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 'x^2',
    exclusions: [{ x: 2 }],
  })

  assert.equal(compiled.resolvedExclusions[0].y, 4)
  assert.ok(Number.isNaN(compiled.evaluate(2)))
})

test('converts complex and non-finite evaluations to NaN', () => {
  const sqrt = compileGraphFunction({
    id: 'sqrt',
    expression: 'sqrt(x)',
  })
  const reciprocal = compileGraphFunction({
    id: 'reciprocal',
    expression: '1/x',
  })

  assert.ok(Number.isNaN(sqrt.evaluate(-1)))
  assert.ok(Number.isNaN(reciprocal.evaluate(0)))
})

test('rejects assignments', () => {
  assert.throws(
    () => compileGraphFunction({ id: 'f', expression: 'x = 4' }),
    GraphExpressionError,
  )
})

test('rejects function definitions', () => {
  assert.throws(
    () => compileGraphFunction({ id: 'f', expression: 'f(x) = x^2' }),
    GraphExpressionError,
  )
})

test('rejects unknown symbols', () => {
  assert.throws(
    () => compileGraphFunction({ id: 'f', expression: 'x + y' }),
    /Symbol "y" is not allowed/,
  )
})

test('rejects non-whitelisted functions', () => {
  assert.throws(
    () => compileGraphFunction({ id: 'f', expression: 'random()' }),
    /Function "random" is not allowed/,
  )
})

test('rejects arrays and accessors', () => {
  assert.throws(
    () => compileGraphFunction({ id: 'f', expression: '[1, 2][1]' }),
    GraphExpressionError,
  )
})

test('rejects invalid domains and duplicate exclusions', () => {
  assert.throws(
    () =>
      compileGraphFunction({
        id: 'f',
        expression: 'x',
        domain: [4, 4],
      }),
    /domain/,
  )

  assert.throws(
    () =>
      compileGraphFunction({
        id: 'f',
        expression: 'x',
        exclusions: [{ x: 1 }, { x: 1 }],
      }),
    /Duplicate excluded x-value/,
  )
})

test('rejects duplicate graph function ids', () => {
  assert.throws(
    () =>
      compileGraphFunctions([
        { id: 'f', expression: 'x' },
        { id: 'f', expression: 'x^2' },
      ]),
    /Duplicate graph function id/,
  )
})
