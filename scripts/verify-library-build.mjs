import { readFile, stat } from 'node:fs/promises'

const expectedFiles = [
  'dist-lib/calcura-plots.js',
  'dist-lib/calcura-plots.css',
  'dist-lib/types/index.d.ts',
]

for (const path of expectedFiles) {
  const metadata = await stat(path)
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`Expected non-empty library artifact: ${path}`)
  }
}

const js = await readFile('dist-lib/calcura-plots.js', 'utf8')
const css = await readFile('dist-lib/calcura-plots.css', 'utf8')
const declarations = await readFile('dist-lib/types/index.d.ts', 'utf8')

for (const dependency of ['function-plot', 'mathjs', 'react']) {
  if (!js.includes(dependency)) {
    throw new Error(
      `Expected library output to retain external import for ${dependency}.`,
    )
  }
}

if (js.includes('Standalone integration lab') || js.includes('Calcura Plots</h1>')) {
  throw new Error('Demo application code leaked into the library artifact.')
}

if (!css.includes('.calcura-function-graph')) {
  throw new Error('Library stylesheet is missing the scoped graph root selector.')
}

for (const publicName of [
  'FunctionGraph',
  'FunctionGraphProps',
  'createCalcuraGraphFunction',
  'createCalcuraGraphFunctions',
]) {
  if (!declarations.includes(publicName)) {
    throw new Error(`Public declaration surface is missing ${publicName}.`)
  }
}

const jsSize = (await stat('dist-lib/calcura-plots.js')).size
const cssSize = (await stat('dist-lib/calcura-plots.css')).size

if (jsSize > 100 * 1024) {
  throw new Error(
    `Library wrapper grew unexpectedly large: ${jsSize} bytes (> 100 KiB).`,
  )
}

if (cssSize > 16 * 1024) {
  throw new Error(
    `Library stylesheet grew unexpectedly large: ${cssSize} bytes (> 16 KiB).`,
  )
}

console.log(
  JSON.stringify({
    libraryBuild: 'ok',
    jsBytes: jsSize,
    cssBytes: cssSize,
    externalRuntimeDependencies: ['react', 'function-plot', 'mathjs'],
  }),
)
