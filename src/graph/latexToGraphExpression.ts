/**
 * Calcura-style Mathfield LaTeX -> graph-expression normalization.
 *
 * This is intentionally a graph-input adapter, not an equivalence parser:
 * - no integrals/differentials;
 * - no symbolic simplification;
 * - no grading semantics;
 * - indexed roots use mathjs nthRoot so odd roots retain their real branch.
 *
 * The supported syntax mirrors the expression forms emitted by Calcura's
 * Mathfield serializer and the robust conversion conventions used by Calcura's
 * extracted symbolic parser.
 */

const RESERVED_IDENTIFIERS = new Set([
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sech',
  'csch',
  'coth',
  'log',
  'exp',
  'sqrt',
  'nthRoot',
  'abs',
  'pi',
  'e',
])

const FUNCTION_NAMES = [
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sech',
  'csch',
  'coth',
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'log',
  'exp',
  'sqrt',
  'nthRoot',
  'abs',
]

const UNSUPPORTED_GRAPH_LATEX =
  /\\(?:int|sum|prod|lim|partial|infty|pm|mp|neq|leq|geq|Delta|alpha|beta|gamma|lambda|mu|sigma|epsilon|phi|omega|eta|tau)\b/

export class GraphLatexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphLatexError'
  }
}

function findBalancedClose(
  source: string,
  openIndex: number,
  open = '{',
  close = '}',
): number {
  if (source[openIndex] !== open) {
    return -1
  }

  let depth = 0
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === open) {
      depth += 1
    } else if (source[i] === close) {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

function normalizeHarmlessGroupingBrackets(expression: string): string {
  if (!expression) {
    return expression
  }

  let source = expression
  const protectedOptionals: string[] = []

  source = source.replace(/\\(?!left\b|right\b)[a-zA-Z]+\[[^\[\]]*\]/g, (match) => {
    const token = `__BRACKET_OPT_${protectedOptionals.length}__`
    protectedOptionals.push(match)
    return token
  })

  source = source
    .replace(/\\left\s*\[/g, '(')
    .replace(/\\right\s*\]/g, ')')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')

  protectedOptionals.forEach((optional, index) => {
    source = source.replace(`__BRACKET_OPT_${index}__`, optional)
  })

  return source
}

function replaceFractions(expression: string): string {
  let source = expression

  for (let guard = 0; guard < 64; guard += 1) {
    const fracIndex = source.indexOf('\\frac')
    if (fracIndex < 0) {
      break
    }

    const numeratorOpen = source.indexOf('{', fracIndex)
    if (numeratorOpen < 0) {
      break
    }

    const numeratorClose = findBalancedClose(source, numeratorOpen)
    if (numeratorClose < 0) {
      break
    }

    const denominatorOpen = source.indexOf('{', numeratorClose + 1)
    if (denominatorOpen < 0) {
      break
    }

    const denominatorClose = findBalancedClose(source, denominatorOpen)
    if (denominatorClose < 0) {
      break
    }

    const numerator = source.slice(numeratorOpen + 1, numeratorClose)
    const denominator = source.slice(denominatorOpen + 1, denominatorClose)
    source =
      source.slice(0, fracIndex) +
      `((${numerator})/(${denominator}))` +
      source.slice(denominatorClose + 1)
  }

  return source
}

function replaceRadicals(expression: string): string {
  let source = expression
  let cursor = 0

  for (let guard = 0; guard < 64; guard += 1) {
    const sqrtIndex = source.indexOf('\\sqrt', cursor)
    if (sqrtIndex < 0) {
      break
    }

    let position = sqrtIndex + 5
    let rootIndex: string | null = null

    if (source[position] === '[') {
      const closeBracket = source.indexOf(']', position)
      if (closeBracket < 0) {
        break
      }
      rootIndex = source.slice(position + 1, closeBracket)
      position = closeBracket + 1
    }

    if (source[position] !== '{') {
      cursor = sqrtIndex + 5
      continue
    }

    const radicandClose = findBalancedClose(source, position)
    if (radicandClose < 0) {
      break
    }

    const radicand = source.slice(position + 1, radicandClose)
    const replacement =
      rootIndex === null
        ? `sqrt(${radicand})`
        : `nthRoot((${radicand}),(${rootIndex}))`

    source =
      source.slice(0, sqrtIndex) +
      replacement +
      source.slice(radicandClose + 1)
    cursor = sqrtIndex + replacement.length
  }

  return source
}

function rewriteAbsLog(expression: string): string {
  const source = expression || ''
  let cursor = 0
  let output = ''

  while (cursor < source.length) {
    const rest = source.slice(cursor)
    const match = rest.match(/^(\\(?:ln|log)|ln|log)\|/)

    if (!match) {
      output += source[cursor]
      cursor += 1
      continue
    }

    if (!match[1].startsWith('\\')) {
      const previous = cursor > 0 ? source[cursor - 1] : ''
      if (/[A-Za-z0-9_]/.test(previous)) {
        output += source[cursor]
        cursor += 1
        continue
      }
    }

    const absoluteStart = cursor + match[0].length
    const close = source.indexOf('|', absoluteStart)
    if (close < 0) {
      output += source[cursor]
      cursor += 1
      continue
    }

    output += `log(abs(${source.slice(absoluteStart, close)}))`
    cursor = close + 1
  }

  return output
}

function normalizeAbsoluteValueBars(expression: string): string {
  let source = expression
    .replace(/\\left\|/g, '|')
    .replace(/\\right\|/g, '|')

  for (let guard = 0; guard < 12; guard += 1) {
    const next = source.replace(/\|([^|]+)\|/g, 'abs($1)')
    if (next === source) {
      break
    }
    source = next
  }

  return source
}

function normalizePiImplicitMultiplication(expression: string): string {
  let source = expression.replace(/π/g, 'pi')
  source = source.replace(/(\d)pi([a-zA-Z])/g, '$1*pi*$2')
  source = source.replace(/(\d)pi(?![a-zA-Z*])/g, '$1*pi')
  source = source.replace(/(?<![a-zA-Z*])pi([a-zA-Z])/g, 'pi*$1')
  source = source.replace(/(?<![a-zA-Z*])pi\(/g, 'pi*(')
  return source
}

function normalizeKeyboardLetterProducts(expression: string): string {
  return expression.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (identifier) => {
    if (
      RESERVED_IDENTIFIERS.has(identifier) ||
      identifier.includes('_') ||
      /\d/.test(identifier) ||
      identifier.length === 1
    ) {
      return identifier
    }

    return identifier.split('').join('*')
  })
}

function wrapPostfixFunctionPowers(
  expression: string,
  functionNames: string[],
): string {
  const names = [...functionNames].sort((a, b) => b.length - a.length)
  const call = new RegExp(`(?<![A-Za-z])(${names.join('|')})\\(`, 'g')
  let source = expression

  for (let guard = 0; guard < 32; guard += 1) {
    let output = ''
    let last = 0
    let changed = false
    call.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = call.exec(source)) !== null) {
      const start = match.index
      let depth = 1
      let position = start + match[0].length

      for (; position < source.length; position += 1) {
        if (source[position] === '(') {
          depth += 1
        } else if (source[position] === ')') {
          depth -= 1
          if (depth === 0) {
            position += 1
            break
          }
        }
      }

      if (depth !== 0) {
        call.lastIndex = Math.max(call.lastIndex, start + match[0].length)
        continue
      }

      const power = source.slice(position).match(/^\^(?:\{(\d+)\}|(\d+))/)
      if (!power) {
        call.lastIndex = position
        continue
      }

      const exponent = power[1] || power[2]
      output += source.slice(last, start)
      output += `(${source.slice(start, position)})^${exponent}`
      last = position + power[0].length
      call.lastIndex = last
      changed = true
    }

    output += source.slice(last)
    source = output

    if (!changed) {
      break
    }
  }

  return source
}

