import functionPlot, { registerGraphType, type Chart, type FunctionPlotDatum } from 'function-plot'
import { sampleGraphSegments } from './sampleClip'

// function-plot exposes registerGraphType but its datum union lists built-ins only.
export const ADAPTIVE_POLYLINE = 'calcura-adaptive-polyline' as FunctionPlotDatum['graphType']
export type AdaptiveDatum = FunctionPlotDatum & {
  calcuraExclusions?: number[]
  /** Direct numeric evaluator. Avoids allocating a scope object per sample. */
  calcuraEvaluate?: (x: number) => number
}

registerGraphType('calcura-adaptive-polyline', (chart: Chart) => selection => {
  selection.each(function (this: SVGGElement, datum: AdaptiveDatum) {
    const range = datum.range ?? [-Infinity, Infinity]
    const x = chart.meta.xScale.domain()
    const y = chart.meta.yScale.domain()
    const fn = datum.fn
    if (typeof fn !== 'function') return
    const segments = sampleGraphSegments(
      datum.calcuraEvaluate ?? (value => Number(fn({ x: value }))),
      [Math.max(x[0], range[0]), Math.min(x[1], range[1])], [y[0], y[1]],
      chart.meta.width, chart.meta.height, datum.calcuraExclusions)
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
      path.setAttribute('d', points.map(([px, py], i) => `${i ? 'L' : 'M'}${chart.meta.xScale(px)},${chart.meta.yScale(py)}`).join(''))
      if (!path.parentNode) group.appendChild(path)
    })
    existing.slice(segments.length).forEach(path => path.remove())
    chart.emit('eval', segments, datum.index, datum.isHelper)
  })
})
