import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileGraphFunction } from '../../src/graph/expressionAdapter'
import {
  GraphLatexError,
  latexToGraphExpression,
} from '../../src/graph/latexToGraphExpression'

type CorpusRow = {
  latex: string
  x: number
  expected: number
}

const fixturePath = fileURLToPath(
  new URL('../fixtures/calcura-latex-graph-corpus.json', import.meta.url),
)
const corpus = JSON.parse(readFileSync(fixturePath, 'utf8')) as CorpusRow[]

test('Calcura-style LaTeX corpus evaluates with expected real semantics', () => {
  for (const row of corpus) {
    const compiled = compileGraphFunction({
      id: 'f',
      expression: row.latex,
      inputFormat: 'latex',
    })

    const actual = compiled.evaluate(row.x)
    assert.ok(
      Math.abs(actual - row.expected) < 1e-10,
      `${row.latex}: expected ${row.expected}, received ${actual}; normalized=${compiled.normalizedExpression}`,
    )
  }
})

test('fraction and implicit multiplication normalize without symbolic simplification', () => {
  const normalized = latexToGraphExpression('2\\frac{x+1}{x-1}')
  assert.match(normalized, /2\*/)
  assert.match(normalized, /x\+1/)
  assert.match(normalized, /x-1/)
})

test('indexed odd roots preserve the real negative branch', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: '\\sqrt[3]{x}',
    inputFormat: 'latex',
  })

  assert.equal(compiled.evaluate(-8), -2)
  assert.match(compiled.normalizedExpression, /nthRoot/)
})

test('inverse trig of an absolute value stays a function call', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: '\\arctan|2x|',
    inputFormat: 'latex',
  })
  const delimited = compileGraphFunction({
    id: 'g',
    expression: '\\arctan\\left|2x\\right|',
    inputFormat: 'latex',
  })

  assert.match(compiled.normalizedExpression, /^atan\(abs\(/)
  assert.equal(compiled.evaluate(0), 0)
  assert.ok(Math.abs(compiled.evaluate(1) - Math.atan(2)) < 1e-12)
  assert.ok(Math.abs(delimited.evaluate(-1) - Math.atan(2)) < 1e-12)
})

test('every graph function of an absolute value or radical stays a call', () => {
  const names = [
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'arcsin', 'arccos', 'arctan',
    'sinh', 'cosh', 'tanh', 'sech', 'csch', 'coth',
    'ln', 'log', 'exp',
  ]

  for (const name of names) {
    const absolute = compileGraphFunction({
      id: `${name}-abs`,
      expression: `\\${name}|2x|`,
      inputFormat: 'latex',
    })
    const radical = compileGraphFunction({
      id: `${name}-sqrt`,
      expression: `\\${name}\\sqrt{x}`,
      inputFormat: 'latex',
    })

    assert.match(absolute.normalizedExpression, /\(abs\(/, name)
    assert.match(radical.normalizedExpression, /\(sqrt\(/, name)
    assert.equal(absolute.normalizedExpression.includes('*abs'), false, absolute.normalizedExpression)
    assert.equal(radical.normalizedExpression.includes('*sqrt'), false, radical.normalizedExpression)
    assert.ok(Number.isFinite(absolute.evaluate(0.25)), `${name} abs`)
    assert.ok(Number.isFinite(radical.evaluate(0.25)), `${name} sqrt`)
  }

  const multiplied = compileGraphFunction({
    id: 'product',
    expression: '2\\sin(x)',
    inputFormat: 'latex',
  })
  const adjacent = compileGraphFunction({
    id: 'adjacent',
    expression: 'x\\sin(x)',
    inputFormat: 'latex',
  })
  assert.match(multiplied.normalizedExpression, /2\*sin\(/)
  assert.match(adjacent.normalizedExpression, /x\*sin\(/)
})

test('Calcura tall delimiters and absolute-value delimiters are accepted', () => {
  const fraction = compileGraphFunction({
    id: 'f',
    expression: '\\left(\\frac{x+1}{x-1}\\right)',
    inputFormat: 'latex',
  })
  const absolute = compileGraphFunction({
    id: 'g',
    expression: '\\left|x-3\\right|',
    inputFormat: 'latex',
  })

  assert.equal(fraction.evaluate(3), 2)
  assert.equal(absolute.evaluate(1), 2)
})

test('LaTeX input still passes through the Phase 3 AST whitelist', () => {
  assert.throws(
    () =>
      compileGraphFunction({
        id: 'f',
        expression: 'x+y',
        inputFormat: 'latex',
      }),
    /Symbol "y" is not allowed/,
  )

  assert.throws(
    () =>
      compileGraphFunction({
        id: 'f',
        expression: 'x=4',
        inputFormat: 'latex',
      }),
    /not allowed/,
  )
})

test('calculus-only and unsupported LaTeX commands fail closed', () => {
  assert.throws(
    () => latexToGraphExpression('\\int x\\,dx'),
    GraphLatexError,
  )
  assert.throws(
    () => latexToGraphExpression('\\theta+x'),
    GraphLatexError,
  )
})

test('incomplete LaTeX fails closed instead of leaking commands to mathjs', () => {
  assert.throws(
    () => latexToGraphExpression('\\unknown{x}'),
    /unsupported or incomplete LaTeX command/,
  )
})

test('a variable against nested parentheses is multiplication', () => {
  const nested = compileGraphFunction({
    id: 'nested',
    expression: '3x\\left(\\left(x^{2}+3\\right)\\right)^{2}',
    inputFormat: 'latex',
    variable: 'x',
  })
  const spaced = compileGraphFunction({
    id: 'spaced',
    expression: '3z ((z^2 + 3))^2',
    inputFormat: 'latex',
    variable: 'z',
  })
  const mathjsForm = compileGraphFunction({
    id: 'mathjs',
    expression: '3*x((x^2+3))^2',
    variable: 'x',
  })

  assert.equal(nested.evaluate(1), 48)
  assert.equal(spaced.evaluate(1), 48)
  assert.equal(mathjsForm.evaluate(1), 48)
  assert.equal(nested.normalizedExpression.includes('x('), false)
  assert.match(nested.normalizedExpression, /x\*\(/)
  assert.match(spaced.normalizedExpression, /z\*\(/)
})

test('mathjs input format remains backwards compatible', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 'sin(x) + x^2',
  })

  assert.ok(Math.abs(compiled.evaluate(2) - (Math.sin(2) + 4)) < 1e-12)
  assert.equal(compiled.normalizedExpression, 'sin(x) + x^2')
})
