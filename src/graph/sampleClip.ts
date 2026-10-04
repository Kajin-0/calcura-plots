/**
 * Viewport-relative sample clip for Cartesian polylines.
 *
 * function-plot's built-in sampler treats huge finite y-values as drawable, then
 * the polyline graph type maps them into million-pixel SVG coordinates. Near
 * vertical asymptotes those coordinates shimmer as the sample grid moves.
 *
 * Returning NaN drops the sample so d3 breaks the path instead of drawing a spike.
 * The pad lets a legitimate curve continue a short distance off-screen.
 */
import type { GraphRangeEvaluator } from './rangeFunction'
export const VIEWPORT_Y_CLIP_PAD_RATIO = 1

export function resolvePlotAxisDomain(
  liveDomain: unknown,
  fallback: [number, number],
): [number, number] {
  if (
    Array.isArray(liveDomain) &&
    liveDomain.length >= 2 &&
    typeof liveDomain[0] === 'number' &&
    typeof liveDomain[1] === 'number' &&
    Number.isFinite(liveDomain[0]) &&
    Number.isFinite(liveDomain[1]) &&
    liveDomain[0] < liveDomain[1]
  ) {
    return [liveDomain[0], liveDomain[1]]
  }

  return fallback
}

export function resolvePlotYDomain(
  liveDomain: unknown,
  fallback: [number, number],
): [number, number] {
  return resolvePlotAxisDomain(liveDomain, fallback)
}

function paddedYBounds(
  yMin: number,
  yMax: number,
): { lo: number; hi: number } | null {
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || !(yMin < yMax)) {
    return null
  }

  const pad = (yMax - yMin) * VIEWPORT_Y_CLIP_PAD_RATIO
  return { lo: yMin - pad, hi: yMax + pad }
}

export function clipGraphSampleToYDomain(
  y: number,
  yMin: number,
  yMax: number,
): number {
  if (!Number.isFinite(y)) {
    return Number.NaN
  }

  const bounds = paddedYBounds(yMin, yMax)
  if (!bounds || y < bounds.lo || y > bounds.hi) {
    return Number.NaN
  }

  return y
}

/**
 * Keep a finite y on the padded viewport edge instead of dropping it.
 *
 * Drop-clip is preferred near vertical asymptotes so d3 breaks the path.
 * Steep but globally finite curves (e.g. 2x(x^2+6)^4) can miss the visible
 * y-window on a uniform sample grid; dropping every point then crashes
 * function-plot's polyline join (`undefined[0]`). Clamping keeps a drawable
 * path whose off-screen edges are clipped by the plot.
 */
export function clampGraphSampleToYDomain(
  y: number,
  yMin: number,
  yMax: number,
): number {
  if (!Number.isFinite(y)) {
    return Number.NaN
  }

  const bounds = paddedYBounds(yMin, yMax)
  if (!bounds) {
    return Number.NaN
  }

  if (y < bounds.lo) return bounds.lo
  if (y > bounds.hi) return bounds.hi
  return y
}

const UNIFORM_CLIP_PROBE_SAMPLES = 64

