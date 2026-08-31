import {
  FunctionGraph,
  createCalcuraGraphFunctions,
  type FunctionGraphProps,
  type PlotViewport,
} from '../../src'

const viewport: PlotViewport = {
  x: [-10, 10],
  y: [-5, 5],
}

const functions = createCalcuraGraphFunctions([
  {
    id: 'integrand',
    latex: '\\sin(x)',
    color: '#6f5ee8',
  },
  {
    id: 'comparison',
    latex: '\\cos(x)',
    color: '#0f766e',
  },
])

const props: FunctionGraphProps = {
  functions,
  viewport,
  height: 360,
  className: 'calcura-host-graph',
}

export function PublicApiConsumerFixture() {
  return <FunctionGraph {...props} />
}
