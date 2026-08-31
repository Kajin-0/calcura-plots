import {
  all,
  create,
  type FunctionNode,
  type MathNode,
  type OperatorNode,
  type ParenthesisNode,
  type SymbolNode,
} from 'mathjs'
import {
  GraphLatexError,
  latexToGraphExpression,
} from './latexToGraphExpression'
import type {
  CompiledGraphFunction,
  GraphExclusion,
  GraphFunctionDefinition,
} from './types'

const math = create(all, {
  number: 'number',
  precision: 64,
})

const ALLOWED_OPERATORS = new Set(['+', '-', '*', '/', '^'])

const ALLOWED_FUNCTION_ARITY: Record<string, [number, number]> = {
  abs: [1, 1],
  acos: [1, 1],
  acosh: [1, 1],
  asin: [1, 1],
  asinh: [1, 1],
  atan: [1, 1],
  atanh: [1, 1],
  ceil: [1, 1],
  cos: [1, 1],
  cosh: [1, 1],
  cot: [1, 1],
  coth: [1, 1],
  csc: [1, 1],
  csch: [1, 1],
  exp: [1, 1],
  floor: [1, 1],
  log: [1, 2],
  log10: [1, 1],
  nthRoot: [1, 2],
  round: [1, 2],
  sec: [1, 1],
  sech: [1, 1],
  sign: [1, 1],
  sin: [1, 1],
  sinh: [1, 1],
  sqrt: [1, 1],
  tan: [1, 1],
  tanh: [1, 1],
}

const ALLOWED_CONSTANTS = new Set(['e', 'pi'])
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/

export class GraphExpressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphExpressionError'
  }
}

function validateNode(node: MathNode, variable: string): void {
  switch (node.type) {
    case 'ConstantNode':
      return

    case 'SymbolNode': {
      const symbol = node as SymbolNode
      if (symbol.name === variable || ALLOWED_CONSTANTS.has(symbol.name)) {
        return
      }

      throw new GraphExpressionError(`Symbol "${symbol.name}" is not allowed.`)
    }

    case 'ParenthesisNode': {
      validateNode((node as ParenthesisNode).content, variable)
      return
    }

    case 'OperatorNode': {
      const operator = node as OperatorNode
      if (!ALLOWED_OPERATORS.has(operator.op)) {
        throw new GraphExpressionError(
          `Operator "${operator.op}" is not allowed in graph expressions.`,
        )
      }

      operator.args.forEach((argument) => validateNode(argument, variable))
      return
    }

    case 'FunctionNode': {
      const fn = node as FunctionNode
      if (fn.fn.type !== 'SymbolNode') {
        throw new GraphExpressionError('Only direct calls to approved math functions are allowed.')
      }

      const name = (fn.fn as SymbolNode).name
      const arity = ALLOWED_FUNCTION_ARITY[name]
      if (!arity) {
        throw new GraphExpressionError(`Function "${name}" is not allowed.`)
      }

      if (fn.args.length < arity[0] || fn.args.length > arity[1]) {
        throw new GraphExpressionError(
          `Function "${name}" expects ${arity[0] === arity[1] ? arity[0] : `${arity[0]}-${arity[1]}`} argument(s).`,
        )
      }

      fn.args.forEach((argument) => validateNode(argument, variable))
      return
    }

    default:
      throw new GraphExpressionError(
        `Expression construct "${node.type}" is not allowed in graph expressions.`,
      )
  }
}

