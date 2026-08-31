import type { GraphFunctionDefinition } from './graph/types'

export interface PlotPreset {
  id: string
  label: string
  functionDefinitions: GraphFunctionDefinition[]
  xDomain: [number, number]
  yDomain: [number, number]
}

const latexFunction = (
  id: string,
  expression: string,
  extras: Omit<
    GraphFunctionDefinition,
    'id' | 'expression' | 'inputFormat'
  > = {},
): GraphFunctionDefinition => ({
  id,
  expression,
  inputFormat: 'latex',
  color: '#6f5ee8',
  ...extras,
})

const one = (
  expression: string,
  extras: Omit<
    GraphFunctionDefinition,
    'id' | 'expression' | 'inputFormat'
  > = {},
): GraphFunctionDefinition[] => [latexFunction('f', expression, extras)]

export const PLOT_PRESETS: PlotPreset[] = [
  {
    id: 'parabola',
    label: 'Parabola — x²',
    functionDefinitions: one('x^2'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sine',
    label: 'Sine — sin(x)',
    functionDefinitions: one('\\sin(x)'),
    xDomain: [-10, 10],
    yDomain: [-2, 2],
  },
  {
    id: 'sinc',
    label: 'Sinc-like — sin(x) / x',
    functionDefinitions: one('\\frac{\\sin(x)}{x}'),
    xDomain: [-15, 15],
    yDomain: [-1.5, 1.5],
  },
  {
    id: 'reciprocal',
    label: 'Vertical asymptote — 1 / x',
    functionDefinitions: one('\\frac{1}{x}'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'shifted-reciprocal',
    label: 'Shifted asymptote — 1 / (x - 2)',
    functionDefinitions: one('\\frac{1}{x-2}'),
    xDomain: [-8, 12],
    yDomain: [-10, 10],
  },
  {
    id: 'tangent',
    label: 'Repeated asymptotes — tan(x)',
    functionDefinitions: one('\\tan(x)'),
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sqrt',
    label: 'Restricted domain — sqrt(x)',
    functionDefinitions: one('\\sqrt{x}', {
      domain: [0, 12],
    }),
    xDomain: [-5, 12],
    yDomain: [-2, 5],
  },
  {
    id: 'removable',
    label: 'Removable discontinuity — (x² - 1) / (x - 1)',
    functionDefinitions: one('\\frac{x^2-1}{x-1}', {
      exclusions: [{ x: 1, y: 2 }],
    }),
    xDomain: [-8, 8],
    yDomain: [-8, 10],
  },
  {
    id: 'oscillatory',
    label: 'Oscillatory near zero — sin(1 / x)',
    functionDefinitions: one('\\sin(\\frac{1}{x})', {
      exclusions: [{ x: 0 }],
    }),
    xDomain: [-2, 2],
    yDomain: [-1.5, 1.5],
  },
  {
    id: 'multi-curve',
    label: 'Multiple curves — sin(x) and removable line',
    functionDefinitions: [
      latexFunction('wave', '\\sin(x)', {
        color: '#6f5ee8',
      }),
      latexFunction('line-with-hole', '\\frac{x^2-1}{x-1}', {
        exclusions: [{ x: 1, y: 2 }],
        color: '#0f766e',
      }),
    ],
    xDomain: [-6, 6],
    yDomain: [-6, 8],
  },
]
