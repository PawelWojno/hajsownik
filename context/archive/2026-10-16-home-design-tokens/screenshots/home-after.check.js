// Playwright check for the home page AFTER the token migration (phase 3). Run through the Playwright MCP
// `browser_run_code_unsafe` with this file as `filename`. Dev server: http://localhost:4401. No login (signed-out page).
// Returns one { name, pass, detail } row per check and saves home-after-*.png screenshots.
// On a cold dev server the first load can be reloaded by Vite (dependency optimization) and fail the first checks
// (seen: "found 1 card", Tab timeouts); open `/` once, then run the script again.
async (page) => {
  const BASE = "http://localhost:4401";
  const SHOTS = "C:/Users/pwojno/Documents/Hajsownik/context/changes/home-design-tokens/screenshots";
  const rows = [];

  async function step(name, fn) {
    try {
      const detail = await fn();
      rows.push({ name, pass: true, detail: detail ?? "" });
    } catch (error) {
      rows.push({ name, pass: false, detail: String(error.message ?? error).split("\n")[0] });
    }
  }
  function expect(condition, message) {
    if (!condition) throw new Error(message);
  }

  const styleOf = (locator, props) =>
    locator.evaluate((el, list) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(list.map((p) => [p, s[p]]));
    }, props);
  // buttonVariants has transition-all: wait until the value stops changing before trusting it.
  async function settled(locator, prop) {
    let previous = await styleOf(locator, [prop]);
    for (let i = 0; i < 10; i += 1) {
      await page.waitForTimeout(100);
      const current = await styleOf(locator, [prop]);
      if (current[prop] === previous[prop]) return current[prop];
      previous = current;
    }
    return previous[prop];
  }

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ]) {
    const label = `${width}px`;
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.screenshot({ path: `${SHOTS}/home-after-${width}.png`, fullPage: true });

    await step(`${label}: no decorations, exactly 3 cards`, async () => {
      const decorations = await page.locator('[class*="blur-["], [style*="radial-gradient"]').count();
      const cards = await page.locator('[data-slot="card"]').count();
      expect(decorations === 0, `found ${decorations} decoration element(s)`);
      expect(cards === 3, `expected 3 cards, found ${cards}`);
    });

    // The hero CTAs, not the Topbar links with the same hrefs: the h1's parent is the hero block.
    const hero = page.locator("h1").locator("xpath=..");
    for (const [name, key] of [
      ["Zaloguj się", "primary"],
      ["Załóż konto", "secondary"],
    ]) {
      const cta = hero.getByRole("link", { name });

      await step(`${label}: ${name} hover changes the background`, async () => {
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        await page.mouse.move(0, 0);
        const rest = await settled(cta, "backgroundColor");
        await cta.hover();
        const hovered = await settled(cta, "backgroundColor");
        await page.mouse.move(0, 0);
        expect(rest !== hovered, `background unchanged on hover (${rest})`);
        return `${rest} -> ${hovered}`;
      });

      await step(`${label}: ${name} shows a visible focus ring on keyboard focus`, async () => {
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        let tabs = 0;
        while (tabs < 20 && !(await cta.evaluate((el) => el === document.activeElement))) {
          await page.keyboard.press("Tab");
          tabs += 1;
        }
        expect(tabs < 20, "CTA not reached by Tab");
        const boxShadow = await settled(cta, "boxShadow");
        expect(boxShadow !== "none", "no box-shadow ring on focus");
        const suffix = key === "primary" ? "" : "-secondary";
        await page.screenshot({ path: `${SHOTS}/home-after-focus${suffix}-${width}.png` });
        return `after ${tabs} Tab: ${boxShadow}`;
      });
    }
  }

  return { passed: rows.filter((r) => r.pass).length, failed: rows.filter((r) => !r.pass).length, rows };
}
