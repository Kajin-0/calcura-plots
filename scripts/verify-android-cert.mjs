import { readFile } from 'node:fs/promises'

const manifest = await readFile(
  'android/app/src/main/AndroidManifest.xml',
  'utf8',
)
const variables = await readFile('android/variables.gradle', 'utf8')
const capacitorConfig = await readFile('capacitor.config.ts', 'utf8')
const appGradle = await readFile('android/app/build.gradle', 'utf8')
const instrumentationTest = await readFile(
  'android/app/src/androidTest/java/com/calcura/plotslab/MainActivityTest.java',
  'utf8',
)

const assertions = [
  [
    !/android\.permission\.INTERNET/.test(manifest),
    'Android manifest must not request INTERNET permission.',
  ],
  [
    /android:usesCleartextTraffic=["']false["']/.test(manifest),
    'Android manifest must disable cleartext traffic.',
  ],
  [
    /minSdkVersion\s*=\s*24/.test(variables),
    'minSdkVersion must match Calcura (24).',
  ],
  [
    /compileSdkVersion\s*=\s*36/.test(variables),
    'compileSdkVersion must match Calcura (36).',
  ],
  [
    /targetSdkVersion\s*=\s*36/.test(variables),
    'targetSdkVersion must match Calcura (36).',
  ],
  [
    /androidScheme:\s*['"]https['"]/.test(capacitorConfig),
    'Capacitor androidScheme must be https.',
  ],
  [
    /allowMixedContent:\s*false/.test(capacitorConfig),
    'Capacitor mixed content must be disabled.',
  ],
  [
    /testInstrumentationRunner\s+["']androidx\.test\.runner\.AndroidJUnitRunner["']/.test(
      appGradle,
    ),
    'Generated Android app must retain the AndroidJUnitRunner.',
  ],
  [
    /injectPinchOpen\(webView\)/.test(instrumentationTest),
    'Instrumentation test must include real two-pointer pinch injection.',
  ],
  [
    /perform\(swipeLeft\(\)\)/.test(instrumentationTest),
    'Instrumentation test must include real Android touch pan.',
  ],
]

for (const [condition, message] of assertions) {
  if (!condition) {
    throw new Error(message)
  }
}

console.log(
  JSON.stringify({
    androidStaticCertification: 'ok',
    minSdk: 24,
    compileSdk: 36,
    targetSdk: 36,
    androidScheme: 'https',
    allowMixedContent: false,
    internetPermission: false,
    nativePanTest: true,
    nativePinchTest: true,
  }),
)
