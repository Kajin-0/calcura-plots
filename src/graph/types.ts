export interface PlotViewport {
  x: [number, number]
  y: [number, number]
}

export interface GraphExclusion {
  x: number
  /**
   * Optional semantic y-coordinate for an open-circle marker.
   *
   * This is required for a removable discontinuity whose original expression
   * is undefined at x and therefore cannot supply its own y-value.
   */
  y?: number
}

export interface GraphFunctionDefinition {
  id: string
  expression: string
  variable?: string
  domain?: [number, number]
  exclusions?: GraphExclusion[]
  color?: string
}

export interface CompiledGraphFunction {
  definition: GraphFunctionDefinition
  variable: string
  evaluate: (x: number) => number
  evaluateRaw: (x: number) => number
  resolvedExclusions: Array<GraphExclusion & { y?: number }>
}
