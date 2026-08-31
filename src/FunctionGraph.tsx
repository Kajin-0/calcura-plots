import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import functionPlot, {
  type Chart,
  type FunctionPlotDatum,
  type FunctionPlotDatumScope,
  type FunctionPlotOptions,
} from 'function-plot'
import {
  compileGraphFunctions,
  GraphExpressionError,
} from './graph/expressionAdapter'
import { renderSemanticOverlays } from './graph/semanticOverlay'
import type {
  CompiledGraphFunction,
  GraphFunctionDefinition,
  PlotViewport,
} from './graph/types'

export type {
  GraphExclusion,
  GraphFunctionDefinition,
  PlotViewport,
} from './graph/types'

interface FunctionGraphProps {
  functions: GraphFunctionDefinition[]
  viewport: PlotViewport
  height?: number
}

type EventedChart = Chart & {
  on: (event: string, listener: () => void) => EventedChart
  removeListener: (event: string, listener: () => void) => EventedChart
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function viewportKey(viewport: PlotViewport): string {
  return [...viewport.x, ...viewport.y].join('|')
}

export default function FunctionGraph({
  functions,
  viewport,
  height = 420,
}: FunctionGraphProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<FunctionPlotOptions | null>(null)
  const chartRef = useRef<EventedChart | null>(null)
  const overlayListenerRef = useRef<(() => void) | null>(null)
  const compiledFunctionsRef = useRef<CompiledGraphFunction[]>([])
  const previousViewportKeyRef = useRef<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  const compilation = useMemo(() => {
    try {
      return {
        compiled: compileGraphFunctions(functions),
        error: null,
      }
    } catch (error) {
      return {
        compiled: [] as CompiledGraphFunction[],
        error:
          error instanceof GraphExpressionError
            ? error.message
            : getErrorMessage(error),
      }
    }
  }, [functions])

  compiledFunctionsRef.current = compilation.compiled

  const draw = useCallback(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    if (compilation.error) {
      host.replaceChildren()
      setRenderError(compilation.error)
      return
    }

    const [xMin, xMax] = viewport.x
    const [yMin, yMax] = viewport.y

    if (!(xMin < xMax) || !(yMin < yMax)) {
      setRenderError('Viewport minimums must be smaller than maximums.')
      host.replaceChildren()
      return
    }

    const width = Math.max(320, Math.floor(host.getBoundingClientRect().width))
    const nextViewportKey = viewportKey(viewport)
    const viewportChanged = previousViewportKeyRef.current !== nextViewportKey

    const options: FunctionPlotOptions =
      optionsRef.current ??
      ({
        target: host,
      } satisfies FunctionPlotOptions)

    options.target = host
    options.width = width
    options.height = height
    options.grid = true
    options.disableZoom = false
    options.tip = {
      xLine: true,
      yLine: true,
    }

    if (!optionsRef.current || viewportChanged) {
      options.xAxis = {
        domain: [xMin, xMax],
        label: 'x',
        position: 'sticky',
      }
      options.yAxis = {
        domain: [yMin, yMax],
        label: 'y',
        position: 'sticky',
      }
      previousViewportKeyRef.current = nextViewportKey
    }

    options.data = compilation.compiled.map(
      (compiled): FunctionPlotDatum => ({
        fn: (scope: FunctionPlotDatumScope) =>
          compiled.evaluate(Number(scope.x)),
        fnType: 'linear',
        graphType: 'polyline',
        sampler: 'builtIn',
        range: compiled.definition.domain,
        color: compiled.definition.color,
      }),
    )

    optionsRef.current = options

    try {
      const chart = functionPlot(options) as EventedChart

      if (chartRef.current !== chart) {
        if (chartRef.current && overlayListenerRef.current) {
          chartRef.current.removeListener('after:draw', overlayListenerRef.current)
        }

        const listener = () => {
          const currentHost = hostRef.current
          if (currentHost) {
            renderSemanticOverlays(currentHost, chart, compiledFunctionsRef.current)
          }
        }

        chart.on('after:draw', listener)
        chartRef.current = chart
        overlayListenerRef.current = listener
      }

      renderSemanticOverlays(host, chart, compilation.compiled)
      setRenderError(null)
    } catch (error) {
      host.replaceChildren()
      setRenderError(getErrorMessage(error))
    }
  }, [compilation, height, viewport])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    draw()

    const resizeObserver = new ResizeObserver(() => {
      draw()
    })

    resizeObserver.observe(host)

    return () => {
      resizeObserver.disconnect()
    }
  }, [draw])

  useLayoutEffect(() => {
    return () => {
      if (chartRef.current && overlayListenerRef.current) {
        chartRef.current.removeListener('after:draw', overlayListenerRef.current)
      }

      // React 18 StrictMode intentionally runs an effect cleanup/setup cycle in
      // development. Clear both refs so the next setup knows the listener is
      // detached and reattaches it to the cached function-plot Chart instance.
      chartRef.current = null
      overlayListenerRef.current = null
    }
  }, [])

  const accessibleExpression = functions
    .map((definition) => definition.expression)
    .join(', ')

  return (
    <div className="graph-shell">
      <div
        ref={hostRef}
        className="graph-host"
        data-testid="graph-host"
        role="img"
        aria-label={'Graph of ' + accessibleExpression}
      />
      {renderError ? (
        <div className="graph-error" role="alert">
          Plot error: {renderError}
        </div>
      ) : null}
    </div>
  )
}
