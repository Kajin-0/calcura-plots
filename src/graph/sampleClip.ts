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
  const read = (x: number): number => {
    if (excluded.has(x)) return Number.NaN
    if (cache.has(x)) return cache.get(x)!
    if (cache.size >= 32_768 || cache.size - intervalStart >= intervalBudget) return Number.NaN
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
  const visit = (x0: number, x1: number, depth: number): void => {
    const xs = [x0, x0 + (x1 - x0) / 4, x0 + (x1 - x0) / 2, x0 + 3 * (x1 - x0) / 4, x1]
    const ys = xs.map(read)
    const finite = ys.every(Number.isFinite)
    // One screen pixel is the visible limit. Hunting a pole to 0.001px
    // multiplies the sample count without changing the painted curve.
    const pixelSpan = (x1 - x0) * Math.max(width, 1) / (xDomain[1] - xDomain[0])
    if (!finite && pixelSpan < 1) { gap(); return }
    if (finite && (ys.every(y => y < bounds.lo) || ys.every(y => y > bounds.hi))) { gap(); return }
    const linear = finite && ys.slice(1, 4).every((y, i) =>
      Math.abs(y - (ys[0] * (1 - (i + 1) / 4) + ys[4] * (i + 1) / 4)) <= tolerance)
    if (linear) { emit([x0, ys[0]], [x1, ys[4]]); return }
    if (pixelSpan < 1) {
      // A vertical asymptote leaves both clip edges inside one pixel and must
      // stay a gap. A smooth bend such as x^2 sin(3x) does not, so the chord
      // is the curve at screen resolution.
      const leavesBothSides = ys.some((y) => y < bounds.lo) && ys.some((y) => y > bounds.hi)
      if (!leavesBothSides) emit([x0, ys[0]], [x1, ys[4]])
      else gap()
      return
    }
    if (depth >= 24 || xs[2] === x0 || xs[2] === x1 || cache.size >= 32_768 ||
        cache.size - intervalStart >= intervalBudget ||
        ys.every(y => !Number.isFinite(y))) { gap(); return }
    visit(x0, xs[2], depth + 1)
    visit(xs[2], x1, depth + 1)
  }
  const cuts = [xDomain[0], ...exclusions.filter(x => x > xDomain[0] && x < xDomain[1]), xDomain[1]]
    .sort((a, b) => a - b)
  const steps = Math.max(32, Math.min(2048, Math.ceil(Math.max(width, 1) / 4)))
  // Fair budget: a highly oscillatory interval must not starve later branches.
  intervalBudget = Math.max(5, Math.floor(32_768 / (steps * (cuts.length - 1))))
  for (let cut = 1; cut < cuts.length; cut++) {
    gap()
    const lo = cuts[cut - 1]
    const hi = cuts[cut]
    for (let i = 0; i < steps; i++) {
      intervalStart = cache.size
      visit(i === 0 ? lo : lo + (hi - lo) * i / steps,
        i === steps - 1 ? hi : lo + (hi - lo) * (i + 1) / steps, 0)
    }
  }
  return segments.filter(segment => segment.length >= 2)
}
