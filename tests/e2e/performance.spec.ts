import { test, expect } from '@playwright/test'

for (const width of [1100, 390]) {
  test(`graph interaction benchmark ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(() => {
      const metrics = { draws: 0, longTasks: [] as number[], frames: [] as number[], last: 0 }
      Object.assign(window, { graphMetrics: metrics })
      new PerformanceObserver(list => list.getEntries().forEach(e => metrics.longTasks.push(e.duration))).observe({ type: 'longtask', buffered: true })
      new MutationObserver(records => { metrics.draws += records.filter(r => r.type === 'attributes' && r.attributeName === 'd' && (r.target as Element).matches('path.line')).length }).observe(document, { subtree: true, attributes: true, attributeFilter: ['d'] })
      const tick = (t: number) => { if (metrics.last) metrics.frames.push(t - metrics.last); metrics.last = t; requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    })
    const start = Date.now()
    await page.goto('/')
    const curve = page.locator('[data-testid="graph-host"] path.line').first()
    await expect(curve).toBeVisible()
    const open = Date.now() - start
    for (const preset of ['sine', 'steep-odd-power', 'tangent', 'multi-curve']) {
      // Some historical demo revisions use a different multiple-curve preset id.
      if (!await page.locator(`option[value="${preset}"]`).count()) continue
      await page.getByRole('combobox', { name: 'Plot preset' }).selectOption(preset)
      await expect(page.locator('[data-testid="graph-host"] path.line:visible').first()).toBeVisible()
      await page.locator('.zoom-and-drag').scrollIntoViewIfNeeded()
      const box = await page.locator('[data-testid="graph-host"]').boundingBox()
      expect(box).not.toBeNull()
      await page.locator('.zoom-and-drag').evaluate(node => {
        // Test-only observation of the renderer's real draw lifecycle.
        const chart = (node as unknown as { instance: { on: (event: string, listener: () => void) => void } }).instance
        const timings: number[] = []
        let start = 0
        chart.on('before:draw', () => { start = performance.now() })
        chart.on('after:draw', () => { timings.push(performance.now() - start) })
        Object.assign(window, { graphDrawTimings: timings })
      })
      await page.evaluate(() => {
        const m = (window as unknown as { graphMetrics: { draws: number; frames: number[]; longTasks: number[] } }).graphMetrics
        m.draws = 0; m.frames = []; m.longTasks = []
      })
      const times: number[] = []
      for (let i = 0; i < 10; i++) {
        const before = await page.locator('path.line').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')).join('|'))
        const t = Date.now()
        await page.mouse.move(box!.x + box!.width * (i % 2 ? .65 : .45), box!.y + box!.height * .5)
        await page.mouse.down()
        await page.mouse.move(box!.x + box!.width * (i % 2 ? .45 : .65), box!.y + box!.height * .5, { steps: 3 })
        await page.mouse.up()
        await expect.poll(() => page.locator('path.line').evaluateAll(nodes => nodes.map(n => n.getAttribute('d')).join('|'))).not.toBe(before)
        times.push(Date.now() - t)
      }
      await page.mouse.wheel(0, -100)
      await expect(page.locator('[role="alert"]')).toHaveCount(0)
      const metrics = await page.evaluate(() => {
        const m = (window as unknown as { graphMetrics: { draws: number; frames: number[]; longTasks: number[] } }).graphMetrics
        const frames = m.frames.sort((a, b) => a - b)
        const draws = (window as unknown as { graphDrawTimings: number[] }).graphDrawTimings.sort((a, b) => a - b)
        return { draws: draws.length, drawP50: draws[Math.floor(draws.length * .5)], drawP95: draws[Math.floor(draws.length * .95)], pathMutations: m.draws, frameP50: frames[Math.floor(frames.length * .5)], frameP95: frames[Math.floor(frames.length * .95)], longTasks: m.longTasks }
      })
      times.sort((a, b) => a - b)
      console.log(JSON.stringify({ audit: 'browser-performance', width, preset, openMs: open, panP50: times[4], panP95: times[9], metrics, domPaths: await page.locator('path.line').count(), pathBytes: await page.locator('path.line').evaluateAll(nodes => nodes.reduce((sum, n) => sum + (n.getAttribute('d') || '').length, 0)) }))
    }
  })
}

test('draw requests coalesce and paint the latest scale in one frame', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('path.line').first()).toBeVisible()
  const result = await page.locator('.zoom-and-drag').evaluate(async node => {
    const chart = (node as unknown as { instance: {
      draw: () => void
      on: (event: string, listener: () => void) => void
      meta: { xScale: { domain: (domain: number[]) => void } }
    } }).instance
    let draws = 0
    chart.on('after:draw', () => { draws++ })
    const before = document.querySelector('path.line')!.getAttribute('d')
    for (let n = 0; n < 20; n++) {
      chart.meta.xScale.domain([-10 + n / 20, 10 + n / 20])
      chart.draw()
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    return { draws, before, after: document.querySelector('path.line')!.getAttribute('d') }
  })
  expect(result.draws).toBe(1)
  expect(result.after).not.toBe(result.before)
})