function normalizeExponentialE(expression: string): string {
  let source = expression.replace(/\be\s*\^\s*/g, 'e^')
  source = source.replace(/(\d)e\^/g, '$1*e^')

  let output = ''
  let index = 0

  while (index < source.length) {
    if (
      source[index] === 'e' &&
      source[index + 1] === '^' &&
      (index === 0 || !/[A-Za-z0-9_]/.test(source[index - 1]))
    ) {
      index += 2

      if (source[index] === '(') {
        let depth = 1
        let end = index + 1

        for (; end < source.length; end += 1) {
          if (source[end] === '(') {
            depth += 1
          } else if (source[end] === ')') {
            depth -= 1
            if (depth === 0) {
              end += 1
              break
            }
          }
        }

        if (depth !== 0) {
          output += 'e^'
          continue
        }

        output += `exp(${source.slice(index + 1, end - 1)})`
        index = end
        continue
      }

      const atom = source
        .slice(index)
        .match(/^([A-Za-z_]\w*|\d+(?:\.\d+)?)/)

      if (atom) {
        output += `exp(${atom[1]})`
        index += atom[1].length
        continue
      }

      output += 'e^'
      continue
    }

    output += source[index]
    index += 1
  }

  return output.replace(/(\d)([a-zA-Z])/g, '$1*$2')
}

function rewritePreArgumentFunctionPowers(expression: string): string {
  const pattern =
    /(?<![A-Za-z])\\?(arcsin|arccos|arctan|sinh|cosh|tanh|sech|csch|coth|sin|cos|tan|sec|csc|cot)\^(?:\{(\d+)\}|(\d+))\(/g

  let output = ''
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(expression)) !== null) {
    const start = match.index
    const functionName = match[1]
    const exponent = match[2] || match[3]
    let depth = 1
    let position = start + match[0].length

    for (; position < expression.length; position += 1) {
      if (expression[position] === '(') {
        depth += 1
      } else if (expression[position] === ')') {
        depth -= 1
        if (depth === 0) {
          position += 1
          break
        }
      }
    }

    if (depth !== 0) {
      pattern.lastIndex = Math.max(pattern.lastIndex, start + match[0].length)
      continue
    }

    const argument = expression.slice(start + match[0].length, position - 1)
    output += expression.slice(last, start)
    output += `(\\${functionName}(${argument}))^${exponent}`
    last = position
    pattern.lastIndex = position
  }

  output += expression.slice(last)
  return output
}

