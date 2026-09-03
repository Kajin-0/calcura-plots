import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clipGraphSampleToYDomain,
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

test('prefers a live y-axis domain after pan or zoom', () => {
  assert.deepEqual(resolvePlotYDomain([-1, 0], [-10, 10]), [-1, 0])
  assert.deepEqual(resolvePlotYDomain(undefined, [-10, 10]), [-10, 10])
  assert.deepEqual(resolvePlotYDomain([5, 5], [-10, 10]), [-10, 10])
})
