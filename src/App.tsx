import { useState } from 'react'
import FunctionGraph, { type PlotViewport } from './FunctionGraph'
import { PLOT_PRESETS } from './testFunctions'

const DEFAULT_PRESET = PLOT_PRESETS[0]

type ViewportKey = 'xMin' | 'xMax' | 'yMin' | 'yMax'

function viewportFromPreset(): PlotViewport {
  return {
    x: [...DEFAULT_PRESET.xDomain],
    y: [...DEFAULT_PRESET.yDomain],
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
  const [expression, setExpression] = useState(DEFAULT_PRESET.expression)
  const [viewport, setViewport] = useState<PlotViewport>(viewportFromPreset)

  const applyPreset = (presetId: string) => {
    const preset = PLOT_PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) {
      return
    }

    setSelectedPresetId(preset.id)
    setExpression(preset.expression)
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
            Phase 2: characterize function-plot correctness and interaction behavior before
            any Calcura integration.
          </p>
        </div>
        <span className="phase-badge">Phase 2</span>
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
          <span>f(x)</span>
          <input
            type="text"
            spellCheck={false}
            value={expression}
            onChange={(event) => {
              setExpression(event.target.value)
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
            <span className="plot-label">Current expression</span>
            <code>{expression || '—'}</code>
          </div>
          <span className="interaction-note">Drag to pan · scroll/pinch to zoom</span>
        </div>

        <FunctionGraph expression={expression} viewport={viewport} />
      </section>

      <footer className="lab-note">
        Phase 2 intentionally tests function-plot as a package. Calcura LaTeX parsing,
        evaluator ownership, and a permanent graph contract remain out of scope.
      </footer>
    </main>
  )
}
