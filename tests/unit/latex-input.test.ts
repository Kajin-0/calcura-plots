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

test('mathjs input format remains backwards compatible', () => {
  const compiled = compileGraphFunction({
    id: 'f',
    expression: 'sin(x) + x^2',
  })

  assert.ok(Math.abs(compiled.evaluate(2) - (Math.sin(2) + 4)) < 1e-12)
  assert.equal(compiled.normalizedExpression, 'sin(x) + x^2')
})
