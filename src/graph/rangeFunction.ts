import { csch, coth, type ConstantNode, type FunctionNode, type MathNode, type OperatorNode, type ParenthesisNode, type SymbolNode } from 'mathjs'

/** Conservative REAL interval enclosure; null means unknown, never offscreen.
 * This is graph culling/continuity information, not symbolic simplification.
 */
export type GraphRange = [number, number] | null
export type GraphRangeEvaluator = ((lo: number, hi: number) => GraphRange) & {
  phaseSpan?: (lo: number, hi: number) => number
  outside?: (lo: number, hi: number, yLo: number, yHi: number) => boolean
  mayCrossSingularity?: (lo: number, hi: number) => boolean
}
type Bound = (x: [number, number]) => GraphRange
const enclose = (lo: number, hi: number): GraphRange => {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null
  // Scale each endpoint independently. A fixed absolute pad creates a whole
  // false zero-denominator band around an otherwise resolved pole.
  const lowerPad = Math.abs(lo) * Number.EPSILON * 16
  const upperPad = Math.abs(hi) * Number.EPSILON * 16
  return [lo === 0 ? 0 : lo - lowerPad, hi === 0 ? 0 : hi + upperPad]
}
const multiply = (a: [number, number], b: [number, number]): GraphRange => {
  const aa = a[0] * b[0], ab = a[0] * b[1], ba = a[1] * b[0], bb = a[1] * b[1]
  return enclose(Math.min(aa, ab, ba, bb), Math.max(aa, ab, ba, bb))
}
function power(a: [number, number], exponent: number): GraphRange {
  if (!Number.isFinite(exponent)) return null
  if (exponent < 0 && a[0] <= 0 && a[1] >= 0) return null
  if (!Number.isInteger(exponent) && a[0] < 0) return null
  const lo = Math.pow(a[0], exponent), hi = Math.pow(a[1], exponent)
  const zero = Number.isInteger(exponent) && exponent > 0 && exponent % 2 === 0 && a[0] <= 0 && a[1] >= 0
  return enclose(zero ? 0 : Math.min(lo, hi), Math.max(lo, hi))
}
function trig(a: [number, number], cosine: boolean): GraphRange {
  if (a[1] - a[0] >= 2 * Math.PI) return [-1, 1]
  const fn = cosine ? Math.cos : Math.sin
  let lo = Math.min(fn(a[0]), fn(a[1])), hi = Math.max(fn(a[0]), fn(a[1]))
  const offset = cosine ? 0 : Math.PI / 2
  for (let k = Math.ceil((a[0] - offset) / Math.PI); k <= Math.floor((a[1] - offset) / Math.PI); k++) {
    if (k % 2 === 0) hi = 1
    else lo = -1
  }
  // These are values of the SAME Math.sin/cos used by the numeric evaluator,
  // plus their exact +/-1 extrema. Padding beyond +/-1 would fabricate zeros
  // in 1 +/- sin/cos denominators and force endless offscreen refinement.
  return [lo, hi]
}
function reciprocal(a: GraphRange): GraphRange {
  if (!a || a[0] <= 0 && a[1] >= 0) return null
  return enclose(1 / a[1], 1 / a[0])
}
function build(node: MathNode, variable: string): Bound {
  if (node.type === 'ConstantNode') {
    const n = Number((node as ConstantNode).value)
    const range: [number, number] = [n, n]
    return () => range
  }
  if (node.type === 'SymbolNode') {
    const name = (node as SymbolNode).name
    return name === variable ? x => x : () => name === 'pi' ? [Math.PI, Math.PI] : [Math.E, Math.E]
  }
  if (node.type === 'ParenthesisNode') return build((node as ParenthesisNode).content, variable)
  if (node.type === 'OperatorNode') {
    const op = node as OperatorNode, left = build(op.args[0], variable)
    if (op.args.length === 1) return op.op === '-' ? x => { const a = left(x); return a && [-a[1], -a[0]] } : left
    const right = build(op.args[1], variable)
    return x => {
      const a = left(x), b = right(x)
      if (!a || !b) return null
      switch (op.op) {
        case '+': return enclose(a[0] + b[0], a[1] + b[1])
        case '-': return enclose(a[0] - b[1], a[1] - b[0])
        case '*': return multiply(a, b)
        case '/': { const inverse = reciprocal(b); return inverse && multiply(a, inverse) }
        case '^': {
          if (b[0] === b[1]) return power(a, b[0])
          if (a[0] <= 0) return null
          const logarithm = enclose(Math.log(a[0]), Math.log(a[1]))
          const exponent = logarithm && multiply(logarithm, b)
          return exponent && enclose(Math.exp(exponent[0]), Math.exp(exponent[1]))
        }
        default: return null
      }
    }
  }
  if (node.type !== 'FunctionNode') return () => null
  const fn = node as FunctionNode, name = (fn.fn as SymbolNode).name
  const arg = build(fn.args[0], variable)
  // Unsupported functions stay unknown. They are never presumed continuous.
  return x => {
    const a = arg(x)
    if (!a) return null
    const monotone = (f: (v: number) => number) => enclose(f(a[0]), f(a[1]))
    switch (name) {
      case 'abs': return enclose(a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(Math.abs(a[0]), Math.abs(a[1])), Math.max(Math.abs(a[0]), Math.abs(a[1])))
      case 'sin': return trig(a, false)
      case 'cos': return trig(a, true)
      case 'sec': return reciprocal(trig(a, true))
      case 'csc': return reciprocal(trig(a, false))
      case 'tan': {
        if (Math.ceil((a[0] - Math.PI / 2) / Math.PI) <= Math.floor((a[1] - Math.PI / 2) / Math.PI)) return null
        return monotone(Math.tan)
      }
      case 'cot': {
        if (Math.ceil(a[0] / Math.PI) <= Math.floor(a[1] / Math.PI)) return null
        return enclose(1 / Math.tan(a[1]), 1 / Math.tan(a[0]))
      }
      case 'sqrt': return a[0] >= 0 ? monotone(Math.sqrt) : null
      case 'nthRoot': {
        if (fn.args.length !== 2 || fn.args[1].type !== 'ConstantNode') return null
        const n = Number((fn.args[1] as ConstantNode).value)
        if (!Number.isInteger(n) || n <= 0) return null
        if (n % 2 === 0) return a[0] >= 0 ? monotone(v => Math.pow(v, 1 / n)) : null
        return monotone(v => Math.sign(v) * Math.pow(Math.abs(v), 1 / n))
      }
      case 'exp': return monotone(Math.exp)
      case 'log': return fn.args.length === 1 && a[0] > 0 ? monotone(Math.log) : null
      case 'log10': return a[0] > 0 ? monotone(Math.log10) : null
      case 'asin': return a[0] >= -1 && a[1] <= 1 ? monotone(Math.asin) : null
      case 'acos': return a[0] >= -1 && a[1] <= 1 ? enclose(Math.acos(a[1]), Math.acos(a[0])) : null
      case 'atan': return monotone(Math.atan)
      case 'sinh': return monotone(Math.sinh)
      case 'tanh': return monotone(Math.tanh)
      case 'asinh': return monotone(Math.asinh)
      case 'acosh': return a[0] >= 1 ? monotone(Math.acosh) : null
      case 'atanh': return a[0] > -1 && a[1] < 1 ? monotone(Math.atanh) : null
      case 'cosh': return enclose(a[0] <= 0 && a[1] >= 0 ? 1 : Math.min(Math.cosh(a[0]), Math.cosh(a[1])), Math.max(Math.cosh(a[0]), Math.cosh(a[1])))
      case 'sech': {
        const lo = Math.min(Math.cosh(a[0]), Math.cosh(a[1])), hi = Math.max(Math.cosh(a[0]), Math.cosh(a[1]))
        return enclose(1 / hi, a[0] <= 0 && a[1] >= 0 ? 1 : 1 / lo)
      }
      case 'csch': return a[0] > 0 || a[1] < 0 ? enclose(csch(a[1]), csch(a[0])) : null
      case 'coth': return a[0] > 0 || a[1] < 0 ? enclose(coth(a[1]), coth(a[0])) : null
      default: return null
    }
  }
}
export function compileRangeEvaluator(root: MathNode, variable: string): GraphRangeEvaluator {
  const bound = build(root, variable)
  const phases: Bound[] = []
  const divisors: Bound[] = []
  root.traverse(node => {
    if (node.type === 'OperatorNode') {
      const op = node as OperatorNode
      if (op.op === '/') divisors.push(build(op.args[1], variable))
      if (op.op === '^' && !(op.args[1].type === 'ConstantNode' && Number((op.args[1] as ConstantNode).value) >= 0)) {
        const base = build(op.args[0], variable), exponent = build(op.args[1], variable)
        divisors.push(x => {
          const b = exponent(x)
          return b && b[0] >= 0 ? [1, 1] : base(x)
        })
      }
    }
    if (node.type !== 'FunctionNode') return
    const fn = node as FunctionNode
    const name = (fn.fn as SymbolNode).name, arg = build(fn.args[0], variable)
    if (['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].includes(name)) phases.push(arg)
    if (['tan', 'sec', 'cot', 'csc'].includes(name)) divisors.push(x => {
      const a = arg(x)
      return a && trig(a, name === 'tan' || name === 'sec')
    })
    if (name === 'csch' || name === 'coth') divisors.push(arg)
  })
  const evaluate: GraphRangeEvaluator = (lo, hi) => bound([lo, hi])
  if (divisors.length) evaluate.mayCrossSingularity = (lo, hi) => divisors.some(divisor => {
    const range = divisor([lo, hi])
    // Flat finite probes do not prove continuity across an unresolved divisor.
    return !range || range[0] <= 0 && range[1] >= 0
  })
  let quotient = root
  while (quotient.type === 'ParenthesisNode') quotient = (quotient as ParenthesisNode).content
  if (quotient.type === 'OperatorNode' && (quotient as OperatorNode).op === '/') {
    const op = quotient as OperatorNode
    const numerator = build(op.args[0], variable), denominator = build(op.args[1], variable)
    evaluate.outside = (lo, hi, yLo, yHi) => {
      const a = numerator([lo, hi]), b = denominator([lo, hi])
      if (!a || !b || a[0] <= 0 && a[1] >= 0) return false
      const minimumNumerator = Math.min(Math.abs(a[0]), Math.abs(a[1]))
      const maximumDenominator = Math.max(Math.abs(b[0]), Math.abs(b[1]))
      // The reciprocal range is disjoint at zero, but its magnitude is still
      // bounded BELOW. Neither branch can intersect the viewport here.
      return minimumNumerator / maximumDenominator > Math.max(Math.abs(yLo), Math.abs(yHi))
    }
  }
  if (phases.length) evaluate.phaseSpan = (lo, hi) => {
    let maximum = 0
    for (const phase of phases) {
      const range = phase([lo, hi])
      if (range) maximum = Math.max(maximum, range[1] - range[0])
    }
    return maximum
  }
  return evaluate
}
