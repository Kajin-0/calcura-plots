import functionPlot, { registerGraphType, type Chart, type FunctionPlotDatum } from 'function-plot'
import { sampleGraphSegments } from './sampleClip'

// function-plot exposes registerGraphType but its datum union lists built-ins only.
export const ADAPTIVE_POLYLINE = 'calcura-adaptive-polyline' as FunctionPlotDatum['graphType']
export type AdaptiveDatum = FunctionPlotDatum & {
  calcuraExclusions?: number[]
  /** Direct numeric evaluator. Avoids allocating a scope object per sample. */
  calcuraEvaluate?: (x: number) => number
  calcuraRange?: import('./rangeFunction').GraphRangeEvaluator
  calcuraSamplingExclusions?: (lo: number, hi: number) => number[]
}

registerGraphType('calcura-adaptive-polyline', (chart: Chart) => selection => {
  selection.each(function (this: SVGGElement, datum: AdaptiveDatum) {
    const range = datum.range ?? [-Infinity, Infinity]
    const x = chart.meta.xScale.domain()
    const y = chart.meta.yScale.domain()
    const fn = datum.fn
    if (typeof fn !== 'function') return
    const xDomain: [number, number] = [Math.max(x[0], range[0]), Math.min(x[1], range[1])]
    const exclusions = [...(datum.calcuraExclusions || []), ...(datum.calcuraSamplingExclusions?.(...xDomain) || [])]
    const segments = sampleGraphSegments(
      datum.calcuraEvaluate ?? (value => Number(fn({ x: value }))),
      xDomain, [y[0], y[1]],
      chart.meta.width, chart.meta.height, exclusions, datum.calcuraRange)
    const group = this as SVGGElement
    const existing = Array.from(group.querySelectorAll<SVGPathElement>(':scope > path.line'))
    segments.forEach((points, index) => {
      const path = existing[index] ?? document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('class', `line line-${datum.index}`)
      path.setAttribute('fill', 'none')
      const colors = functionPlot.globals.COLORS
      path.setAttribute('stroke', datum.color ?? colors[(datum.index ?? 0) % colors.length].toString())
      path.setAttribute('stroke-width', '1')
      path.setAttribute('stroke-linecap', 'round')
      // Hundredth-pixel rounding is far below the 0.5px sampling error budget,
      // and avoids reparsing dozens of irrelevant float digits per SVG vertex.
      let d = ''
      for (let i = 0; i < points.length; i++) {
        const [px, py] = points[i]
        d += `${i ? 'L' : 'M'}${Math.round(chart.meta.xScale(px) * 100) / 100},${Math.round(chart.meta.yScale(py) * 100) / 100}`
      }
      if (path.getAttribute('d') !== d) path.setAttribute('d', d)
      if (!path.parentNode) group.appendChild(path)
    })
    existing.slice(segments.length).forEach(path => path.remove())
    chart.emit('eval', segments, datum.index, datum.isHelper)
  })
})
