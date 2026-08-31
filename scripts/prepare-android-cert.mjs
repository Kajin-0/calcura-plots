import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { dirname } from 'node:path'

const manifestPath = 'android/app/src/main/AndroidManifest.xml'
const variablesPath = 'android/variables.gradle'
const testSource = 'mobile/android/MainActivityTest.java'
const testDestination =
  'android/app/src/androidTest/java/com/calcura/plotslab/MainActivityTest.java'
const capacitorTemplateTest =
  'android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java'

let manifest = await readFile(manifestPath, 'utf8')

// Capacitor's stock template commonly requests INTERNET. Calcura intentionally
// does not; this certification project must mirror Calcura's offline contract.
manifest = manifest.replace(
  /\s*<uses-permission\s+android:name=["']android\.permission\.INTERNET["']\s*\/>\s*/g,
  '\n',
)

if (!/android:usesCleartextTraffic=["']false["']/.test(manifest)) {
  manifest = manifest.replace(
    /<application\b/,
    '<application\n        android:usesCleartextTraffic="false"',
  )
}

await writeFile(manifestPath, manifest)

let variables = await readFile(variablesPath, 'utf8')
variables = variables
  .replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24')
  .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
  .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36')
await writeFile(variablesPath, variables)

// The Capacitor template test hard-codes its default package id. It is template
// noise, not part of this certification surface.
await rm(capacitorTemplateTest, { force: true })

await mkdir(dirname(testDestination), { recursive: true })
await copyFile(testSource, testDestination)

console.log(
  JSON.stringify({
    androidCertificationPrepared: true,
    appId: 'com.calcura.plotslab',
    minSdk: 24,
    compileSdk: 36,
    targetSdk: 36,
    internetPermission: false,
    cleartextTraffic: false,
    templateInstrumentationTestRemoved: true,
  }),
)
