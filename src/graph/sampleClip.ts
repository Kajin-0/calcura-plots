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
