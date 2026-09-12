import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampGraphSampleToYDomain,
  clipGraphSampleToYDomain,
  graphDropClipKeepsUniformSample,
  resolvePlotYDomain,
  VIEWPORT_Y_CLIP_PAD_RATIO,
} from '../../src/graph/sampleClip'

test('keeps samples inside the padded y-domain', () => {
  assert.equal(clipGraphSampleToYDomain(-5, -10, 10), -5)
  assert.equal(clipGraphSampleToYDomain(10, -10, 10), 10)
  assert.equal(
    clipGraphSampleToYDomain(-10 - 20 * VIEWPORT_Y_CLIP_PAD_RATIO, -10, 10),
    -10 - 20 * VIEWPORT_Y_CLIP_PAD_RATIO,
  )
})

test('drops samples that would become huge SVG coordinates', () => {
  assert.ok(Number.isNaN(clipGraphSampleToYDomain(-1e8, -10, 10)))
  assert.ok(Number.isNaN(clipGraphSampleToYDomain(1e8, -10, 10)))
  assert.ok(Number.isNaN(clipGraphSampleToYDomain(-50, -1, 0)))
})

test('drops non-finite evaluator output', () => {
  assert.ok(Number.isNaN(clipGraphSampleToYDomain(Number.NaN, -10, 10)))
  assert.ok(Number.isNaN(clipGraphSampleToYDomain(Number.POSITIVE_INFINITY, -10, 10)))
})

test('clamps steep finite samples onto the padded y-edge', () => {
  assert.equal(clampGraphSampleToYDomain(-1e8, -10, 10), -30)
  assert.equal(clampGraphSampleToYDomain(1e8, -10, 10), 30)
  assert.equal(clampGraphSampleToYDomain(4, -10, 10), 4)
  assert.ok(Number.isNaN(clampGraphSampleToYDomain(Number.NaN, -10, 10)))
})

test('drop-clip misses a steep u-sub integrand on a coarse uniform grid', () => {
  const steep = (x: number) => 2 * x * (x * x + 6) ** 4
  assert.equal(
    graphDropClipKeepsUniformSample(steep, -10, 10, -10, 10, 64),
    false,
  )
  assert.equal(clipGraphSampleToYDomain(steep(0), -10, 10), 0)
  assert.equal(clampGraphSampleToYDomain(steep(-10), -10, 10), -30)
})

test('drop-clip keeps ordinary trig samples on the same grid', () => {
  assert.equal(
    graphDropClipKeepsUniformSample(Math.sin, -10, 10, -10, 10, 64),
    true,
  )
})
