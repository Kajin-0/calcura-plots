# Calcura Plots

Standalone graphing lab and package-ready graph module for an eventual Calcura function-graph feature.

## Current phase: Phase 6

The project includes Capacitor/Android WebView certification in addition to the reusable package boundary established in Phase 5.

Stack:

- Vite + React + TypeScript
- `function-plot@1.25.4` for sampling/rendering/pan/zoom
- `mathjs@12.4.0` for Calcura-aligned parsing and numeric compilation
- Calcura-style LaTeX input normalization
- strict graph-expression AST whitelist
- explicit domain and excluded-point semantics
- semantic open-circle overlays for removable discontinuities
- multiple simultaneous curves
- package-ready ESM + declaration build
- Playwright Chromium browser regressions
- Capacitor 8 Android instrumentation

No Calcura source code is imported or modified.

## Public API

```ts
import {
  FunctionGraph,
  createCalcuraGraphFunctions,
  type PlotViewport,
} from 'calcura-plots'
```

An eventual Calcura caller can do:

```tsx
const functions = createCalcuraGraphFunctions([
  {
    id: 'integrand',
    latex: serializedMathfieldLatex,
  },
])

<FunctionGraph
  functions={functions}
  viewport={{
    x: [-10, 10],
    y: [-10, 10],
  }}
/>
```

The public surface intentionally does not expose parser/compiler internals.

## Android certification

The repository deliberately does not commit generated Capacitor Android boilerplate.

CI creates a fresh Android project and verifies Calcura-compatible constraints:

```text
Capacitor 8
minSdk 24
compileSdk 36
targetSdk 36
https://localhost local origin
mixed content disabled
INTERNET permission absent
cleartext traffic disabled
```

It builds one app APK + one instrumentation APK and reuses those exact binaries across the Android matrix.

The matrix deliberately separates Android OS compatibility from JavaScript/WebView compatibility:

```text
API 24  — minimum-SDK native Capacitor shell/install certification
API 31  — full graph runtime/WebView certification
API 36  — full graph runtime/WebView certification
```

Why the split: Calcura uses Vite 6's default production target, `modules`, which targets Chrome 87+ (plus the corresponding Firefox/Safari/Edge baselines). The stock AOSP WebView bundled in an API-24 emulator predates that target. Therefore `minSdk 24` is a native Android compatibility contract, not a promise that the untouched 2016 AOSP WebView can execute Calcura's current production bundle.

On the full runtime endpoints, instrumentation uses the real Capacitor WebView and checks:

- initial graph render
- local `https://localhost` origin
- multiple curves
- semantic holes
- native one-finger pan
- native two-finger pinch
- responsive orientation resize
- lifecycle resume

Native gestures are injected as Android `MotionEvent` pointer sequences through `Instrumentation.sendPointerSync()`; they are not JavaScript wheel/mouse simulations.

See `docs/PHASE6_ANDROID_CERTIFICATION.md`.

## Library artifact

```bash
npm run build:lib
npm run verify:lib
```

produces:

```text
dist-lib/
├── calcura-plots.js
├── calcura-plots.css
└── types/
    └── index.d.ts
```

React, `function-plot`, and `mathjs` stay external. The wrapper does not duplicate those runtimes in its output.

## Local validation

Android Studio is not required for the normal browser/library tests:

```bash
npm install
npm run test:unit
npm run typecheck
npm run test:public-api
npm run build
npm run verify:lib
npx playwright install chromium
npm run test:e2e
```

For Android generation/build on a machine with the Android SDK and Java installed:

```bash
npm run android:cert:prepare
npm run android:cert:verify
cd android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
```

GitHub Actions performs the emulator certification automatically.

See:

- `docs/PHASE2_AUDIT.md`
- `docs/PHASE3_ARCHITECTURE.md`
- `docs/PHASE4_INPUT_COMPATIBILITY.md`
- `docs/PHASE5_INTEGRATION_READINESS.md`
- `docs/PHASE6_ANDROID_CERTIFICATION.md`
