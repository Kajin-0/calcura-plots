import type {
  GraphDomainEndpoint,
  GraphExclusion,
  GraphFunctionDefinition,
} from './types'

/**
 * Minimal host-facing input that Calcura can construct directly from the
 * Mathfield's serializeToLatex() output.
 */
export interface CalcuraGraphFunctionInput {
  id: string
  latex: string
  variable?: string
  domain?: [number, number]
  exclusions?: GraphExclusion[]
  domainEndpoints?: GraphDomainEndpoint[]
  color?: string
}

/**
 * Convert one Calcura Mathfield expression into the renderer-neutral graph
 * contract. This function does not parse, simplify, grade, or mutate the LaTeX.
 */
export function createCalcuraGraphFunction(
  input: CalcuraGraphFunctionInput,
): GraphFunctionDefinition {
  return {
    id: input.id,
    expression: input.latex,
    inputFormat: 'latex',
    variable: input.variable,
    domain: input.domain ? [...input.domain] : undefined,
    exclusions: input.exclusions?.map((exclusion) => ({ ...exclusion })),
    domainEndpoints: input.domainEndpoints?.map((endpoint) => ({ ...endpoint })),
    color: input.color,
  }
}

/**
 * Convenience adapter for scenes with multiple curves.
 */
export function createCalcuraGraphFunctions(
  inputs: CalcuraGraphFunctionInput[],
): GraphFunctionDefinition[] {
  return inputs.map(createCalcuraGraphFunction)
}
