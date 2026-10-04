import type { ConstantNode, FunctionNode, MathNode, OperatorNode, ParenthesisNode, SymbolNode } from 'mathjs'

// Graph-only structural pole partitioning. Never simplify away a denominator.
// Roots outside this small provable grammar remain the adaptive sampler's job.
type Polynomial = number[]
function polynomial(node: MathNode, variable: string): Polynomial | null {
  if (node.type === 'ParenthesisNode') return polynomial((node as ParenthesisNode).content, variable)
  if (node.type === 'ConstantNode') return [Number((node as ConstantNode).value)]
  if (node.type === 'SymbolNode') {
    const name = (node as SymbolNode).name
    return name === variable ? [0, 1] : name === 'pi' ? [Math.PI] : name === 'e' ? [Math.E] : null
  }
  if (node.type !== 'OperatorNode') return null
  const op = node as OperatorNode, a = polynomial(op.args[0], variable)
  if (!a) return null
  if (op.args.length === 1) return op.op === '-' ? a.map(v => -v) : a
  const b = polynomial(op.args[1], variable)
  if (!b) return null
  if (op.op === '+' || op.op === '-') return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (op.op === '+' ? 1 : -1) * (b[i] || 0))
  if (op.op === '/' && b.length === 1 && b[0] !== 0) return a.map(v => v / b[0])
  if (op.op === '^' && b.length === 1 && b[0] === 2) return product(a, a)
  if (op.op === '*') return product(a, b)
  return null
}
function product(a: Polynomial, b: Polynomial): Polynomial | null {
  if (a.length + b.length - 1 > 3) return null
  const c = Array<number>(a.length + b.length - 1).fill(0)
  a.forEach((v, i) => b.forEach((w, j) => { c[i + j] += v * w }))
  return c
}
function roots(p: Polynomial | null): number[] {
  if (!p) return []
  const [c = 0, b = 0, a = 0] = p
  if (a === 0) return b === 0 ? [] : [-c / b]
  const d = b * b - 4 * a * c
  if (d < 0) return []
  if (d === 0) return [-b / (2 * a)]
  // Avoid loss of the small root from subtracting nearly equal numbers.
  const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(d)) / 2
  return [q / a, c / q]
}
function unwrap(node: MathNode): MathNode {
  return node.type === 'ParenthesisNode' ? unwrap((node as ParenthesisNode).content) : node
}

