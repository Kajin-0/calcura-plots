import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createGraphSampler } from '../dist-lib/calcura-plots.js'
import type { GraphFunctionDefinition } from '../src/index'

const input = process.argv[2]
const baseline = process.argv[3]
const rows = JSON.parse(readFileSync(input, 'utf8')).rows as Array<{ family: string; seed: number; title: string; status: string; definition?: GraphFunctionDefinition }>
let makeSampler = createGraphSampler
if (baseline) {
  const { compileGraphFunction } = await import(pathToFileURL(resolve(baseline, 'src/graph/expressionAdapter.ts')).href)
  const { sampleGraphSegments } = await import(pathToFileURL(resolve(baseline, 'src/graph/sampleClip.ts')).href)
  makeSampler = definition => {
    const compiled = compileGraphFunction(definition)
    return { evaluate: compiled.evaluate, sample: (viewport, width, height) => sampleGraphSegments(compiled.evaluate,
      definition.domain ? [Math.max(definition.domain[0], viewport.x[0]), Math.min(definition.domain[1], viewport.x[1])] : viewport.x,
      viewport.y, width, height, definition.exclusions?.map(e => e.x)) }
  }
}
const counts = { generated: rows.length, derived: 0, accepted: 0, unsupported: 0, compileFailures: 0, visible: 0, noVisibleReference: 0, missingGeometry: 0, errors: 0, isolatedEvaluations: 0 }
const failures: object[] = [], unsupported: object[] = []
for (const row of rows) {
  if (!row.definition) { counts.errors++; failures.push(row); continue }
  counts.derived++
  let compiled: ReturnType<typeof makeSampler>
  try { compiled = makeSampler(row.definition); counts.accepted++ }
  catch (error) {
    const message = String(error)
    if (/not supported|Unsupported.*command|not allowed/.test(message)) { counts.unsupported++; unsupported.push({ ...row, error: message }) }
    else { counts.compileFailures++; failures.push({ ...row, error: message }) }
    continue
  }
  const geometry = compiled.sample({ x: [-10, 10], y: [-10, 10] }, 330, 300)
  const points = geometry.flat()
  let visible = 0, missing = 0
  for (let i = 0; i <= 2000; i++) {
    const x = -10 + i / 100, y = compiled.evaluate(x)
    if (!Number.isFinite(y) || Math.abs(y) > 10) continue
    if (!Number.isFinite(compiled.evaluate(x + 1e-7)) && !Number.isFinite(compiled.evaluate(x - 1e-7))) { counts.isolatedEvaluations++; continue }
    visible++
    let best = Infinity
    const sx = 330 / 20, sy = 300 / 20
    for (const segment of geometry) {
      if (x < segment[0][0] - 2 / sx || x > segment[segment.length - 1][0] + 2 / sx) continue
      for (let j = 1; j < segment.length; j++) {
        const a = segment[j - 1], b = segment[j]
        if (x < a[0] - 2 / sx || x > b[0] + 2 / sx) continue
        const dx = (b[0] - a[0]) * sx, dy = (b[1] - a[1]) * sy
        const px = (x - a[0]) * sx, py = (y - a[1]) * sy
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)))
        best = Math.min(best, Math.hypot(px - t * dx, py - t * dy))
      }
    }
    if (best > 1.25) missing++
  }
  if (visible) {
    counts.visible++
    if (!points.length || missing > 2) { counts.missingGeometry++; failures.push({ family: row.family, seed: row.seed, title: row.title, definition: row.definition, visible, missing, points: points.length }) }
  } else counts.noVisibleReference++
}
const report = { baseline: baseline || 'candidate public API', counts, families: [...new Set(rows.map(r => r.family))], failures, unsupported }
writeFileSync(input + (baseline ? '.before' : '.after') + '.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report, failures: failures.slice(0,10), unsupported: unsupported.slice(0,10) }))
if (!baseline) {
  // Generator guard failures are reported, never relabeled graph passes.
  // This graph campaign is forbidden from repairing mathematical generation.
  assert.equal(counts.compileFailures, 0)
  assert.equal(counts.missingGeometry, 0)
}