/** True when a uniform x-grid keeps at least one drop-clipped sample. */
export function graphDropClipKeepsUniformSample(
  evaluate: (x: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  sampleCount = UNIFORM_CLIP_PROBE_SAMPLES,
): boolean {
  if (!(xMin < xMax) || sampleCount < 2) return false

  for (let i = 0; i < sampleCount; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / (sampleCount - 1)
    if (Number.isFinite(clipGraphSampleToYDomain(evaluate(x), yMin, yMax))) {
      return true
    }
  }

  return false
}

export type GraphPoint = [number, number]

/**
 * Bounded, viewport-error adaptive polylines. Never clamp independent samples:
 * clip actual resolved segments instead, so a finite crossing between samples
 * is retained. Unresolved curvature/nonfinite intervals are gaps, not bridges.
 * Explicit exclusions are interval boundaries even when no grid hits them.
 */
export function sampleGraphSegments(
  evaluate: (x: number) => number,
  xDomain: [number, number],
  yDomain: [number, number],
  width = 800,
  height = 400,
  exclusions: number[] = [],
  range?: GraphRangeEvaluator,
): GraphPoint[][] {
  const bounds = paddedYBounds(...yDomain)
  if (!bounds || !Number.isFinite(xDomain[0]) || !Number.isFinite(xDomain[1]) ||
      !(xDomain[0] < xDomain[1])) return []
  const segments: GraphPoint[][] = []
  const cache = new Map<number, number>()
  const excluded = new Set(exclusions)
  let current: GraphPoint[] | null = null
  let intervalStart = 0
  let intervalBudget = 32_768
  let readLimit = 32_768
  const read = (x: number): number => {
    if (excluded.has(x)) return Number.NaN
    const cached = cache.get(x)
    if (cached !== undefined) return cached
    if (cache.size >= readLimit) return Number.NaN
    let y: number
    try { y = evaluate(x) } catch { y = Number.NaN }
    cache.set(x, y)
    return y
  }
  const gap = () => { current = null }
  const emit = (a: GraphPoint, b: GraphPoint) => {
    // Liang-Barsky in y, after continuity/curvature has been resolved.
    let start = a
    let end = b
    if ((a[1] < bounds.lo && b[1] < bounds.lo) ||
        (a[1] > bounds.hi && b[1] > bounds.hi)) { gap(); return }
    const crossing = (y: number): GraphPoint => {
      const scale = Math.max(Math.abs(a[1]), Math.abs(b[1]), Math.abs(y), 1)
      const fraction = (y / scale - a[1] / scale) / (b[1] / scale - a[1] / scale)
      return [a[0] + (b[0] - a[0]) * fraction, y]
    }
    if (a[1] < bounds.lo) start = crossing(bounds.lo)
    if (a[1] > bounds.hi) start = crossing(bounds.hi)
    if (b[1] < bounds.lo) end = crossing(bounds.lo)
    if (b[1] > bounds.hi) end = crossing(bounds.hi)
    if (!current || current[current.length - 1][0] !== start[0] || current[current.length - 1][1] !== start[1]) {
      current = [start]
      segments.push(current)
    }
    current.push(end)
  }
  const tolerance = (yDomain[1] - yDomain[0]) * 0.5 / Math.max(height, 1)
  const visit = (x0: number, x1: number, depth: number, limit: number): void => {
    readLimit = limit
    const enclosure = range?.(x0, x1)
    if (range?.outside?.(x0, x1, bounds.lo, bounds.hi)) { gap(); return }
    // A certified enclosure can cull without evaluating offscreen samples.
    if (enclosure && (enclosure[1] < bounds.lo || enclosure[0] > bounds.hi)) { gap(); return }
    const quarter = x0 + (x1 - x0) / 4
    const middle = x0 + (x1 - x0) / 2
    const thirdQuarter = x0 + 3 * (x1 - x0) / 4
    const y0 = read(x0), yQuarter = read(quarter), yMiddle = read(middle), yThirdQuarter = read(thirdQuarter), y1 = read(x1)
    const finite = Number.isFinite(y0) && Number.isFinite(yQuarter) && Number.isFinite(yMiddle) && Number.isFinite(yThirdQuarter) && Number.isFinite(y1)
    const pixelSpan = (x1 - x0) * Math.max(width, 1) / (xDomain[1] - xDomain[0])
    // Probe agreement is NOT proof that a valley/crossing cannot be visible.
    const observedRangeResolved = enclosure && finite &&
      enclosure[0] >= Math.min(y0, yQuarter, yMiddle, yThirdQuarter, y1) - tolerance && enclosure[1] <= Math.max(y0, yQuarter, yMiddle, yThirdQuarter, y1) + tolerance
    const allOffscreen = finite && (
      Math.max(y0, yQuarter, yMiddle, yThirdQuarter, y1) < bounds.lo ||
      Math.min(y0, yQuarter, yMiddle, yThirdQuarter, y1) > bounds.hi)
    if (!range && allOffscreen) { gap(); return }
    const linear = finite &&
      Math.abs(yQuarter - (y0 * 0.75 + y1 * 0.25)) <= tolerance &&
      Math.abs(yMiddle - (y0 * 0.5 + y1 * 0.5)) <= tolerance &&
      Math.abs(yThirdQuarter - (y0 * 0.25 + y1 * 0.75)) <= tolerance
    // Equal probe values may alias a periodic curve. Resolve its argument
    // interval as well, rather than treating a whole number of cycles as flat.
    const phaseResolved = !range?.phaseSpan || range.phaseSpan(x0, x1) <= Math.PI / 2
    if (linear && phaseResolved && (!allOffscreen || !enclosure || observedRangeResolved)) { emit([x0, y0], [x1, y1]); return }
    // Subpixel horizontal width alone cannot erase a tall finite branch.
    // A real continuous, monotone probe interval narrower than half a pixel
    // is geometrically resolved even when its slope is almost vertical.
    if (finite && observedRangeResolved && pixelSpan <= 0.5 &&
        ((y0 <= yQuarter && yQuarter <= yMiddle && yMiddle <= yThirdQuarter && yThirdQuarter <= y1) ||
         (y0 >= yQuarter && yQuarter >= yMiddle && yMiddle >= yThirdQuarter && yThirdQuarter >= y1))) {
      emit([x0, y0], [x1, y1]); return
    }
    if (depth >= 40 || middle === x0 || middle === x1 || cache.size >= 32_768 ||
        cache.size >= limit ||
        (!Number.isFinite(y0) && !Number.isFinite(yQuarter) && !Number.isFinite(yMiddle) && !Number.isFinite(yThirdQuarter) && !Number.isFinite(y1))) { gap(); return }
    // A pathological LEFT child must not consume the RIGHT child's budget.
    const rightRange = range?.(middle, x1)
    const rightOffscreen = rightRange && (rightRange[1] < bounds.lo || rightRange[0] > bounds.hi)
    const reserve = rightOffscreen ? 5 : Math.min(256, Math.floor((limit - cache.size) / 2))
    const middleLimit = limit - reserve
    visit(x0, middle, depth + 1, middleLimit)
    visit(middle, x1, depth + 1, limit)
  }
  const cuts = [...new Set([xDomain[0], ...exclusions.filter(x => x > xDomain[0] && x < xDomain[1]), xDomain[1]])]
    .sort((a, b) => a - b)
  const totalSteps = Math.max(32, Math.min(2048, Math.ceil(Math.max(width, 1) / 4)))
  const stepCount = (lo: number, hi: number) => Math.max(1, Math.ceil(totalSteps * (hi - lo) / (xDomain[1] - xDomain[0])))
  // Fair budget: a highly oscillatory interval must not starve later branches.
  let remainingIntervals = cuts.slice(1).reduce((sum, hi, i) => sum + stepCount(cuts[i], hi), 0)
  for (let cut = 1; cut < cuts.length; cut++) {
    gap()
    const lo = cuts[cut - 1]
    const hi = cuts[cut]
    const steps = stepCount(lo, hi)
    for (let i = 0; i < steps; i++) {
      intervalStart = cache.size
      remainingIntervals--
      // Reserve coarse coverage of every later interval, but let difficult
      // boundaries borrow unused refinement capacity instead of disappearing.
      intervalBudget = Math.max(5, Math.min(4096, 32_768 - cache.size - remainingIntervals * 5))
      visit(i === 0 ? lo : lo + (hi - lo) * i / steps,
        i === steps - 1 ? hi : lo + (hi - lo) * (i + 1) / steps, 0, Math.min(32768, intervalStart + intervalBudget))
    }
  }
  return segments.filter(segment => segment.length >= 2)
}
