import type { GraphFunctionDefinition } from './graph/types'

export interface PlotPreset {
  id: string
  label: string
  functionDefinition: GraphFunctionDefinition
  xDomain: [number, number]
  yDomain: [number, number]
}

export const PLOT_PRESETS: PlotPreset[] = [
  {
    id: 'parabola',
    label: 'Parabola — x^2',
    functionDefinition: {
      id: 'f',
      expression: 'x^2',
      color: '#6f5ee8',
    },
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sine',
    label: 'Sine — sin(x)',
    functionDefinition: {
      id: 'f',
      expression: 'sin(x)',
      color: '#6f5ee8',
    },
    xDomain: [-10, 10],
    yDomain: [-2, 2],
  },
  {
    id: 'sinc',
    label: 'Sinc-like — sin(x) / x',
    functionDefinition: {
      id: 'f',
      expression: 'sin(x) / x',
      color: '#6f5ee8',
    },
    xDomain: [-15, 15],
    yDomain: [-1.5, 1.5],
  },
  {
    id: 'reciprocal',
    label: 'Vertical asymptote — 1 / x',
    functionDefinition: {
      id: 'f',
      expression: '1 / x',
      color: '#6f5ee8',
    },
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'shifted-reciprocal',
    label: 'Shifted asymptote — 1 / (x - 2)',
    functionDefinition: {
      id: 'f',
      expression: '1 / (x - 2)',
      color: '#6f5ee8',
    },
    xDomain: [-8, 12],
    yDomain: [-10, 10],
  },
  {
    id: 'tangent',
    label: 'Repeated asymptotes — tan(x)',
    functionDefinition: {
      id: 'f',
      expression: 'tan(x)',
      color: '#6f5ee8',
    },
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sqrt',
    label: 'Restricted domain — sqrt(x)',
    functionDefinition: {
      id: 'f',
      expression: 'sqrt(x)',
      domain: [0, 12],
      color: '#6f5ee8',
    },
    xDomain: [-5, 12],
    yDomain: [-2, 5],
  },
  {
    id: 'removable',
    label: 'Removable discontinuity — (x^2 - 1) / (x - 1)',
    functionDefinition: {
      id: 'f',
      expression: '(x^2 - 1) / (x - 1)',
      exclusions: [{ x: 1, y: 2 }],
      color: '#6f5ee8',
    },
    xDomain: [-8, 8],
    yDomain: [-8, 10],
  },
  {
    id: 'oscillatory',
    label: 'Oscillatory near zero — sin(1 / x)',
    functionDefinition: {
      id: 'f',
      expression: 'sin(1 / x)',
      exclusions: [{ x: 0 }],
      color: '#6f5ee8',
    },
    xDomain: [-2, 2],
    yDomain: [-1.5, 1.5],
  },
]
