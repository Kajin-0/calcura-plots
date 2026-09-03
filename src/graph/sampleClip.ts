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

export function resolvePlotYDomain(
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

export function clipGraphSampleToYDomain(
  y: number,
  yMin: number,
  yMax: number,
): number {
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(yMin) ||
    !Number.isFinite(yMax) ||
    !(yMin < yMax)
  ) {
    return Number.NaN
  }

  const pad = (yMax - yMin) * VIEWPORT_Y_CLIP_PAD_RATIO
  if (y < yMin - pad || y > yMax + pad) {
    return Number.NaN
  }

  return y
}
