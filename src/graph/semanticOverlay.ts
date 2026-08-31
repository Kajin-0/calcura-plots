import type { Chart } from 'function-plot'
import type { CompiledGraphFunction } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function renderSemanticOverlays(
  host: HTMLElement,
  chart: Chart,
  functions: CompiledGraphFunction[],
): void {
  const canvas = host.querySelector('svg.function-plot g.canvas')
  if (!(canvas instanceof SVGGElement)) {
    return
  }

  canvas.querySelector(':scope > g.calcura-semantic-overlays')?.remove()

  const xScale = chart.meta.xScale
  const yScale = chart.meta.yScale
  const width = chart.meta.width
  const height = chart.meta.height

  if (!xScale || !yScale || width === undefined || height === undefined) {
    return
  }

  const overlay = document.createElementNS(SVG_NS, 'g')
  overlay.setAttribute('class', 'calcura-semantic-overlays')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.setAttribute('pointer-events', 'none')

  functions.forEach((compiled, functionIndex) => {
    compiled.resolvedExclusions.forEach((exclusion) => {
      if (exclusion.y === undefined) {
        return
      }

      const cx = xScale(exclusion.x)
      const cy = yScale(exclusion.y)

      if (
        !Number.isFinite(cx) ||
        !Number.isFinite(cy) ||
        cx < 0 ||
        cx > width ||
        cy < 0 ||
        cy > height
      ) {
        return
      }

      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('class', 'calcura-semantic-hole')
      circle.setAttribute('data-function-id', compiled.definition.id)
      circle.setAttribute('data-function-index', String(functionIndex))
      circle.setAttribute('data-exclusion-x', String(exclusion.x))
      circle.setAttribute('cx', String(cx))
      circle.setAttribute('cy', String(cy))
      circle.setAttribute('r', '5')
      circle.setAttribute('stroke', compiled.definition.color ?? '#6f5ee8')
      circle.setAttribute('stroke-width', '2.5')
      overlay.appendChild(circle)
    })
  })

  canvas.appendChild(overlay)
}
