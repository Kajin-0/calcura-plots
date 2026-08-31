import type { GraphFunctionDefinition } from './graph/types'

export interface PlotPreset {
  id: string
  label: string
  functionDefinition: GraphFunctionDefinition
  xDomain: [number, number]
  yDomain: [number, number]
}

const latexFunction = (
  expression: string,
  extras: Omit<GraphFunctionDefinition, 'id' | 'expression' | 'inputFormat'> = {},
): GraphFunctionDefinition => ({
  id: 'f',
  expression,
  inputFormat: 'latex',
  color: '#6f5ee8',
  ...extras,
})

export const PLOT_PRESETS: PlotPreset[] = [
  {
    id: 'parabola',
    label: 'Parabola — x²',
    functionDefinition: latexFunction('x^2'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sine',
    label: 'Sine — sin(x)',
    functionDefinition: latexFunction('\\sin(x)'),
    xDomain: [-10, 10],
    yDomain: [-2, 2],
  },
  {
    id: 'sinc',
    label: 'Sinc-like — sin(x) / x',
    functionDefinition: latexFunction('\\frac{\\sin(x)}{x}'),
    xDomain: [-15, 15],
    yDomain: [-1.5, 1.5],
  },
  {
    id: 'reciprocal',
    label: 'Vertical asymptote — 1 / x',
    functionDefinition: latexFunction('\\frac{1}{x}'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'shifted-reciprocal',
    label: 'Shifted asymptote — 1 / (x - 2)',
    functionDefinition: latexFunction('\\frac{1}{x-2}'),
    xDomain: [-8, 12],
    yDomain: [-10, 10],
  },
  {
    id: 'tangent',
    label: 'Repeated asymptotes — tan(x)',
    functionDefinition: latexFunction('\\tan(x)'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sqrt',
    label: 'Restricted domain — sqrt(x)',
    functionDefinition: latexFunction('\\sqrt{x}', {
      domain: [0, 12],
    }),
    xDomain: [-5, 12],
    yDomain: [-2, 5],
  },
  {
    id: 'removable',
    label: 'Removable discontinuity — (x² - 1) / (x - 1)',
    functionDefinition: latexFunction('\\frac{x^2-1}{x-1}', {
      exclusions: [{ x: 1, y: 2 }],
    }),
    xDomain: [-8, 8],
    yDomain: [-8, 10],
  },
  {
    id: 'oscillatory',
    label: 'Oscillatory near zero — sin(1 / x)',
    functionDefinition: latexFunction('\\sin(\\frac{1}{x})', {
      exclusions: [{ x: 0 }],
    }),
    xDomain: [-2, 2],
    yDomain: [-1.5, 1.5],
  },
]
