import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCalcuraGraphFunction,
  createCalcuraGraphFunctions,
} from '../../src/graph/calcuraAdapter'

test('Calcura adapter preserves serialized LaTeX and forces latex input format', () => {
  const definition = createCalcuraGraphFunction({
    id: 'integrand',
    latex: '\\frac{\\sin(x)}{x}',
    domain: [-4, 4],
    exclusions: [{ x: 0, y: 1 }],
    color: '#6f5ee8',
  })

  assert.deepEqual(definition, {
    id: 'integrand',
    expression: '\\frac{\\sin(x)}{x}',
    inputFormat: 'latex',
    variable: undefined,
    domain: [-4, 4],
    exclusions: [{ x: 0, y: 1 }],
    color: '#6f5ee8',
  })
})

test('Calcura adapter clones mutable domain and exclusion arrays', () => {
  const domain: [number, number] = [-2, 2]
  const exclusions = [{ x: 0, y: 1 }]

  const definition = createCalcuraGraphFunction({
    id: 'f',
    latex: 'x',
    domain,
    exclusions,
  })

  domain[0] = -100
  exclusions[0].x = 99

  assert.deepEqual(definition.domain, [-2, 2])
  assert.deepEqual(definition.exclusions, [{ x: 0, y: 1 }])
})

test('multiple Calcura functions map to independent graph definitions', () => {
  const definitions = createCalcuraGraphFunctions([
    { id: 'f', latex: '\\sin(x)' },
    { id: 'g', latex: '\\cos(x)' },
  ])

  assert.equal(definitions.length, 2)
  assert.equal(definitions[0].inputFormat, 'latex')
  assert.equal(definitions[1].inputFormat, 'latex')
  assert.equal(definitions[0].id, 'f')
  assert.equal(definitions[1].id, 'g')
})
