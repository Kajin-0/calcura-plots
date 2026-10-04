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
import './graph/FunctionGraph.css'
import {
  compileGraphFunctions,
  GraphExpressionError,
} from './graph/expressionAdapter'
import { ADAPTIVE_POLYLINE, type AdaptiveDatum } from './graph/adaptivePolyline'
import { renderSemanticOverlays } from './graph/semanticOverlay'
import type {
  CompiledGraphFunction,
  GraphFunctionDefinition,
  PlotViewport,
} from './graph/types'

export type {
  GraphDomainEndpoint,
  GraphExclusion,
  GraphFunctionDefinition,
  PlotViewport,
} from './graph/types'

export interface FunctionGraphProps {
  functions: GraphFunctionDefinition[]
  viewport: PlotViewport
  height?: number
  className?: string
}

type SelectedTipPoint = {
  x: number
  y: number
  index: number
}

type PlotTip = {
  move: (coordinates: { x: number; y: number }) => void
  hide: () => void
}

type EventedChart = Chart & {
  on: (
    event: string,
    listener: (...args: any[]) => void,
  ) => EventedChart
  removeListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => EventedChart
  removeAllListeners: (event?: string) => EventedChart
  tip: PlotTip
  draw?: () => void
  __calcuraDrawCoalesced?: boolean
  __calcuraDrawFrame?: number
}

/**
 * function-plot redraws the whole chart on every zoom event, which fires many
 * times per frame during a drag. Keep the latest scale and paint once per frame.
 * The scheduled draw reads the chart's current scale, so skipped events are not lost.
 */
