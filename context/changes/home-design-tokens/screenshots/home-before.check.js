// Playwright baseline for the home page BEFORE the token migration (phase 1). Run through the Playwright MCP
// `browser_run_code_unsafe` with this file as `filename`. Dev server: http://localhost:4401. No login (signed-out page).
// Saves screenshots and returns the keyboard-focus measurement of the hero "Zaloguj się" CTA.
async (page) => {
  const BASE = "http://localhost:4401";
  const SHOTS = "C:/Users/pwojno/Documents/Hajsownik/context/changes/home-design-tokens/screenshots";
  const result = { shots: [], focus: {}, consoleErrors: [] };

  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push(message.text());
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/`, { waitUntil: "load" });

    await page.screenshot({ path: `${SHOTS}/home-before-${width}.png`, fullPage: true });
    result.shots.push(`home-before-${width}.png`);

    // The hero CTA, not the Topbar link with the same href: the h1's parent is the hero block.
    const cta = page.locator("h1").locator("xpath=..").getByRole("link", { name: "Zaloguj się" });
    await cta.waitFor({ state: "visible" });

    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    let tabs = 0;
    while (tabs < 20 && !(await cta.evaluate((el) => el === document.activeElement))) {
      await page.keyboard.press("Tab");
      tabs += 1;
    }
    const focused = await cta.evaluate((el) => el === document.activeElement);
    // Let transition-* finish before reading computed styles.
    await page.waitForTimeout(400);
    const style = await cta.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        outlineColor: s.outlineColor,
        boxShadow: s.boxShadow,
      };
    });
    result.focus[width] = { reachedByTab: focused, tabsPressed: tabs, ...style };

    await page.screenshot({ path: `${SHOTS}/home-before-focus-${width}.png` });
    result.shots.push(`home-before-focus-${width}.png`);
  }

  return result;
}
