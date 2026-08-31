import { expect, test, type Page } from '@playwright/test'

const graphHost = '[data-testid="graph-host"]'
const curvePath = `${graphHost} path.line.line-0`

async function selectPreset(page: Page, presetId: string) {
  await page.locator('select').selectOption(presetId)
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator(curvePath).first()).toBeVisible()
}

async function curvePathCount(page: Page) {
  return page.locator(curvePath).count()
}

async function firstCurveD(page: Page) {
  return page.locator(curvePath).first().getAttribute('d')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Calcura Plots' })).toBeVisible()
  await expect(page.locator(curvePath).first()).toBeVisible()
})

test('smooth functions render without graph errors', async ({ page }) => {
  for (const preset of ['parabola', 'sine', 'sinc']) {
    await selectPreset(page, preset)
    expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  }
})

test('1/x is split across its vertical asymptote', async ({ page }) => {
  await selectPreset(page, 'reciprocal')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(2)
})

test('shifted reciprocal is split across x = 2', async ({ page }) => {
  await selectPreset(page, 'shifted-reciprocal')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(2)
})

test('tan(x) produces multiple disconnected curve segments', async ({ page }) => {
  await selectPreset(page, 'tangent')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(4)
})

test('sqrt(x) renders its restricted real domain without throwing', async ({ page }) => {
  await selectPreset(page, 'sqrt')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
})

test('removable discontinuity capability is characterized explicitly', async ({ page }) => {
  await selectPreset(page, 'removable')

  const paths = await curvePathCount(page)
  const explicitHoleMarkers = await page.locator(`${graphHost} g.graph circle`).count()

  console.log(
    JSON.stringify({
      audit: 'removable-discontinuity',
      expression: '(x^2 - 1) / (x - 1)',
      pathCount: paths,
      explicitHoleMarkers,
    }),
  )

  // function-plot 1.25.4 does not model removable holes as semantic open-circle markers.
  // This is a recorded package limitation, not something the wrapper should silently hide.
  expect(explicitHoleMarkers).toBe(0)
})

test('sin(1/x) behavior near x = 0 is recorded for the capability audit', async ({ page }) => {
  await selectPreset(page, 'oscillatory')

  const paths = await curvePathCount(page)
  const d = await firstCurveD(page)

  console.log(
    JSON.stringify({
      audit: 'oscillatory-origin',
      expression: 'sin(1 / x)',
      pathCount: paths,
      firstPathLength: d?.length ?? 0,
    }),
  )

  expect(paths).toBeGreaterThanOrEqual(1)
  expect(d?.length ?? 0).toBeGreaterThan(0)
})

test('invalid expression reports an error and a valid preset recovers', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('sin(')
  await expect(page.locator('[role="alert"]')).toBeVisible()

  await selectPreset(page, 'sine')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
})

test('invalid viewport is rejected and recovery is deterministic', async ({ page }) => {
  const xMin = page.getByRole('spinbutton', { name: 'x min' })

  await xMin.fill('20')
  await expect(page.locator('[role="alert"]')).toContainText(
    'Viewport minimums must be smaller than maximums.',
  )

  await xMin.fill('-10')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator(curvePath).first()).toBeVisible()
})

test('responsive resize rebuilds the SVG to the new host width', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 })
  const wideWidth = Number(
    await page.locator(`${graphHost} svg.function-plot`).getAttribute('width'),
  )

  await page.setViewportSize({ width: 620, height: 900 })
  await expect
    .poll(async () =>
      Number(await page.locator(`${graphHost} svg.function-plot`).getAttribute('width')),
    )
    .toBeLessThan(wideWidth)
})

test('wheel zoom changes rendered curve geometry', async ({ page }) => {
  await selectPreset(page, 'sine')
  const before = await firstCurveD(page)

  const box = await page.locator(graphHost).boundingBox()
  expect(box).not.toBeNull()

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, -700)

  await expect.poll(() => firstCurveD(page)).not.toBe(before)
})

test('drag pan changes rendered curve geometry', async ({ page }) => {
  await selectPreset(page, 'sine')
  const before = await firstCurveD(page)

  const box = await page.locator(graphHost).boundingBox()
  expect(box).not.toBeNull()

  const y = box!.y + box!.height / 2
  await page.mouse.move(box!.x + box!.width * 0.45, y)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.65, y, { steps: 8 })
  await page.mouse.up()

  await expect.poll(() => firstCurveD(page)).not.toBe(before)
})

test('mobile viewport remains usable and graph stays inside the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await selectPreset(page, 'reciprocal')

  const bodyBox = await page.locator('body').boundingBox()
  const graphBox = await page.locator(graphHost).boundingBox()

  expect(bodyBox).not.toBeNull()
  expect(graphBox).not.toBeNull()
  expect(graphBox!.x).toBeGreaterThanOrEqual(0)
  expect(graphBox!.x + graphBox!.width).toBeLessThanOrEqual(bodyBox!.width + 1)
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(2)
})
