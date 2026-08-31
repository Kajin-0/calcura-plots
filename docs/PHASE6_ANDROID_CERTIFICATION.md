# Phase 6: Capacitor / Android WebView Certification

Date: 2026-08-31

## Objective

Certify the package-ready graph module inside the same deployment class Calcura uses: Capacitor 8 on Android WebView.

Calcura itself remains unchanged.

## Production constraints mirrored from Calcura

Reference Calcura commit:

```text
49c0b52f3941ce481e015d5faa413732d3bb5e63
```

Certification target:

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

The certification app uses a distinct application id:

```text
com.calcura.plotslab
```

so it cannot collide with Calcura.

## Why Android is generated in CI

The repository does not commit a generated `android/` project.

Each certification run does:

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
reuse the same APK pair across the emulator matrix
```

This keeps generated Capacitor boilerplate out of the reusable graph repository while testing a clean Android project every time.

## Android OS support vs WebView support

Calcura's Android `minSdk` is 24. That establishes the minimum Android OS level on which the native package may install.

It does **not** imply that the untouched WebView bundled with an original Android 7 / API-24 system image is modern enough to execute Calcura's current JavaScript bundle.

Calcura's Vite configuration does not override `build.target`. In Vite 6.2.0, the default `modules` target resolves to:

```text
es2020
Chrome 87+
Edge 88+
Firefox 78+
Safari 14+
```

Therefore Phase 6 intentionally separates:

```text
API 24  — native minSdk / Capacitor shell certification
API 31  — full graph runtime certification
API 36  — full graph runtime certification
```

This is more precise than treating the stock API-24 AOSP WebView as representative of an updated Android-7 device.

## Minimum-SDK certification: API 24

The API-24 endpoint verifies that the same built APK pair:

1. installs on the minimum supported Android API;
2. launches the generated Capacitor `MainActivity`;
3. creates the real Capacitor `WebView`;
4. loads the packaged shell to `document.readyState === 'complete'`;
5. uses the local `https://localhost` origin;
6. contains the packaged Vite `<script type="module">` entry.

The test records whether that stock AOSP WebView advertises module support but does not claim full graph-runtime certification there.

## Full WebView runtime certification

The API-31 and API-36 endpoints run the complete graph test inside Capacitor's actual `WebView`.

They verify:

1. initial graph renders;
2. local origin is `https://localhost`;
3. no graph error is present;
4. the real React UI can switch to the two-curve preset;
5. both curves render;
6. semantic hole metadata is preserved;
7. an Android one-finger drag changes rendered curve geometry;
8. a native two-pointer pinch changes rendered curve geometry;
9. the semantic hole survives pan/pinch redraws;
10. orientation change resizes the WebView and SVG;
11. graph remains error-free after orientation;
12. graph survives a lifecycle CREATED → RESUMED transition.

The gesture test calculates the graph's real DOM bounds inside the WebView, converts them into Android display coordinates, builds native `MotionEvent` sequences, and injects them through `Instrumentation.sendPointerSync()`.

It is not a synthetic JavaScript wheel/mouse test.

## Offline contract

The generated Capacitor template is patched so the final app manifest does not contain:

```text
android.permission.INTERNET
```

and the application explicitly sets:

```xml
android:usesCleartextTraffic="false"
```

The graph assets are bundled into the app and loaded from Capacitor's local HTTPS origin.

## Scope boundary

This phase certifies the standalone graph module and its Android deployment boundary.

It does not:

- modify Calcura;
- replace Calcura's pedagogical `PiecewiseLinearGraph`;
- add a graph button or graph screen in Calcura;
- claim support for an obsolete stock WebView outside Calcura's Vite target;
- test every OEM-specific Android WebView implementation;
- test iOS/WKWebView.

After the full runtime endpoints are green, the next step can be a deliberately narrow Calcura integration spike.