function coalesceChartDraw(chart: EventedChart): void {
  if (chart.__calcuraDrawCoalesced || typeof chart.draw !== 'function') return
  if (typeof requestAnimationFrame !== 'function') return
  const rawDraw = chart.draw.bind(chart)
  chart.__calcuraDrawCoalesced = true
  chart.draw = () => {
    if (chart.__calcuraDrawFrame) return
    chart.__calcuraDrawFrame = requestAnimationFrame(() => {
      chart.__calcuraDrawFrame = 0
      rawDraw()
    })
  }
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

function functionSetKey(functions: GraphFunctionDefinition[]): string {
  return JSON.stringify(functions)
}

export default function FunctionGraph({
  functions,
  viewport,
  height = 420,
  className,
}: FunctionGraphProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<FunctionPlotOptions | null>(null)
  const chartRef = useRef<EventedChart | null>(null)
  const overlayListenerRef = useRef<(() => void) | null>(null)
  const tipUpdateListenerRef = useRef<
    ((selection: SelectedTipPoint) => void) | null
  >(null)
  const clickSurfaceRef = useRef<SVGRectElement | null>(null)
  const clickListenerRef = useRef<((event: MouseEvent) => void) | null>(null)
  const selectedTipRef = useRef<SelectedTipPoint | null>(null)
  const compiledFunctionsRef = useRef<CompiledGraphFunction[]>([])
  const previousViewportKeyRef = useRef<string | null>(null)
  const previousFunctionSetKeyRef = useRef<string | null>(null)
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

  const currentFunctionSetKey = useMemo(
    () => functionSetKey(functions),
    [functions],
  )

  compiledFunctionsRef.current = compilation.compiled

  const draw = useCallback(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const functionSetChanged =
      previousFunctionSetKeyRef.current !== null &&
      previousFunctionSetKeyRef.current !== currentFunctionSetKey

    if (functionSetChanged) {
      selectedTipRef.current = null
      chartRef.current?.tip.hide()
    }
    previousFunctionSetKeyRef.current = currentFunctionSetKey

    if (compilation.error) {
      selectedTipRef.current = null
      host.replaceChildren()
      setRenderError(compilation.error)
      return
    }

    const [xMin, xMax] = viewport.x
    const [yMin, yMax] = viewport.y

    if (!(xMin < xMax) || !(yMin < yMax)) {
      selectedTipRef.current = null
      setRenderError('Viewport minimums must be smaller than maximums.')
      host.replaceChildren()
      return
    }

    const hostWidth = Math.floor(host.getBoundingClientRect().width)
    // function-plot subtracts 40+20px axis margins. A too-narrow host yields a
    // non-positive inner width and an empty polyline that throws on d[0].
    if (hostWidth < 80) {
      return
    }

    // function-plot 1.25.4 hard-codes 40px left / 20px right internal margins.
    // Render the SVG 20px narrower so the Cartesian plot rectangle has equal
    // visual space on both sides of the host.
    const width = Math.max(1, hostWidth - 20)
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
      (compiled): AdaptiveDatum => {
        return {
          fn: (scope: FunctionPlotDatumScope) => compiled.evaluate(Number(scope.x)),
          fnType: 'linear',
          graphType: ADAPTIVE_POLYLINE,
          sampler: 'builtIn',
          range: compiled.definition.domain,
          color: compiled.definition.color,
          calcuraExclusions: compiled.resolvedExclusions.map(exclusion => exclusion.x),
          calcuraEvaluate: compiled.evaluate,
          calcuraRange: compiled.range,
          calcuraSamplingExclusions: compiled.samplingExclusions,
        }
      },
    )

    optionsRef.current = options

    try {
      const chart = functionPlot(options) as EventedChart
      coalesceChartDraw(chart)

      if (chartRef.current !== chart) {
        if (chartRef.current && overlayListenerRef.current) {
          chartRef.current.removeListener('after:draw', overlayListenerRef.current)
        }
        if (chartRef.current && tipUpdateListenerRef.current) {
          chartRef.current.removeListener('tip:update', tipUpdateListenerRef.current)
        }
        if (clickSurfaceRef.current && clickListenerRef.current) {
          clickSurfaceRef.current.removeEventListener('click', clickListenerRef.current)
        }

        // function-plot's default tip is a hover probe. Its zoom handler also
        // emits a synthetic mousemove after every pan/zoom, which changes the
        // displayed point while the user is dragging. Calcura uses explicit
        // selection semantics instead: only a click/tap may choose a point.
        chart.removeAllListeners('mousemove')
        chart.removeAllListeners('mouseover')
        chart.removeAllListeners('mouseout')

        const tipUpdateListener = (selection: SelectedTipPoint) => {
          selectedTipRef.current = selection

          const tipNode = hostRef.current?.querySelector<SVGGElement>('g.inner-tip')
          if (tipNode) {
            tipNode.setAttribute('data-selected-x', String(selection.x))
            tipNode.setAttribute('data-selected-y', String(selection.y))
            tipNode.setAttribute('data-selected-index', String(selection.index))
          }
        }

        const listener = () => {
          const currentHost = hostRef.current
          if (currentHost) {
            renderSemanticOverlays(currentHost, chart, compiledFunctionsRef.current)
          }

          const selected = selectedTipRef.current
          if (selected) {
            chart.tip.move({ x: selected.x, y: selected.y })
          }
        }

        chart.on('tip:update', tipUpdateListener)
        chart.on('after:draw', listener)
        chartRef.current = chart
        tipUpdateListenerRef.current = tipUpdateListener
        overlayListenerRef.current = listener
      }

      const clickSurface = host.querySelector<SVGRectElement>('.zoom-and-drag')
      if (clickSurfaceRef.current !== clickSurface) {
        if (clickSurfaceRef.current && clickListenerRef.current) {
          clickSurfaceRef.current.removeEventListener('click', clickListenerRef.current)
        }

        clickSurfaceRef.current = clickSurface
        clickListenerRef.current = null

        if (clickSurface) {
          const clickListener = (event: MouseEvent) => {
            if (event.button !== 0) {
              return
            }

            const xScale = chart.meta.xScale
            const yScale = chart.meta.yScale
            if (!xScale || !yScale) {
              return
            }

            const bounds = clickSurface.getBoundingClientRect()
            if (bounds.width <= 0 || bounds.height <= 0) {
              return
            }

            const localX = event.clientX - bounds.left
            const localY = event.clientY - bounds.top

            selectedTipRef.current = null
            chart.tip.move({
              x: xScale.invert(localX),
              y: yScale.invert(localY),
            })
          }

          clickSurface.addEventListener('click', clickListener)
          clickListenerRef.current = clickListener
        }
      }

      renderSemanticOverlays(host, chart, compilation.compiled)

      const selected = selectedTipRef.current
      if (selected) {
        chart.tip.move({ x: selected.x, y: selected.y })
      } else {
        chart.tip.hide()
      }

      setRenderError(null)
    } catch (error) {
      selectedTipRef.current = null
      optionsRef.current = null
      chartRef.current = null
      host.replaceChildren()
      setRenderError(getErrorMessage(error))
    }
  }, [compilation, currentFunctionSetKey, height, viewport])

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
      if (chartRef.current?.__calcuraDrawFrame) {
        cancelAnimationFrame(chartRef.current.__calcuraDrawFrame)
        chartRef.current.__calcuraDrawFrame = 0
      }
      if (chartRef.current && overlayListenerRef.current) {
        chartRef.current.removeListener('after:draw', overlayListenerRef.current)
      }
      if (chartRef.current && tipUpdateListenerRef.current) {
        chartRef.current.removeListener('tip:update', tipUpdateListenerRef.current)
      }
      if (clickSurfaceRef.current && clickListenerRef.current) {
        clickSurfaceRef.current.removeEventListener('click', clickListenerRef.current)
      }

      // React 18 StrictMode intentionally runs an effect cleanup/setup cycle in
      // development. Clear refs so the next setup knows the listeners are
      // detached and reattaches them to the cached function-plot Chart instance.
      chartRef.current = null
      overlayListenerRef.current = null
      tipUpdateListenerRef.current = null
      clickSurfaceRef.current = null
      clickListenerRef.current = null
      selectedTipRef.current = null
    }
  }, [])

  const accessibleExpression = functions
    .map((definition) => definition.expression)
    .join(', ')

  const shellClassName = className
    ? `calcura-function-graph ${className}`
    : 'calcura-function-graph'

  return (
    <div className={shellClassName} style={{ minHeight: height }}>
      <div
        ref={hostRef}
        className="graph-host"
        style={{ minHeight: height }}
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
