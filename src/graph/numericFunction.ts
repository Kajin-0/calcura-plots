import type {
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  ParenthesisNode,
  SymbolNode,
} from 'mathjs'

/**
 * Turn an already-validated mathjs tree into a numeric JavaScript function.
 *
 * Sampling calls the evaluator thousands of times per frame while panning.
 * mathjs' compiled interpreter spends most of that time on call overhead.
 * The graph grammar is a closed set of arithmetic and real functions, so the
 * same tree can run as plain Math.* operations. Anything this emitter does
 * not recognize returns null and the caller keeps the mathjs evaluator.
 */
const DIRECT_MATH: Record<string, string> = {
  abs: 'Math.abs',
  acos: 'Math.acos',
  acosh: 'Math.acosh',
  asin: 'Math.asin',
  asinh: 'Math.asinh',
  atan: 'Math.atan',
  atanh: 'Math.atanh',
  cos: 'Math.cos',
  cosh: 'Math.cosh',
  exp: 'Math.exp',
  log10: 'Math.log10',
  sign: 'Math.sign',
  sin: 'Math.sin',
  sinh: 'Math.sinh',
  sqrt: 'Math.sqrt',
  tan: 'Math.tan',
  tanh: 'Math.tanh',
}

class NumericEmitError extends Error {}

function emitCall(name: string, args: string[]): string {
  const direct = DIRECT_MATH[name]
  if (direct) {
    if (args.length !== 1) throw new NumericEmitError(name)
    return `${direct}(${args[0]})`
  }

  switch (name) {
    case 'log':
      if (args.length === 1) return `Math.log(${args[0]})`
      if (args.length === 2) return `(Math.log(${args[0]})/Math.log(${args[1]}))`
      break
    case 'sec':
      return `(1/Math.cos(${args[0]}))`
    case 'csc':
      return `(1/Math.sin(${args[0]}))`
    case 'cot':
      return `(1/Math.tan(${args[0]}))`
    case 'sech':
      return `(1/Math.cosh(${args[0]}))`
    // mathjs has different rounding/tolerance and near-zero hyperbolic
    // conventions. Do not approximate these contracts with Math.*.
    case 'ceil':
    case 'floor':
    case 'round':
    case 'csch':
    case 'coth':
      throw new NumericEmitError(name)
    case 'nthRoot':
      if (args.length === 1) return `Math.sqrt(${args[0]})`
      if (args.length === 2) return `nthRoot(${args[0]},${args[1]})`
      break
    default:
      break
  }

  throw new NumericEmitError(name)
}

function emit(node: MathNode, variable: string): string {
  switch (node.type) {
    case 'ConstantNode': {
      const value = (node as ConstantNode).value
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) throw new NumericEmitError('constant')
      return `(${numeric})`
    }
    case 'SymbolNode': {
      const name = (node as SymbolNode).name
      if (name === variable) return 'x'
      if (name === 'e') return 'Math.E'
      if (name === 'pi') return 'Math.PI'
      throw new NumericEmitError(name)
    }
    case 'ParenthesisNode':
      return emit((node as ParenthesisNode).content, variable)
    case 'OperatorNode': {
      const operator = node as OperatorNode
      const args = operator.args.map((argument) => emit(argument, variable))
      if (operator.op === '-' && args.length === 1) return `(-${args[0]})`
      if (operator.op === '+' && args.length === 1) return args[0]
      if (operator.op === '^') {
        let folded = args[args.length - 1]
        for (let index = args.length - 2; index >= 0; index -= 1) {
          folded = `Math.pow(${args[index]},${folded})`
        }
        return folded
      }
      const infix = operator.op === '+' || operator.op === '-' || operator.op === '*' || operator.op === '/'
        ? operator.op
        : ''
      if (!infix || args.length < 2) throw new NumericEmitError(operator.op)
      return args.slice(1).reduce((folded, argument) => `(${folded}${infix}${argument})`, args[0])
    }
    case 'FunctionNode': {
      const fn = node as FunctionNode
      if (fn.fn.type !== 'SymbolNode') throw new NumericEmitError('call')
      const name = (fn.fn as SymbolNode).name
      return emitCall(name, fn.args.map((argument) => emit(argument, variable)))
    }
    default:
      throw new NumericEmitError(node.type)
  }
}

export function compileNumericEvaluator(
  root: MathNode,
  variable: string,
): ((x: number) => number) | null {
  let body: string
  try {
    body = emit(root, variable)
  } catch {
    return null
  }

  try {
    const evaluate = new Function(
      'x',
      `"use strict";
      const nthRoot = (value, root) => {
        if (!Number.isFinite(value) || !Number.isFinite(root) || root === 0) return NaN;
        if (Number.isInteger(root) && Math.abs(root) % 2 === 1) {
          return Math.sign(value) * Math.pow(Math.abs(value), 1 / root);
        }
        return Math.pow(value, 1 / root);
      };
      const y = (${body});
      return typeof y === "number" && Number.isFinite(y) ? y : NaN;`,
    ) as (x: number) => number
    return evaluate
  } catch {
    return null
  }
}
