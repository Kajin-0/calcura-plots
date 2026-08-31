package com.calcura.plotslab;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class MainActivityTest {
    private static final long JS_TIMEOUT_MS = 20_000L;

    @Test
    public void certifiesCalcuraPlotsInsideRealCapacitorWebView() throws Exception {
        long launchStarted = SystemClock.elapsedRealtime();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<WebView> webViewRef = new AtomicReference<>();

            scenario.onActivity(activity -> {
                WebView webView = activity.getBridge().getWebView();
                webViewRef.set(webView);
            });

            WebView webView = webViewRef.get();
            assertTrue("Capacitor WebView must exist", webView != null);

            try {
                waitForJsBoolean(
                    webView,
                    "document.readyState === 'complete' && " +
                        "document.querySelector('[data-testid=graph-host] path.line.line-0') !== null",
                    JS_TIMEOUT_MS
                );
            } catch (AssertionError error) {
                printWebViewDiagnostics(webView);
                throw error;
            }

            long readyMs = SystemClock.elapsedRealtime() - launchStarted;
            assertTrue(
                "Initial graph should be ready within 20 seconds on emulator; was " + readyMs + " ms",
                readyMs < 20_000L
            );

            assertTrue(
                "Capacitor local protocol must be HTTPS",
                evalJsBoolean(webView, "window.location.protocol === 'https:'")
            );
            assertTrue(
                "Capacitor local host must be localhost",
                evalJsBoolean(webView, "window.location.hostname === 'localhost'")
            );
            assertTrue(evalJsBoolean(
                webView,
                "document.querySelector('[data-testid=graph-host] svg.function-plot') !== null"
            ));
            assertFalse(evalJsBoolean(
                webView,
                "document.querySelector('[role=alert]') !== null"
            ));

            // Exercise the real React/UI path to a two-curve scene.
            evalJsRaw(
                webView,
                "(() => {" +
                    "const s=document.querySelector(\"select[aria-label='Plot preset']\");" +
                    "s.value='multi-curve';" +
                    "s.dispatchEvent(new Event('change',{bubbles:true}));" +
                    "return true;" +
                "})()"
            );

            waitForJsBoolean(
                webView,
                "document.querySelector('path.line.line-1') !== null && " +
                    "document.querySelector(\"circle.calcura-semantic-hole[data-function-id='line-with-hole']\") !== null",
                JS_TIMEOUT_MS
            );

            int beforePanHash = evalJsInt(webView, curveHashJs());

            // Genuine Android finger gesture targeted inside the graph viewport.
            injectGraphPan(webView);
            SystemClock.sleep(500L);

            int afterPanHash = evalJsInt(webView, curveHashJs());
            assertNotEquals(
                "Android touch pan must change rendered curve geometry",
                beforePanHash,
                afterPanHash
            );

            int beforePinchHash = afterPanHash;
            injectPinchOpen(webView);
            SystemClock.sleep(550L);
            int afterPinchHash = evalJsInt(webView, curveHashJs());

            assertNotEquals(
                "Android two-finger pinch must change rendered curve geometry",
                beforePinchHash,
                afterPinchHash
            );
            assertTrue(
                "Semantic hole must survive native pan/pinch redraws",
                evalJsBoolean(
                    webView,
                    "document.querySelectorAll(\"circle.calcura-semantic-hole[data-function-id='line-with-hole']\").length === 1"
                )
            );

            int portraitInnerWidth = evalJsInt(webView, "window.innerWidth");

            scenario.onActivity(activity ->
                activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE)
            );

            waitForJsBoolean(
                webView,
                "window.innerWidth > " + portraitInnerWidth,
                JS_TIMEOUT_MS
            );

            int landscapeInnerWidth = evalJsInt(webView, "window.innerWidth");
            int landscapeSvgWidth = evalJsInt(
                webView,
                "Number(document.querySelector('svg.function-plot').getAttribute('width'))"
            );

            assertTrue("Landscape WebView should widen", landscapeInnerWidth > portraitInnerWidth);
            assertTrue(
                "Graph SVG should resize with WebView",
                landscapeSvgWidth > portraitInnerWidth / 2
            );
            assertFalse(
                "No render error after Android orientation change",
                evalJsBoolean(webView, "document.querySelector('[role=alert]') !== null")
            );

            // Lifecycle smoke: background-style state transition then resume.
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
            SystemClock.sleep(250L);
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);

            waitForJsBoolean(
                webView,
                "document.querySelector('path.line.line-0') !== null && " +
                    "document.querySelector('path.line.line-1') !== null",
                JS_TIMEOUT_MS
            );

            assertTrue(
                "Semantic overlay must survive lifecycle resume",
                evalJsBoolean(
                    webView,
                    "document.querySelector(\"circle.calcura-semantic-hole[data-function-id='line-with-hole']\") !== null"
                )
            );

            System.out.println(
                "CALCURA_PLOTS_ANDROID_CERT " +
                "{api=" + android.os.Build.VERSION.SDK_INT +
                ",readyMs=" + readyMs +
                ",portraitWidth=" + portraitInnerWidth +
                ",landscapeWidth=" + landscapeInnerWidth +
                ",pan=true,pinch=true,multiCurve=true,semanticHole=true,lifecycle=true}"
            );
        }
    }

    private static String curveHashJs() {
        return "(() => {" +
            "const nodes=[...document.querySelectorAll('path.line.line-0,path.line.line-1')];" +
            "const s=nodes.map(n=>n.getAttribute('d')||'').join('|');" +
            "let h=0;" +
            "for(let i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;}" +
            "return h;" +
        "})()";
    }

    private static void injectGraphPan(WebView webView) throws Exception {
        GraphScreenRect graph = graphScreenRect(webView);

        float startX = graph.left + graph.width * 0.68f;
        float endX = graph.left + graph.width * 0.32f;
        float y = graph.top + graph.height * 0.50f;
        long downTime = SystemClock.uptimeMillis();
        MotionEvent.PointerProperties pointer = pointerProperties(0);

        injectToDisplay(
            webView,
            event(
                downTime,
                downTime,
                MotionEvent.ACTION_DOWN,
                new MotionEvent.PointerProperties[]{pointer},
                new MotionEvent.PointerCoords[]{coords(startX, y)}
            )
        );

        for (int step = 1; step <= 10; step++) {
            float t = step / 10f;
            float x = startX + (endX - startX) * t;
            injectToDisplay(
                webView,
                event(
                    downTime,
                    SystemClock.uptimeMillis(),
                    MotionEvent.ACTION_MOVE,
                    new MotionEvent.PointerProperties[]{pointer},
                    new MotionEvent.PointerCoords[]{coords(x, y)}
                )
            );
            SystemClock.sleep(20L);
        }

        injectToDisplay(
            webView,
            event(
                downTime,
                SystemClock.uptimeMillis(),
                MotionEvent.ACTION_UP,
                new MotionEvent.PointerProperties[]{pointer},
                new MotionEvent.PointerCoords[]{coords(endX, y)}
            )
        );
    }

    private static void injectPinchOpen(WebView webView) throws Exception {
        GraphScreenRect graph = graphScreenRect(webView);

        float centerX = graph.left + graph.width / 2f;
        float centerY = graph.top + graph.height / 2f;
        float startHalfSpan = Math.max(18f, graph.width * 0.07f);
        float endHalfSpan = Math.max(70f, graph.width * 0.28f);

        long downTime = SystemClock.uptimeMillis();

        MotionEvent.PointerProperties p0 = pointerProperties(0);
        MotionEvent.PointerProperties p1 = pointerProperties(1);

        injectToDisplay(
            webView,
            event(
                downTime,
                downTime,
                MotionEvent.ACTION_DOWN,
                new MotionEvent.PointerProperties[]{p0},
                new MotionEvent.PointerCoords[]{coords(centerX - startHalfSpan, centerY)}
            )
        );

        injectToDisplay(
            webView,
            event(
                downTime,
                SystemClock.uptimeMillis(),
                MotionEvent.ACTION_POINTER_DOWN | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT),
                new MotionEvent.PointerProperties[]{p0, p1},
                new MotionEvent.PointerCoords[]{
                    coords(centerX - startHalfSpan, centerY),
                    coords(centerX + startHalfSpan, centerY)
                }
            )
        );

        for (int step = 1; step <= 10; step++) {
            float t = step / 10f;
            float halfSpan = startHalfSpan + (endHalfSpan - startHalfSpan) * t;
            injectToDisplay(
                webView,
                event(
                    downTime,
                    SystemClock.uptimeMillis(),
                    MotionEvent.ACTION_MOVE,
                    new MotionEvent.PointerProperties[]{p0, p1},
                    new MotionEvent.PointerCoords[]{
                        coords(centerX - halfSpan, centerY),
                        coords(centerX + halfSpan, centerY)
                    }
                )
            );
            SystemClock.sleep(22L);
        }

        injectToDisplay(
            webView,
            event(
                downTime,
                SystemClock.uptimeMillis(),
                MotionEvent.ACTION_POINTER_UP | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT),
                new MotionEvent.PointerProperties[]{p0, p1},
                new MotionEvent.PointerCoords[]{
                    coords(centerX - endHalfSpan, centerY),
                    coords(centerX + endHalfSpan, centerY)
                }
            )
        );

        injectToDisplay(
            webView,
            event(
                downTime,
                SystemClock.uptimeMillis(),
                MotionEvent.ACTION_UP,
                new MotionEvent.PointerProperties[]{p0},
                new MotionEvent.PointerCoords[]{coords(centerX - endHalfSpan, centerY)}
            )
        );
    }

    private static GraphScreenRect graphScreenRect(WebView webView) throws Exception {
        int cssLeft = evalJsInt(
            webView,
            "document.querySelector('[data-testid=graph-host]').getBoundingClientRect().left"
        );
        int cssTop = evalJsInt(
            webView,
            "document.querySelector('[data-testid=graph-host]').getBoundingClientRect().top"
        );
        int cssWidth = evalJsInt(
            webView,
            "document.querySelector('[data-testid=graph-host]').getBoundingClientRect().width"
        );
        int cssHeight = evalJsInt(
            webView,
            "document.querySelector('[data-testid=graph-host]').getBoundingClientRect().height"
        );
        int innerWidth = evalJsInt(webView, "window.innerWidth");
        int innerHeight = evalJsInt(webView, "window.innerHeight");

        int[] location = new int[2];
        int[] dimensions = new int[2];

        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            webView.getLocationOnScreen(location);
            dimensions[0] = webView.getWidth();
            dimensions[1] = webView.getHeight();
        });

        float scaleX = dimensions[0] / (float) Math.max(1, innerWidth);
        float scaleY = dimensions[1] / (float) Math.max(1, innerHeight);

        // UiAutomation injects global display coordinates, not WebView-local ones.
        return new GraphScreenRect(
            location[0] + cssLeft * scaleX,
            location[1] + cssTop * scaleY,
            cssWidth * scaleX,
            cssHeight * scaleY
        );
    }

    private static MotionEvent.PointerProperties pointerProperties(int id) {
        MotionEvent.PointerProperties properties = new MotionEvent.PointerProperties();
        properties.id = id;
        properties.toolType = MotionEvent.TOOL_TYPE_FINGER;
        return properties;
    }

    private static MotionEvent.PointerCoords coords(float x, float y) {
        MotionEvent.PointerCoords coords = new MotionEvent.PointerCoords();
        coords.x = x;
        coords.y = y;
        coords.pressure = 1f;
        coords.size = 1f;
        return coords;
    }

    private static MotionEvent event(
        long downTime,
        long eventTime,
        int action,
        MotionEvent.PointerProperties[] properties,
        MotionEvent.PointerCoords[] coords
    ) {
        return MotionEvent.obtain(
            downTime,
            eventTime,
            action,
            properties.length,
            properties,
            coords,
            0,
            0,
            1f,
            1f,
            0,
            0,
            InputDevice.SOURCE_TOUCHSCREEN,
            0
        );
    }

    private static void injectToDisplay(WebView webView, MotionEvent event) {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        try {
            if (
                android.os.Build.VERSION.SDK_INT >= 29 &&
                webView.getDisplay() != null
            ) {
                event.setDisplayId(webView.getDisplay().getDisplayId());
            }

            assertTrue(
                "UiAutomation must inject graph-targeted touchscreen event",
                instrumentation.getUiAutomation().injectInputEvent(event, true)
            );
        } finally {
            event.recycle();
        }
    }

    private static void printWebViewDiagnostics(WebView webView) {
        try {
            boolean ready = evalJsBoolean(webView, "document.readyState === 'complete'");
            boolean moduleScript = evalJsBoolean(
                webView,
                "document.querySelector('script[type=module]') !== null"
            );
            boolean moduleSupport = evalJsBoolean(
                webView,
                "'noModule' in HTMLScriptElement.prototype"
            );
            int rootChildren = evalJsInt(
                webView,
                "(document.getElementById('root') && document.getElementById('root').children.length) || 0"
            );
            int bodyChildren = evalJsInt(webView, "document.body ? document.body.children.length : 0");

            System.out.println(
                "CALCURA_PLOTS_WEBVIEW_DIAGNOSTICS " +
                "{api=" + android.os.Build.VERSION.SDK_INT +
                ",webViewPackage=" + webViewPackageVersion() +
                ",ready=" + ready +
                ",moduleScript=" + moduleScript +
                ",moduleSupport=" + moduleSupport +
                ",rootChildren=" + rootChildren +
                ",bodyChildren=" + bodyChildren +
                "}"
            );
        } catch (Throwable diagnosticError) {
            System.out.println(
                "CALCURA_PLOTS_WEBVIEW_DIAGNOSTICS " +
                "{api=" + android.os.Build.VERSION.SDK_INT +
                ",webViewPackage=" + webViewPackageVersion() +
                ",diagnosticError=" + diagnosticError.getClass().getSimpleName() +
                "}"
            );
        }
    }

    private static String webViewPackageVersion() {
        PackageManager packageManager =
            InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager();
        String[] candidates = {
            "com.google.android.webview",
            "com.android.webview",
            "com.android.chrome"
        };

        for (String packageName : candidates) {
            try {
                PackageInfo info = packageManager.getPackageInfo(packageName, 0);
                return packageName + ":" + info.versionName;
            } catch (PackageManager.NameNotFoundException ignored) {
                // Try the next known WebView provider package.
            }
        }

        return "unknown";
    }

    private static void waitForJsBoolean(
        WebView webView,
        String expression,
        long timeoutMs
    ) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (evalJsBoolean(webView, expression)) {
                return;
            }
            SystemClock.sleep(100L);
        }
        throw new AssertionError("Timed out waiting for JavaScript condition: " + expression);
    }

    private static boolean evalJsBoolean(WebView webView, String expression) throws Exception {
        return Boolean.parseBoolean(evalJsRaw(webView, "Boolean(" + expression + ")"));
    }

    private static int evalJsInt(WebView webView, String expression) throws Exception {
        return Integer.parseInt(evalJsRaw(webView, "Math.round(Number(" + expression + "))"));
    }

    private static String evalJsRaw(WebView webView, String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();

        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                webView.evaluateJavascript(expression, value -> {
                    result.set(value);
                    latch.countDown();
                });
            } catch (Throwable error) {
                failure.set(error);
                latch.countDown();
            }
        });

        if (!latch.await(JS_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
            throw new AssertionError("Timed out evaluating JavaScript: " + expression);
        }
        if (failure.get() != null) {
            throw new AssertionError("JavaScript evaluation failed", failure.get());
        }
        return result.get();
    }

    private static final class GraphScreenRect {
        final float left;
        final float top;
        final float width;
        final float height;

        GraphScreenRect(float left, float top, float width, float height) {
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
        }
    }
}
