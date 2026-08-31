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
static contract verification
      ↓
assembleDebug
assembleAndroidTest
      ↓
run same test APK on API 24 and API 36 emulators
```

This keeps generated Capacitor boilerplate out of the reusable graph repository while testing a clean Android project every time.

## Real WebView instrumentation

`mobile/android/MainActivityTest.java` runs inside the generated Android app.

It accesses Capacitor's actual `WebView` through the generated `MainActivity` and verifies:

1. initial graph renders;
2. local origin is `https://localhost`;
3. no graph error is present;
4. the real UI can switch to the two-curve preset;
5. both curves render;
6. semantic hole metadata is preserved;
7. an Android single-finger swipe changes SVG curve geometry;
8. a native two-pointer `MotionEvent` pinch changes SVG curve geometry;
9. the semantic hole survives pan/pinch redraws;
10. orientation change resizes the WebView and SVG;
11. graph remains error-free after orientation;
12. graph survives a lifecycle CREATED → RESUMED transition.

The pinch test injects genuine Android touchscreen pointer events through `UiAutomation`; it is not a synthetic JavaScript wheel event.

## Emulator matrix

The same built APKs are run on:

```text
API 24  — Calcura minimum supported Android API
API 36  — Calcura current target/compile API
```

This brackets the supported Android API range at its endpoints.

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

This phase certifies the standalone graph module in Capacitor Android WebView.

It does not yet:

- modify Calcura;
- replace Calcura's pedagogical `PiecewiseLinearGraph`;
- add a graph button or graph screen in Calcura;
- test OEM-specific Android WebView implementations;
- test iOS/WKWebView.

If Phase 6 is green on both emulator endpoints, the next step can be a deliberately narrow Calcura integration spike.
