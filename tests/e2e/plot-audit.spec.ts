import { expect, test, type Page } from '@playwright/test'

const graphHost = '[data-testid="graph-host"]'
const curvePath = `${graphHost} path.line.line-0`
const semanticHole = `${graphHost} circle.calcura-semantic-hole`
const domainEndpoint = `${graphHost} circle.calcura-domain-endpoint`

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

test('smooth Calcura LaTeX functions render through the owned evaluator', async ({
  page,
}) => {
  for (const preset of ['parabola', 'sine', 'sinc']) {
    await selectPreset(page, preset)
    expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  }
})

test('direct Calcura-style fraction/trig LaTeX can be typed into the lab', async ({
  page,
}) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })
  await expressionInput.fill('\\frac{\\sin(x)}{x}')

  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator(curvePath).first()).toBeVisible()
})

test('1/x remains split across its vertical asymptote after LaTeX conversion', async ({
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

test('sqrt(x) renders a closed finite domain endpoint', async ({ page }) => {
  await selectPreset(page, 'sqrt')
  expect(await curvePathCount(page)).toBeGreaterThanOrEqual(1)
  const endpoint = page.locator(domainEndpoint)
  await expect(endpoint).toHaveCount(1)
  await expect(endpoint).toHaveAttribute('data-domain-endpoint-x', '0')
  await expect(endpoint).toHaveAttribute('data-domain-endpoint-included', 'true')
  const fill = await endpoint.evaluate((element) => getComputedStyle(element).fill)
  expect(fill).not.toBe('none')
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

test('semantic hole marker tracks interactive pan redraws', async ({ page }) => {
  await selectPreset(page, 'removable')
  const hole = page.locator(semanticHole)
  const beforeCx = await hole.getAttribute('cx')

  const box = await page.locator(graphHost).boundingBox()
  expect(box).not.toBeNull()

  const y = box!.y + box!.height / 2
  await page.mouse.move(box!.x + box!.width * 0.45, y)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.65, y, { steps: 8 })
  await page.mouse.up()

  await expect.poll(() => hole.getAttribute('cx')).not.toBe(beforeCx)
  await expect(page.locator(semanticHole)).toHaveCount(1)
})

test('sin(1/x) retains strong segmentation through LaTeX and safe evaluation', async ({
  page,
}) => {
  await selectPreset(page, 'oscillatory')

  const paths = await curvePathCount(page)
  const d = await firstCurveD(page)

  console.log(
    JSON.stringify({
      audit: 'oscillatory-origin-phase4',
      expression: '\\sin(\\frac{1}{x})',
      pathCount: paths,
      firstPathLength: d?.length ?? 0,
    }),
  )

  expect(paths).toBeGreaterThanOrEqual(2)
  expect(d?.length ?? 0).toBeGreaterThan(0)
})

test('unsafe assignment is rejected after LaTeX normalization', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('x = 4')
  await expect(page.locator('[role="alert"]')).toContainText('not allowed')
  await expect(page.locator(curvePath)).toHaveCount(0)

  await selectPreset(page, 'sine')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
})

test('unknown symbols are rejected and valid LaTeX input recovers', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('x + y')
  await expect(page.locator('[role="alert"]')).toContainText('Symbol "y" is not allowed')

  await expressionInput.fill('\\cos(x)')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)
  await expect(page.locator(curvePath).first()).toBeVisible()
})

test('unsupported calculus LaTeX is rejected before the renderer', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('\\int x\\,dx')
  await expect(page.locator('[role="alert"]')).toContainText(
    'outside the Cartesian function-graph grammar',
  )
  await expect(page.locator(curvePath)).toHaveCount(0)
})

