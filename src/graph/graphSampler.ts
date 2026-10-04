import { compileGraphFunction } from './expressionAdapter'
import { sampleGraphSegments } from './sampleClip'
import type { GraphPoint } from './sampleClip'
import type { GraphFunctionDefinition, PlotViewport } from './types'

/** Headless public counterpart of FunctionGraph for host coverage certification. */
export function createGraphSampler(definition: GraphFunctionDefinition) {
  const compiled = compileGraphFunction(definition)
  return {
    evaluate: compiled.evaluate,
    sample(viewport: PlotViewport, width = 800, height = 400): GraphPoint[][] {
      const domain = definition.domain
      const x: [number, number] = domain
        ? [Math.max(viewport.x[0], domain[0]), Math.min(viewport.x[1], domain[1])]
        : viewport.x
      return sampleGraphSegments(compiled.evaluate, x, viewport.y, width, height,
        [...compiled.resolvedExclusions.map(e => e.x), ...compiled.samplingExclusions(...x)], compiled.range)
    },
  }
}
