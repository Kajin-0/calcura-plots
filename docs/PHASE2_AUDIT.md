# Phase 2 Capability Audit

Date: 2026-08-31

Backend under test: `function-plot@1.25.4`

Execution environment: GitHub Actions, Ubuntu runner, Node.js 22, Playwright Chromium.

## Result

**13 / 13 browser tests passed.**

The Phase 2 evidence supports continuing with `function-plot` as the candidate rendering backend, with one explicit caveat: removable discontinuities are not represented semantically by the package and must be handled by Calcura's future graph adapter/domain layer.

## Verified behavior

| Capability | Result |
| --- | --- |
| Smooth polynomial/trigonometric plots | Pass |
| `1/x` vertical asymptote splitting | Pass |
| `1/(x-2)` vertical asymptote splitting | Pass |
| `tan(x)` multiple asymptote splitting | Pass |
| `sqrt(x)` restricted real-domain rendering | Pass |
| Invalid-expression error handling + recovery | Pass |
| Invalid viewport rejection + recovery | Pass |
| Responsive SVG rebuild on resize | Pass |
| Wheel zoom changes plotted geometry | Pass |
| Drag pan changes plotted geometry | Pass |
| 390 px mobile viewport containment | Pass |
| Removable-hole behavior characterized | Known limitation |
| `sin(1/x)` behavior characterized | Pass / strong segmentation |

## Pathology measurements

### Removable discontinuity

Expression:

```text
(x^2 - 1) / (x - 1)
```

Observed:

```json
{"pathCount":1,"explicitHoleMarkers":0}
```

This is mathematically important. The original expression is undefined at `x = 1`, even though it simplifies algebraically to `x + 1`.

`function-plot@1.25.4` renders one continuous curve and emits no explicit open-circle marker. Therefore the package alone is **not sufficient to preserve removable-domain holes**.

Required future policy:

- keep the original expression/domain semantics;
- do not simplify away excluded points before graphing;
- allow the Calcura graph adapter to supply explicit exclusions/hole markers;
- treat the renderer as a renderer/sampler, not as the source of mathematical domain truth.

### Oscillatory origin

Expression:

```text
sin(1 / x)
```

Observed:

```json
{"pathCount":30,"firstPathLength":15382}
```

The backend aggressively splits the curve near the undefined/rapidly oscillatory origin rather than emitting one simple path through `x = 0`. That is substantially better behavior than a naive fixed-step polyline renderer.

## Phase 2 decision

Continue with `function-plot` rather than starting a custom graph engine.

The next architectural step should not be more renderer work. It should be a **Calcura-owned expression/domain adapter** that:

1. accepts the future Calcura graph contract;
2. validates the expression;
3. preserves original domain exclusions;
4. passes a safe evaluator or compatible expression to `function-plot`;
5. overlays semantic holes/excluded points when necessary;
6. keeps `function-plot` hidden behind the `FunctionGraph` component.

Actual Android/Capacitor WebView profiling and native touch/pinch validation remain separate integration work; the Phase 2 mobile test is browser viewport containment, not an Android WebView certification.
