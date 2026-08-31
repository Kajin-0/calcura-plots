export interface PlotPreset {
  id: string
  label: string
  expression: string
  xDomain: [number, number]
  yDomain: [number, number]
}

export const PLOT_PRESETS: PlotPreset[] = [
  {
    id: 'parabola',
    label: 'Parabola — x^2',
    expression: 'x^2',
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sine',
    label: 'Sine — sin(x)',
    expression: 'sin(x)',
    xDomain: [-10, 10],
    yDomain: [-2, 2],
  },
  {
    id: 'sinc',
    label: 'Sinc-like — sin(x) / x',
    expression: 'sin(x) / x',
    xDomain: [-15, 15],
    yDomain: [-1.5, 1.5],
  },
  {
    id: 'reciprocal',
    label: 'Vertical asymptote — 1 / x',
    expression: '1 / x',
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'shifted-reciprocal',
    label: 'Shifted asymptote — 1 / (x - 2)',
    expression: '1 / (x - 2)',
    xDomain: [-8, 12],
    yDomain: [-10, 10],
  },
  {
    id: 'tangent',
    label: 'Repeated asymptotes — tan(x)',
    expression: 'tan(x)',
    xDomain: [-10, 10],
    yDomain: [-10, 10],
  },
  {
    id: 'sqrt',
    label: 'Restricted domain — sqrt(x)',
    expression: 'sqrt(x)',
    xDomain: [-5, 12],
    yDomain: [-2, 5],
  },
  {
    id: 'removable',
    label: 'Removable discontinuity — (x^2 - 1) / (x - 1)',
    expression: '(x^2 - 1) / (x - 1)',
    xDomain: [-8, 8],
    yDomain: [-8, 10],
  },
  {
    id: 'oscillatory',
    label: 'Oscillatory near zero — sin(1 / x)',
    expression: 'sin(1 / x)',
    xDomain: [-2, 2],
    yDomain: [-1.5, 1.5],
  },
]
