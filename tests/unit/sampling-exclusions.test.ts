import assert from 'node:assert/strict'
import test from 'node:test'
import { createGraphSampler } from '../../src/graph/graphSampler'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'

test('tiny-residue poles, repeated poles and trig poles cannot hide between probes', () => {
  const pole = .0137
  for (const expression of ['1e-8/(x-0.0137)', '1e-8/(x-0.0137)^2', '(x+2)/(x-0.0137)', '1e-8/tan(x-0.0137)', '1e-8*(x-0.0137)^(-2)']) {
    const fn = createGraphSampler({ id: 'pole', expression })
    const segments = fn.sample({ x: [-2, 2], y: [-10, 10] }, 330, 300)
    assert.ok(segments.length >= 2, expression)
    assert.ok(segments.every(points => !points.some(p => p[0] < pole) || !points.some(p => p[0] > pole)), expression)
  }
})

test('quadratic/factored denominator roots and scaled trig poles partition sampling', () => {
  for (const expression of ['1/(x^2-1)', '1/((x-1)*(x+1))', '1/(x-1)^4']) {
    const fn = compileGraphFunction({ id: 'rational', expression })
    assert.ok(fn.samplingExclusions(-2, 2).includes(1), expression)
  }
  const fn = compileGraphFunction({ id: 'tan', expression: 'tan(3*x+0.2)' })
  assert.ok(fn.samplingExclusions(-10, 10).length >= 19)
})

test('zero powers do not manufacture holes; finite crossings and original exclusions survive', () => {
  const fn = compileGraphFunction({ id: 'finite', expression: '1/(x^0)' })
  assert.deepEqual(fn.samplingExclusions(-2, 2), [])
  for (const expression of ['2x(x^2+6)^4', '3x((x^2+3))^2']) {
    const fn = createGraphSampler({ id: 'finite', expression })
    const explicit = createGraphSampler({ id: 'control', expression: expression.startsWith('2') ? '2*x*(x^2+6)^4' : '3*x*((x^2+3))^2' })
    for (const x of [-2, -1, 0, 1, 2]) assert.equal(fn.evaluate(x), explicit.evaluate(x))
  }
  const hole = createGraphSampler({ id: 'hole', expression: '(x^2-1)/(x-1)', exclusions: [{ x: 1, y: 2 }] })
  assert.ok(hole.sample({ x: [-2, 2], y: [-3, 3] }).every(points => !points.some(p => p[0] < 1) || !points.some(p => p[0] > 1)))
  const endpoint = createGraphSampler({ id: 'endpoint', expression: 'x', domainEndpoints: [{ x: 1, y: 1, included: false }] })
  assert.ok(endpoint.sample({ x: [-2, 2], y: [-3, 3] }).every(points => !points.some(p => p[0] < 1) || !points.some(p => p[0] > 1)))
})

test('flat probes cannot bridge unpartitioned cubic or nonlinear trigonometric poles', () => {
  for (const [expression, pole] of [
    ['1e-8/(x^3-0.0137)', Math.cbrt(.0137)],
    ['1e-8/(sin(x^2)-0.0137)', Math.sqrt(Math.asin(.0137))],
  ] as const) {
    const sampler = createGraphSampler({ id: 'unpartitioned', expression })
    const segments = sampler.sample({ x: [-2, 2], y: [-10, 10] }, 330, 300)
    assert.ok(segments.length >= 2, expression)
    assert.ok(segments.every(p => !p.some(v => v[0] < pole) || !p.some(v => v[0] > pole)), expression)
    const ys = segments.flat().map(p => p[1])
    assert.ok(Math.max(...ys) > 9 && Math.min(...ys) < -9, 'both tall visible branches must survive')
  }
  // A positive variable-power denominator is continuous, not an invented gap.
  const positive = createGraphSampler({ id: 'positive', expression: '1/(x^x)' })
  const segments = positive.sample({ x: [.1, 2], y: [0, 2] }, 330, 300)
  assert.equal(segments.length, 1)
})
