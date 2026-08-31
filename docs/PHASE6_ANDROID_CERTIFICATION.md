# Phase 6: Capacitor / Android Certification

Date: 2026-08-31

## Objective

Certify the package-ready graph module inside the same deployment class Calcura uses: Capacitor 8 on Android.

Calcura itself remains unchanged.

## Production constraints mirrored from Calcura

Reference Calcura commit:

```text
49c0b52f3941ce481e015d5faa413732d3bb5e63
```

| Constraint | Calcura | calcura-plots cert |
| --- | --- | --- |
| Capacitor | 8.x | 8.0.0 pinned |
| minSdk | 24 | 24 |
| compileSdk | 36 | 36 |
| targetSdk | 36 | 36 |
| local Android scheme | HTTPS | HTTPS |
| mixed content | disabled | disabled |
| INTERNET permission | absent | absent |
| cleartext traffic | disabled | disabled |

The certification app uses the distinct application id `com.calcura.plotslab`, so it cannot collide with Calcura.

## Clean generated Android project

The repository does not commit a generated `android/` project.

Every certification run performs:

```text
Vite production build
      ↓
cap add android
      ↓
cap sync android
      ↓
patch generated project to Calcura constraints
      ↓
remove Capacitor's stock template instrumentation test
      ↓
static contract verification
      ↓
:app:assembleDebug
:app:assembleDebugAndroidTest
      ↓
reuse the exact same APK pair across the emulator matrix
```

This tests a fresh Capacitor project on every run without polluting the reusable graph repository with generated Android boilerplate.

## Android OS support is not WebView-version support

Calcura declares `minSdk 24`. That means the native Android package is allowed to install on Android API 24.

Calcura's Vite configuration does not override `build.target`. Vite 6.2.0 resolves its default `modules` target to:

```text
es2020
Chrome 87+
Edge 88+
Firefox 78+
Safari 14+
```

The stock AOSP WebViews bundled in old emulator system images predate that browser target. Phase 6 therefore does not use an obsolete stock WebView as evidence against the graph module.

The matrix is:

```text
API 24  — native minSdk / Capacitor shell certification
API 36  — full graph runtime / current Android WebView certification
```

Browser-level graph correctness and interaction behavior are independently covered by the Playwright Chromium regression suite.

## API 24 minimum-SDK certification

The minimum endpoint verifies that the exact built APK pair:

1. installs on API 24;
2. launches the generated Capacitor `MainActivity`;
3. creates Capacitor's actual `WebView`;
4. loads the packaged shell;
5. uses `https://localhost`;
6. contains the packaged Vite module entry.

It intentionally does not claim that the original API-24 AOSP WebView can execute Calcura's Chrome-87+ production bundle.

## API 36 full WebView runtime certification

The full endpoint verifies inside Capacitor's actual `WebView`:

1. initial graph render;
2. local `https://localhost` origin;
3. no graph error;
4. the React UI switches to the two-curve preset;
5. both curves render;
6. semantic hole metadata is preserved;
7. native one-finger pan changes curve geometry;
8. native two-finger pinch changes curve geometry;
9. the semantic hole survives pan/pinch redraws;
10. orientation change resizes the WebView and SVG;
11. graph remains error-free after orientation;
12. graph survives a lifecycle CREATED → RESUMED transition.

### Native gesture path

The mobile layout can place the graph below the initial fold. The test therefore:

1. locates function-plot's actual `.zoom-and-drag` D3 interaction rectangle;
2. calls `scrollIntoView()` on that surface;
3. reads its DOM bounding rectangle;
4. converts CSS coordinates to physical Android display coordinates using the real WebView dimensions;
5. constructs one- and two-pointer Android `MotionEvent` sequences;
6. injects them using the public `Instrumentation.sendPointerSync()` API.

The pass criterion is a real function-plot redraw, not merely successful event injection.

## Offline contract

The generated manifest does not contain:

```text
android.permission.INTERNET
```

and the application explicitly sets:

```xml
android:usesCleartextTraffic="false"
```

All graph assets are bundled and served from Capacitor's local HTTPS origin.

## Scope boundary

Phase 6 certifies the standalone graph module and its Android deployment boundary.

It does not:

- modify Calcura;
- replace Calcura's pedagogical `PiecewiseLinearGraph`;
- add a graph button or graph screen in Calcura;
- claim support for obsolete stock WebViews outside Calcura's Vite target;
- test every OEM WebView implementation;
- test iOS/WKWebView.

Once this gate is green, the next step can be a deliberately narrow Calcura integration spike.
