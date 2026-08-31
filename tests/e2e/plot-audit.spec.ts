import { expect, test, type Page } from '@playwright/test'

const graphHost = '[data-testid="graph-host"]'
const curvePath = `${graphHost} path.line.line-0`
const semanticHole = `${graphHost} circle.calcura-semantic-hole`

async function selectPreset(page: Page, presetId: string) {
  await page.getByRole('combobox', { name: 'Plot preset' }).selectOption(presetId)
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

test('smooth functions render through the Calcura-owned evaluator', async ({ page }) => {
  for (const preset of ['parabola', 'sine', 'sinc']) {
    await selectPreset(page, preset)
    expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  }
})

test('1/x remains split across its vertical asymptote with callback evaluation', async ({
  page,
}) => {
  await selectPreset(page, 'reciprocal')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(2)
})

test('shifted reciprocal remains split across x = 2', async ({ page }) => {
  await selectPreset(page, 'shifted-reciprocal')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(2)
})

test('tan(x) still produces multiple disconnected curve segments', async ({ page }) => {
  await selectPreset(page, 'tangent')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(4)
})

test('sqrt(x) respects adapter-owned domain metadata', async ({ page }) => {
  await selectPreset(page, 'sqrt')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
})

test('removable discontinuity receives an explicit semantic hole marker', async ({
  page,
}) => {
  await selectPreset(page, 'removable')

  await expect(page.locator(semanticHole)).toHaveCount(1)
  const hole = page.locator(semanticHole)
  await expect(hole).toHaveAttribute('data-exclusion-x', '1')

  const cx = Number(await hole.getAttribute('cx'))
  const cy = Number(await hole.getAttribute('cy'))
  expect(Number.isFinite(cx)).toBe(true)
  expect(Number.isFinite(cy)).toBe(true)
})

test('semantic hole marker tracks zoom redraws', async ({ page }) => {
  await selectPreset(page, 'removable')
  const hole = page.locator(semanticHole)
  const beforeCx = await hole.getAttribute('cx')

  const box = await page.locator(graphHost).boundingBox()
  expect(box).not.toBeNull()

  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height / 2)
  await page.mouse.wheel(0, -700)

  await expect.poll(() => hole.getAttribute('cx')).not.toBe(beforeCx)
})

test('sin(1/x) retains strong segmentation through the safe evaluator', async ({ page }) => {
  await selectPreset(page, 'oscillatory')

  const paths = await curvePathCount(page)
  const d = await firstCurveD(page)

  console.log(
    JSON.stringify({
      audit: 'oscillatory-origin-phase3',
      expression: 'sin(1 / x)',
      pathCount: paths,
      firstPathLength: d?.length ?? 0,
    }),
  )

  expect(paths).toBeGreaterThanOrEqual(2)
  expect(d?.length ?? 0).toBeGreaterThan(0)
})

test('unsafe assignment is rejected before reaching function-plot', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('x = 4')
  await expect(page.locator('[role="alert"]')).toContainText('not allowed')
  await expect(page.locator(curvePath)).toHaveCount(0)

  await selectPreset(page, 'sine')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
})

test('unknown symbols are rejected and valid input recovers', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('x + y')
  await expect(page.locator('[role="alert"]')).toContainText('Symbol "y" is not allowed')

  await expressionInput.fill('cos(x)')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator(curvePath).first()).toBeVisible()
})

test('invalid syntax reports an adapter parse error and recovers', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('sin(')
  await expect(page.locator('[role="alert"]')).toContainText('Unable to parse')

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

test('wheel zoom changes rendered curve geometry without resetting on draw', async ({
  page,
}) => {
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

test('mobile viewport remains usable with callback evaluator and semantic layer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await selectPreset(page, 'removable')

  const bodyBox = await page.locator('body').boundingBox()
  const graphBox = await page.locator(graphHost).boundingBox()

  expect(bodyBox).not.toBeNull()
  expect(graphBox).not.toBeNull()
  expect(graphBox!.x).toBeGreaterThanOrEqual(0)
  expect(graphBox!.x + graphBox!.width).toBeLessThanOrEqual(bodyBox!.width + 1)
  await expect(page.locator(semanticHole)).toHaveCount(1)
})
