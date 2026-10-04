import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampGraphSampleToYDomain,
  clipGraphSampleToYDomain,
  graphDropClipKeepsUniformSample,
  sampleGraphSegments,
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

test('adaptive segments preserve the steep finite interior crossing, not edge clamps', () => {
  for (const fn of [(x: number) => 2 * x * (x * x + 6) ** 4,
    (x: number) => 1e9 * (x - 0.017931)]) {
    const segments = sampleGraphSegments(fn, [-10, 10], [-10, 10])
    assert.ok(segments.length > 0)
    assert.ok(segments.some(points => points.some(p => p[1] < -10) && points.some(p => p[1] > 10)))
    assert.ok(segments.flat().every(p => p.every(Number.isFinite) && Math.abs(p[1]) <= 30))
  }
})

test('reciprocal poles not aligned to sampling grid are never bridged', () => {
  for (const pole of [0, 0.0137, 2]) {
    const segments = sampleGraphSegments(x => 1 / (x - pole), [-10, 10], [-10, 10])
    assert.ok(segments.length >= 2)
    assert.ok(segments.every(points => !points.some(p => p[0] < pole) || !points.some(p => p[0] > pole)))
  }
})

test('tangent and cotangent branches never cross their poles', () => {
  for (const [fn, poles] of [
    [Math.tan, [-3 * Math.PI / 2, -Math.PI / 2, Math.PI / 2, 3 * Math.PI / 2]],
    [(x: number) => 1 / Math.tan(x), [-Math.PI, 0, Math.PI]],
  ] as const) {
    const segments = sampleGraphSegments(fn, [-6, 6], [-10, 10])
    assert.ok(segments.length >= 4)
    for (const pole of poles) assert.ok(segments.every(points =>
      !points.some(p => p[0] < pole) || !points.some(p => p[0] > pole)))
  }
})

test('explicit exclusions and nonfinite intervals are gaps', () => {
  const segments = sampleGraphSegments(x => x + 1, [-2, 2], [-3, 3], 800, 400, [0.0137])
  assert.equal(segments.length, 2)
  assert.ok(segments.every(points => points.every(p => p[0] !== 0.0137)))
  assert.deepEqual(sampleGraphSegments(() => Infinity, [-1, 1], [-1, 1]), [])
  assert.deepEqual(sampleGraphSegments(() => 1e8, [-1, 1], [-1, 1]), [])
})

test('x^2 sin(3x) stays one connected curve when the viewport can hold it', () => {
  const fn = (x: number) => x * x * Math.sin(3 * x)
  const segments = sampleGraphSegments(fn, [-10, 10], [-120, 120], 800, 400)
  assert.equal(segments.length, 1)
  const points = segments[0]
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i][0] > points[i - 1][0])
    assert.ok(points[i][0] - points[i - 1][0] < 0.2)
  }
})

test('x^2 sin(3x) does not drop samples that sit inside the default window', () => {
  const fn = (x: number) => x * x * Math.sin(3 * x)
  const segments = sampleGraphSegments(fn, [-10, 10], [-10, 10], 800, 400)
  const pixel = 20 / 800
  for (let i = 0; i <= 200; i++) {
    const x = -10 + (20 * i) / 200
    const y = fn(x)
    if (Math.abs(y) > 10) continue
    const covered = segments.some((points) => points.some((point) =>
      Math.abs(point[0] - x) <= pixel * 3 && Math.abs(point[1] - y) < 1.5))
    assert.ok(covered, `missing in-range sample at x=${x}`)
  }
})

test('ordinary functions preserve finite viewport geometry and sampling is bounded', () => {
  for (const fn of [(x: number) => x, (x: number) => x * x, (x: number) => x ** 3, Math.sin]) {
    assert.ok(sampleGraphSegments(fn, [-2, 2], [-3, 3]).length > 0)
  }
  let calls = 0
  const segments = sampleGraphSegments(x => { calls++; return Math.sin(1 / (x - 0.0137)) }, [-2, 2], [-2, 2], 800, 400, [0.0137])
  assert.ok(calls <= 32_768)
  assert.ok(segments.some(points => points.some(point => point[0] < -1)))
  assert.ok(segments.some(points => points.some(point => point[0] > 1)))
  assert.ok(segments.every(points => !points.some(p => p[0] < 0.0137) || !points.some(p => p[0] > 0.0137)))
})
