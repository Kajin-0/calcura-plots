import { useMemo, useState } from 'react'
import FunctionGraph, {
  type GraphFunctionDefinition,
  type PlotViewport,
} from './FunctionGraph'
import { PLOT_PRESETS } from './testFunctions'

const DEFAULT_PRESET = PLOT_PRESETS[0]

type ViewportKey = 'xMin' | 'xMax' | 'yMin' | 'yMax'

function viewportFromPreset(): PlotViewport {
  return {
    x: [...DEFAULT_PRESET.xDomain],
    y: [...DEFAULT_PRESET.yDomain],
  }
}

function cloneDefinition(
  definition: GraphFunctionDefinition,
): GraphFunctionDefinition {
  return {
    ...definition,
    domain: definition.domain ? [...definition.domain] : undefined,
    exclusions: definition.exclusions?.map((exclusion) => ({ ...exclusion })),
  }
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        value={value}
        step="any"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESET.id)
  const [definition, setDefinition] = useState<GraphFunctionDefinition>(() =>
    cloneDefinition(DEFAULT_PRESET.functionDefinition),
  )
  const [viewport, setViewport] = useState<PlotViewport>(viewportFromPreset)

  const functions = useMemo(() => [definition], [definition])

  const applyPreset = (presetId: string) => {
    const preset = PLOT_PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) {
      return
    }

    setSelectedPresetId(preset.id)
    setDefinition(cloneDefinition(preset.functionDefinition))
    setViewport({
      x: [...preset.xDomain],
      y: [...preset.yDomain],
    })
  }

  const updateViewport = (key: ViewportKey, value: number) => {
    setViewport((current) => {
      switch (key) {
        case 'xMin':
          return { ...current, x: [value, current.x[1]] }
        case 'xMax':
          return { ...current, x: [current.x[0], value] }
        case 'yMin':
          return { ...current, y: [value, current.y[1]] }
        case 'yMax':
          return { ...current, y: [current.y[0], value] }
      }
    })
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Standalone integration lab</p>
          <h1>Calcura Plots</h1>
          <p className="subtitle">
            Phase 4: consume Calcura-style serialized LaTeX while preserving the
            standalone graph safety and domain boundary.
          </p>
        </div>
        <span className="phase-badge">Phase 4</span>
      </header>

      <section className="control-panel" aria-label="Plot controls">
        <label className="field preset-field">
          <span>Preset</span>
          <select
            aria-label="Plot preset"
            value={selectedPresetId}
            onChange={(event) => applyPreset(event.target.value)}
          >
            {PLOT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field expression-field">
          <span>Calcura LaTeX</span>
          <input
            type="text"
            spellCheck={false}
            value={definition.expression}
            onChange={(event) => {
              setDefinition((current) => ({
                ...current,
                expression: event.target.value,
                inputFormat: 'latex',
                domain: undefined,
                exclusions: undefined,
              }))
              setSelectedPresetId('')
            }}
            aria-label="Function expression"
          />
        </label>

        <div className="viewport-controls">
          <NumberField
            label="x min"
            value={viewport.x[0]}
            onChange={(value) => updateViewport('xMin', value)}
          />
          <NumberField
            label="x max"
            value={viewport.x[1]}
            onChange={(value) => updateViewport('xMax', value)}
          />
          <NumberField
            label="y min"
            value={viewport.y[0]}
            onChange={(value) => updateViewport('yMin', value)}
          />
          <NumberField
            label="y max"
            value={viewport.y[1]}
            onChange={(value) => updateViewport('yMax', value)}
          />
        </div>
      </section>

      <section className="plot-panel" aria-label="Function plot">
        <div className="plot-heading">
          <div>
            <span className="plot-label">Current source</span>
            <code>{definition.expression || '—'}</code>
          </div>
          <span className="interaction-note">Drag to pan · scroll/pinch to zoom</span>
        </div>

        <FunctionGraph functions={functions} viewport={viewport} />
      </section>

      <footer className="lab-note">
        The lab now takes the same style of serialized LaTeX produced by Calcura's
        Mathfield. Conversion is graph-only; grading, equivalence, integration, and
        symbolic simplification remain outside this repository.
      </footer>
    </main>
  )
}