test('invalid syntax reports an adapter parse error and recovers', async ({ page }) => {
  const expressionInput = page.getByRole('textbox', { name: 'Function expression' })

  await expressionInput.fill('\\sin(')
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

test('narrow host keeps the Cartesian plot rectangle horizontally centered', async ({ page }) => {
  const host = page.locator(graphHost)
  await host.evaluate((element) => {
    const parent = element.parentElement
    if (parent) {
      parent.style.width = '280px'
    }
  })

  const surface = page.locator(`${graphHost} .zoom-and-drag`)

  const hostBox = await host.boundingBox()
  const surfaceBox = await surface.boundingBox()
  expect(hostBox).not.toBeNull()
  expect(surfaceBox).not.toBeNull()

  const leftGap = surfaceBox!.x - hostBox!.x
  const rightGap = hostBox!.x + hostBox!.width - (surfaceBox!.x + surfaceBox!.width)

  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1)
  expect(surfaceBox!.x).toBeGreaterThanOrEqual(hostBox!.x)
  expect(surfaceBox!.x + surfaceBox!.width).toBeLessThanOrEqual(hostBox!.x + hostBox!.width)
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

test('selected point changes only on click and stays logically pinned during pan', async ({
  page,
}) => {
  await selectPreset(page, 'sine')

  const surface = page.locator(`${graphHost} .zoom-and-drag`)
  const tip = page.locator(`${graphHost} g.inner-tip`)
  const tipText = tip.locator('text')
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()

  const firstX = box!.x + box!.width * 0.5
  const firstY = box!.y + box!.height * 0.5

  // Pointer movement alone must not create or move a selection.
  await page.mouse.move(firstX, firstY)
  await expect(tip).toBeHidden()

  // A single click selects the nearest point.
  await page.mouse.click(firstX, firstY)
  await expect(tip).toBeVisible()

  const selectedX = await tip.getAttribute('data-selected-x')
  const selectedText = await tipText.textContent()
  const selectedTransform = await tip.getAttribute('transform')
  expect(selectedX).not.toBeNull()
  expect(selectedText).not.toBeNull()
  expect(selectedTransform).not.toBeNull()

  const beforeCurve = await firstCurveD(page)

  // Panning must move the viewport, but not change the selected logical point.
  await page.mouse.move(box!.x + box!.width * 0.45, firstY)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.65, firstY, { steps: 8 })
  await page.mouse.up()

  await expect.poll(() => firstCurveD(page)).not.toBe(beforeCurve)
  await expect.poll(() => tip.getAttribute('data-selected-x')).toBe(selectedX)
  await expect.poll(() => tipText.textContent()).toBe(selectedText)
  await expect.poll(() => tip.getAttribute('transform')).not.toBe(selectedTransform)

  // A new single click is the only interaction that replaces the selection.
  const updatedBox = await surface.boundingBox()
  expect(updatedBox).not.toBeNull()
  await page.mouse.click(
    updatedBox!.x + updatedBox!.width * 0.72,
    updatedBox!.y + updatedBox!.height * 0.5,
  )
  await expect.poll(() => tip.getAttribute('data-selected-x')).not.toBe(selectedX)
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

test('multiple curves render independently with semantic metadata preserved', async ({ page }) => {
  await selectPreset(page, 'multi-curve')

  const firstSeries = page.locator(`${graphHost} path.line.line-0`).first()
  const secondSeries = page.locator(`${graphHost} path.line.line-1`).first()

  await expect(firstSeries).toBeVisible()
  await expect(secondSeries).toBeVisible()

  const [firstStroke, secondStroke] = await Promise.all([
    firstSeries.evaluate((element) => getComputedStyle(element).stroke),
    secondSeries.evaluate((element) => getComputedStyle(element).stroke),
  ])

  expect(firstStroke).not.toBe(secondStroke)

  const hole = page.locator(semanticHole)
  await expect(hole).toHaveCount(1)
  await expect(hole).toHaveAttribute('data-function-id', 'line-with-hole')
  await expect(hole).toHaveAttribute('data-function-index', '1')
})

test('mobile viewport remains usable with LaTeX input and semantic layer', async ({
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