export function compileSamplingExclusions(root: MathNode, variable: string) {
  return (lo: number, hi: number): number[] => {
    const output = new Set<number>()
    const add = (xs: number[]) => xs.forEach(x => { if (Number.isFinite(x) && x >= lo && x <= hi) output.add(x) })
    const periodic = (arg: MathNode, offset: number) => {
      const p = polynomial(arg, variable)
      if (!p || p.length !== 2 || p[1] === 0) return
      const a = Math.min(p[0] + p[1] * lo, p[0] + p[1] * hi)
      const b = Math.max(p[0] + p[1] * lo, p[0] + p[1] * hi)
      const first = Math.ceil((a - offset) / Math.PI), last = Math.floor((b - offset) / Math.PI)
      // Do not allocate arbitrarily large arrays for subpixel oscillations.
      if (last - first > 2048) return
      for (let k = first; k <= last; k++) add([(offset + k * Math.PI - p[0]) / p[1]])
    }
    const trigLevelZeros = (node: MathNode) => {
      // Denominators such as 1 +/- cos(ax), including even-order poles.
      const terms = (n: MathNode): { constant: number; coefficient: number; fn: FunctionNode | null } | null => {
        n = unwrap(n)
        const p = polynomial(n, variable)
        if (p?.length === 1) return { constant: p[0], coefficient: 0, fn: null }
        if (n.type === 'FunctionNode') {
          const fn = n as FunctionNode
          return ['sin', 'cos'].includes((fn.fn as SymbolNode).name) ? { constant: 0, coefficient: 1, fn } : null
        }
        if (n.type !== 'OperatorNode') return null
        const op = n as OperatorNode, a = terms(op.args[0]), b = op.args[1] ? terms(op.args[1]) : null
        if (!a) return null
        if (op.args.length === 1 && op.op === '-') return { ...a, constant: -a.constant, coefficient: -a.coefficient }
        if (!b) return null
        if ((op.op === '+' || op.op === '-') && !(a.fn && b.fn)) {
          const sign = op.op === '+' ? 1 : -1
          return { constant: a.constant + sign * b.constant, coefficient: a.coefficient + sign * b.coefficient, fn: a.fn || b.fn }
        }
        if (op.op === '*' && (!a.fn || !b.fn)) {
          const scalar = a.fn ? b : a, expression = a.fn ? a : b
          return { constant: expression.constant * scalar.constant, coefficient: expression.coefficient * scalar.constant, fn: expression.fn }
        }
        return null
      }
      const t = terms(node)
      if (!t?.fn || t.coefficient === 0) return
      const p = polynomial(t.fn.args[0], variable), level = -t.constant / t.coefficient
      if (!p || p.length !== 2 || p[1] === 0 || Math.abs(level) > 1) return
      const sine = (t.fn.fn as SymbolNode).name === 'sin'
      const theta = sine ? Math.asin(level) : Math.acos(level)
      const offsets = sine ? [theta, Math.PI - theta] : [theta, -theta]
      const a = Math.min(p[0] + p[1] * lo, p[0] + p[1] * hi), b = Math.max(p[0] + p[1] * lo, p[0] + p[1] * hi)
      for (const offset of offsets) {
        const first = Math.ceil((a - offset) / (2 * Math.PI)), last = Math.floor((b - offset) / (2 * Math.PI))
        if (last - first > 2048) continue
        for (let k = first; k <= last; k++) add([(offset + k * 2 * Math.PI - p[0]) / p[1]])
      }
    }
    const zeros = (node: MathNode) => {
      node = unwrap(node)
      add(roots(polynomial(node, variable)))
      trigLevelZeros(node)
      if (node.type === 'OperatorNode') {
        const op = node as OperatorNode
        if (op.op === '*') op.args.forEach(zeros)
        const exponent = op.op === '^' ? polynomial(op.args[1], variable) : null
        if (exponent?.length === 1 && exponent[0] > 0) zeros(op.args[0])
      } else if (node.type === 'FunctionNode') {
        const fn = node as FunctionNode, name = (fn.fn as SymbolNode).name
        if (name === 'sin' || name === 'tan') periodic(fn.args[0], 0)
        if (name === 'cos') periodic(fn.args[0], Math.PI / 2)
        if (['abs', 'sqrt', 'nthRoot', 'sinh', 'tanh'].includes(name)) zeros(fn.args[0])
        if (name === 'log' || name === 'log10') {
          const p = polynomial(fn.args[0], variable)
          if (p) { p[0] -= 1; add(roots(p)) }
        }
      }
    }
    const walk = (node: MathNode) => {
      node = unwrap(node)
      if (node.type === 'OperatorNode') {
        const op = node as OperatorNode
        if (op.op === '/') zeros(op.args[1])
        const exponent = op.op === '^' ? polynomial(op.args[1], variable) : null
        if (exponent?.length === 1 && exponent[0] < 0) zeros(op.args[0])
        op.args.forEach(walk)
      } else if (node.type === 'FunctionNode') {
        const fn = node as FunctionNode, name = (fn.fn as SymbolNode).name
        if (name === 'tan' || name === 'sec') periodic(fn.args[0], Math.PI / 2)
        if (name === 'cot' || name === 'csc') periodic(fn.args[0], 0)
        if (name === 'csch' || name === 'coth') zeros(fn.args[0])
        fn.args.forEach(walk)
      }
    }
    walk(root)
    return [...output].sort((a, b) => a - b)
  }
}
