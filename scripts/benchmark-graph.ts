import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] || '.')
const { compileGraphFunction } = await import(pathToFileURL(root + '/src/graph/expressionAdapter.ts').href)
const { sampleGraphSegments } = await import(pathToFileURL(root + '/src/graph/sampleClip.ts').href)
const scenarios = ['sin(x)', 'x^2*sin(3x)', 'sin(30x)', 'tan(3x+0.2)', '2*x*(x^2+6)^4']
const percentile = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * q)]
for (const width of [800, 330]) for (const expression of scenarios) {
  const compile: number[] = [], sample: number[] = []
  let evaluations = 0, points = 0, segments = 0, bytes = 0
  const fn = compileGraphFunction({ id: 'benchmark', expression })
  const exclusions = fn.samplingExclusions?.(-10, 10) || []
  for (let n = 0; n < 40; n++) {
    let t = performance.now()
    compileGraphFunction({ id: 'benchmark', expression })
    compile.push(performance.now() - t)
    let calls = 0
    t = performance.now()
    const geometry = sampleGraphSegments((x: number) => { calls++; return fn.evaluate(x) }, [-10, 10], [-10, 10], width, 400, exclusions, fn.range)
    sample.push(performance.now() - t)
    evaluations = calls; points = geometry.flat().length; segments = geometry.length
    bytes = geometry.map((s: number[][]) => s.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')).join('').length
  }
  let t = performance.now(), sum = 0
  for (let n = 0; n < 100000; n++) sum += fn.evaluate(-10 + 20 * n / 100000) || 0
  console.log(JSON.stringify({ expression, width, compileP50: percentile(compile, .5), compileP95: percentile(compile, .95), samplerP50: percentile(sample, .5), samplerP95: percentile(sample, .95), evaluations, points, segments, pathBytes: bytes, evaluator100kMs: performance.now() - t, checksum: sum }))
}
