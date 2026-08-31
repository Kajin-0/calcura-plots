import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import functionPlot, { type FunctionPlotOptions } from 'function-plot'

export interface PlotViewport {
  x: [number, number]
  y: [number, number]
}

interface FunctionGraphProps {
  expression: string
  viewport: PlotViewport
  height?: number
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export default function FunctionGraph({
  expression,
  viewport,
  height = 420,
}: FunctionGraphProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<FunctionPlotOptions | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  const draw = useCallback(() => {
    const host = hostRef.current
    if (!host) {
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
    options.data = [
      {
        fn: expression,
        fnType: 'linear',
        graphType: 'polyline',
        sampler: 'builtIn',
      },
    ]

    optionsRef.current = options

    try {
      functionPlot(options)
      setRenderError(null)
    } catch (error) {
      host.replaceChildren()
      setRenderError(getErrorMessage(error))
    }
  }, [expression, height, viewport])

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

  return (
    <div className="graph-shell">
      <div
        ref={hostRef}
        className="graph-host"
        role="img"
        aria-label={'Graph of ' + expression}
      />
      {renderError ? (
        <div className="graph-error" role="alert">
          Plot error: {renderError}
        </div>
      ) : null}
    </div>
  )
}