export function latexToGraphExpression(latex: string): string {
  let source = String(latex ?? '').trim()
  if (!source) {
    return ''
  }

  if (UNSUPPORTED_GRAPH_LATEX.test(source)) {
    throw new GraphLatexError(
      'This LaTeX construct is outside the Cartesian function-graph grammar.',
    )
  }

  // Differentials and equations belong to calculus/grading semantics, not f(x).
  if (/\b(?:dx|du|dv|dy|dt)\b/.test(source)) {
    throw new GraphLatexError(
      'Differentials are not allowed in a function graph expression.',
    )
  }

  source = normalizeHarmlessGroupingBrackets(source)
  source = source
    .replace(/--/g, '+')
    .replace(/\+-/g, '-')
    .replace(/-\+/g, '-')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\[,;:!]/g, '')
    .replace(/\\quad/g, '')
    .replace(/\\qquad/g, '')
    .replace(/\s+/g, '')

  source = replaceFractions(source)
  source = replaceRadicals(source)
  source = source
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\div/g, '/')

  // Explicit multiplication before a serialized function command.
  source = source.replace(
    /([a-zA-Z0-9\)\}])\\(arccos|arcsin|arctan|sinh|cosh|tanh|sech|csch|coth|sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt)/g,
    '$1*\\$2',
  )

  source = rewritePreArgumentFunctionPowers(source)
  source = rewriteAbsLog(source)

  source = source
    .replace(/\\ln/g, 'log')
    .replace(/\\log/g, 'log')
    .replace(/\bln(?=\s*\()/g, 'log')
    .replace(/\\arcsin/g, 'asin')
    .replace(/\\arccos/g, 'acos')
    .replace(/\\arctan/g, 'atan')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\sec/g, 'sec')
    .replace(/\\csc/g, 'csc')
    .replace(/\\cot/g, 'cot')
    .replace(/\\sinh/g, 'sinh')
    .replace(/\\cosh/g, 'cosh')
    .replace(/\\tanh/g, 'tanh')
    .replace(/\\sech/g, 'sech')
    .replace(/\\csch/g, 'csch')
    .replace(/\\coth/g, 'coth')
    .replace(/\\exp/g, 'exp')
    .replace(/\\pi/g, 'pi')

  source = normalizePiImplicitMultiplication(source)
  source = rewriteAbsLog(source)
  source = normalizeAbsoluteValueBars(source)
  source = wrapPostfixFunctionPowers(source, FUNCTION_NAMES)

  source = source.replace(/\{/g, '(').replace(/\}/g, ')')

  const functionPattern = FUNCTION_NAMES.join('|')
  source = source.replace(
    new RegExp(`\\)(${functionPattern})\\(`, 'g'),
    ')*$1(',
  )
  source = source.replace(/\)(\d+)/g, ')*$1')
  source = source.replace(/\)([a-z])/g, ')*$1')
  source = source.replace(
    new RegExp(`(\\d)(${functionPattern})\\(`, 'g'),
    '$1*$2(',
  )
  source = source.replace(/sqrt\(([^()]*)\)\(/g, 'sqrt($1)*(')
  source = source.replace(/\)\(/g, ')*(')
  source = source.replace(/(\d)\(/g, '$1*(')

  const functionsLongestFirst = [...FUNCTION_NAMES].sort(
    (a, b) => b.length - a.length,
  )
  const functionAlternation = functionsLongestFirst.join('|')

  source = source.replace(
    new RegExp(`([0-9\\)])(${functionAlternation})\\(`, 'g'),
    '$1*$2(',
  )

  source = source.replace(
    new RegExp(`([a-zA-Z])(${functionAlternation})\\(`, 'g'),
    (match, letter: string, functionName: string) =>
      RESERVED_IDENTIFIERS.has(`${letter}${functionName}`)
        ? match
        : `${letter}*${functionName}(`,
  )

  // Single-letter graph variable adjacent to a parenthesized group.
  source = source.replace(
    /(?<![A-Za-z\\])([A-Za-z])\((?=[+\-\d\\a-zA-Z])/g,
    '$1*(',
  )

  source = normalizeKeyboardLetterProducts(source)
  source = normalizeExponentialE(source)

  if (/\\[a-zA-Z]+/.test(source)) {
    throw new GraphLatexError(
      'The expression contains an unsupported or incomplete LaTeX command.',
    )
  }

  return source
}