function validateDefinition(definition: GraphFunctionDefinition): string {
  if (!definition.id.trim()) {
    throw new GraphExpressionError('Graph function id must not be empty.')
  }

  if (!definition.expression.trim()) {
    throw new GraphExpressionError('Graph expression must not be empty.')
  }

  const inputFormat = definition.inputFormat ?? 'mathjs'
  if (inputFormat !== 'mathjs' && inputFormat !== 'latex') {
    throw new GraphExpressionError(
      `Graph input format "${String(inputFormat)}" is not supported.`,
    )
  }

  const variable = definition.variable ?? 'x'
  if (!IDENTIFIER.test(variable) || ALLOWED_CONSTANTS.has(variable)) {
    throw new GraphExpressionError(`Variable "${variable}" is not a valid graph variable.`)
  }

  if (definition.domain) {
    const [min, max] = definition.domain
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max)) {
      throw new GraphExpressionError('Graph domain must contain finite bounds with min < max.')
    }
  }

  const seenExclusions = new Set<number>()
  for (const exclusion of definition.exclusions ?? []) {
    if (!Number.isFinite(exclusion.x)) {
      throw new GraphExpressionError('Excluded x-values must be finite.')
    }
    if (exclusion.y !== undefined && !Number.isFinite(exclusion.y)) {
      throw new GraphExpressionError('Excluded y-values must be finite when provided.')
    }
    if (seenExclusions.has(exclusion.x)) {
      throw new GraphExpressionError(`Duplicate excluded x-value: ${exclusion.x}.`)
    }
    seenExclusions.add(exclusion.x)
  }

  return variable
}

function normalizeSourceExpression(definition: GraphFunctionDefinition): string {
  if ((definition.inputFormat ?? 'mathjs') === 'mathjs') {
    return definition.expression
  }

  try {
    return latexToGraphExpression(definition.expression)
  } catch (error) {
    if (error instanceof GraphLatexError) {
      throw new GraphExpressionError(error.message)
    }
    throw error
  }
}

function asFiniteReal(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

function isExcluded(x: number, exclusions: GraphExclusion[]): boolean {
  return exclusions.some((exclusion) => x === exclusion.x)
}

export function compileGraphFunction(
  definition: GraphFunctionDefinition,
): CompiledGraphFunction {
  const variable = validateDefinition(definition)
  const normalizedExpression = normalizeSourceExpression(definition)

  if (!normalizedExpression.trim()) {
    throw new GraphExpressionError('Graph expression must not be empty after normalization.')
  }

  let root: MathNode
  try {
    root = math.parse(normalizedExpression)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new GraphExpressionError(`Unable to parse graph expression: ${message}`)
  }

  validateNode(root, variable)

  const compiled = root.compile()
  const exclusions = definition.exclusions ?? []

  const evaluateRaw = (x: number): number => {
    if (!Number.isFinite(x)) {
      return Number.NaN
    }

    try {
      return asFiniteReal(compiled.evaluate({ [variable]: x }))
    } catch {
      return Number.NaN
    }
  }

  const evaluate = (x: number): number => {
    if (!Number.isFinite(x)) {
      return Number.NaN
    }

    if (definition.domain) {
      const [min, max] = definition.domain
      if (x < min || x > max) {
        return Number.NaN
      }
    }

    if (isExcluded(x, exclusions)) {
      return Number.NaN
    }

    return evaluateRaw(x)
  }

  const resolvedExclusions = exclusions.map((exclusion) => {
    if (exclusion.y !== undefined) {
      return { ...exclusion }
    }

    const candidate = evaluateRaw(exclusion.x)
    return Number.isFinite(candidate) ? { ...exclusion, y: candidate } : { ...exclusion }
  })

  return {
    definition,
    variable,
    normalizedExpression,
    evaluate,
    evaluateRaw,
    resolvedExclusions,
  }
}

export function compileGraphFunctions(
  definitions: GraphFunctionDefinition[],
): CompiledGraphFunction[] {
  if (definitions.length === 0) {
    throw new GraphExpressionError('At least one graph function is required.')
  }

  const seenIds = new Set<string>()
  return definitions.map((definition) => {
    if (seenIds.has(definition.id)) {
      throw new GraphExpressionError(`Duplicate graph function id: "${definition.id}".`)
    }
    seenIds.add(definition.id)
    return compileGraphFunction(definition)
  })
}
