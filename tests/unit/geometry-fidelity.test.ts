import assert from 'node:assert/strict'
import test from 'node:test'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'
import { sampleGraphSegments, type GraphPoint } from '../../src/graph/sampleClip'

export const fidelityExpressions = [
  'x', 'x^2', 'x^3', 'x^9', '2x(x^2+6)^4', '3x((x^2+3))^2',
  'sin(x)', 'cos(x)', 'x^2*sin(3x)', 'sin(10x)', 'sin(30x)', 'sin(80*pi*x)', 'sin(1/x)',
  '1/x', '1/(x-0.0137)', '1/x^2', '1/((x-1)*(x+2))', '1/(x-0.0137)^2',
  'tan(x)', 'cot(x)', 'sec(x)', 'csc(x)', 'tan(3x+0.2)',
  'abs(x)', 'abs(sin(x))', 'sin(abs(x))', 'atan(abs(2x))', 'abs(abs(x)-1)',
  'sqrt(x)', 'sqrt(2-x)', 'sqrt(x^2)', 'nthRoot(x,3)', 'sin(sqrt(x))',
  'log(x)', 'log(abs(x))', '1/log(x)', 'log(x+2)',
  'asin(x)', 'acos(x)', 'atan(x)', 'asin(sin(x))',
  'sinh(x)', 'cosh(x)', 'tanh(x)', 'sech(x)', 'csch(x)', 'coth(x)',
  'exp(x)', 'exp(-x)', 'x*exp(x)',
  'log(3*x^x)', 'log(3*x^(2*x))', '(1-cos(3*x))/(1+cos(3*x))',
  '2*cos(3*x)/(1-sin(3*x))', '(1+sin(3*x))/(1-sin(3*x))',
  '1/(cos(5*x)*cos(10*x))', '3*cot(x)*tan(x)',
  // Visually tall but horizontally subpixel branches and a narrow visible valley.
  '1e9*(x-0.017931)^3', 'sqrt(1e8*(x-0.017931))',
  '1e8*(x-0.017931)^2-5',
]

function distance(px: number, py: number, a: GraphPoint, b: GraphPoint, sx: number, sy: number): number {
  const ax = a[0] * sx, ay = a[1] * sy, dx = (b[0] - a[0]) * sx, dy = (b[1] - a[1]) * sy
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

test('adaptive geometry covers dense visible reference points at desktop and mobile resolution', () => {
  const failures: string[] = []
  const errors: number[] = []
  let references = 0, evaluations = 0, maximumCalls = 0
  for (const [width, height, span, ySpan] of [[800, 400, 10, 10], [330, 300, 10, 10], [800, 400, 2, 3]]) {
    for (const expression of fidelityExpressions) {
      const compiled = compileGraphFunction({ id: expression, expression })
      let calls = 0
      const exclusions = [...compiled.samplingExclusions(-span, span), ...(expression === '1/log(x)' || expression === 'sin(1/x)' ? [0] : [])]
      const segments = sampleGraphSegments(x => { calls++; return compiled.evaluate(x) }, [-span, span], [-ySpan, ySpan], width, height, exclusions, compiled.range)
      maximumCalls = Math.max(maximumCalls, calls); evaluations += calls
      assert.ok(calls <= 32768, expression)
      assert.ok(segments.flat().every(p => p.every(Number.isFinite) && Math.abs(p[1]) <= 3 * ySpan), expression)
      const sx = width / (2 * span), sy = height / (2 * ySpan)
      const visibleXs: number[] = []
      for (let i = 0; i <= 20000; i++) visibleXs.push(-span + 2 * span * i / 20000)
      // Deterministic fine grid around a deliberately off-grid finite feature.
      if (expression.includes('0.017931')) for (let i = -100; i <= 100; i++) visibleXs.push(0.017931 + i * 1e-6)
      let worst = 0, missing = 0
      for (const x of visibleXs) {
        const y = compiled.evaluate(x)
        if (exclusions.includes(x)) continue
        if (!Number.isFinite(y) || Math.abs(y) > ySpan) continue
        // Isolated integer-only evaluations of x^x on negative x are not a
        // continuous real-domain component and cannot form a polyline.
        if (expression.startsWith('log(3*x^') && x < 0 &&
            !Number.isFinite(compiled.evaluate(x + 1e-7)) && !Number.isFinite(compiled.evaluate(x - 1e-7))) continue
        // The infinitely oscillatory origin has no resolvable individual lobes below 1px.
        if (expression === 'sin(1/x)' && Math.abs(x) * sx < 1) continue
        references++
        let best = Infinity
        for (const points of segments) {
          if (x < points[0][0] - 2 / sx || x > points[points.length - 1][0] + 2 / sx) continue
          for (let j = 1; j < points.length; j++) {
            if (x < points[j - 1][0] - 2 / sx || x > points[j][0] + 2 / sx) continue
            best = Math.min(best, distance(x * sx, y * sy, points[j - 1], points[j], sx, sy))
          }
        }
        errors.push(best); worst = Math.max(worst, best)
        if (best > 1.25) { missing++; if (missing <= 3) console.log(JSON.stringify({ missing: expression, width, span, x, y, distance: best })) }
      }
      if (missing) failures.push(`${expression} ${width}x${height} x±${span}: ${missing} reference points missing, max ${worst}px`)
    }
  }
  errors.sort((a, b) => a - b)
  console.log(JSON.stringify({ audit: 'geometry-fidelity', functions: fidelityExpressions.length, viewports: 3, references, evaluations, maximumCalls, p95: errors[Math.floor(errors.length * .95)], max: errors[errors.length - 1], failures }))
  assert.deepEqual(failures, [])
})
