// Playwright check for the Topbar menu (phase 2). Run through the Playwright MCP `browser_run_code_unsafe` with this file
// as `filename`, in a session that is already signed in. Dev server: http://localhost:4401.
// Returns one { name, pass, detail } row per scenario.
async (page) => {
  const BASE = "http://localhost:4401";
  const SHOTS = "C:/Users/pwojno/Documents/Hajsownik/context/changes/topbar-menu-close-on-outside/screenshots";
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

  const isOpen = (menu) => menu.evaluate((d) => d.open);
  const summaryFocused = (menu) => menu.evaluate((d) => document.activeElement === d.querySelector(":scope > summary"));

  async function prepare(width, height) {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
    const menu = page.locator("details[data-topbar-menu]:visible");
    await menu.first().waitFor({ state: "visible" });
    expect((await menu.count()) === 1, `expected 1 visible top-level menu, got ${await menu.count()}`);
    return menu;
  }
  async function open(menu) {
    await menu.locator(":scope > summary").click();
    expect(await isOpen(menu), "menu did not open on summary click");
  }

  for (const [label, width, height, outside] of [
    ["phone 390px", 390, 844, { x: 200, y: 780 }],
    ["desktop 1280px", 1280, 800, { x: 900, y: 650 }],
  ]) {
    let menu = await prepare(width, height);

    await step(`${label}: summary click toggles open and closed`, async () => {
      await open(menu);
      await menu.locator(":scope > summary").click();
      expect(!(await isOpen(menu)), "second summary click did not close the menu");
    });

    await step(`${label}: click outside closes`, async () => {
      await open(menu);
      await page.mouse.click(outside.x, outside.y);
      expect(!(await isOpen(menu)), "menu still open after click outside");
    });

    await step(`${label}: Esc closes and focus returns to summary`, async () => {
      await open(menu);
      await page.keyboard.press("Escape");
      expect(!(await isOpen(menu)), "menu still open after Esc");
      expect(await summaryFocused(menu), "focus is not on the summary after Esc");
    });

    await step(`${label}: Tab out of the menu closes`, async () => {
      await open(menu);
      let tabs = 0;
      while ((await isOpen(menu)) && tabs < 8) {
        await page.keyboard.press("Tab");
        tabs += 1;
      }
      expect(!(await isOpen(menu)), "menu still open after 8 Tab presses");
      return `closed after ${tabs} Tab`;
    });

    await step(`${label}: click inside the open menu does not close it`, async () => {
      await open(menu);
      const box = await menu.locator(":scope > nav, :scope > ul").boundingBox();
      expect(box, "menu panel has no box");
      // Left padding of the panel at mid height: inside the menu, not on a link, away from the rounded corners
      // (a click on a corner falls through to the page behind and counts as outside).
      await page.mouse.click(box.x + 2, box.y + box.height / 2);
      expect(await isOpen(menu), "menu closed after click on its own padding");
    });

    await step(`${label}: screenshot of the open menu`, async () => {
      expect(await isOpen(menu), "menu is not open for the screenshot");
      await page.screenshot({ path: `${SHOTS}/menu-open-${width}.png` });
      return `menu-open-${width}.png`;
    });

    if (width < 640) {
      await step(`${label}: nested Settings keeps the hamburger open`, async () => {
        const nested = menu.locator("details");
        await nested.locator(":scope > summary").click();
        expect(await nested.evaluate((d) => d.open), "nested Settings did not open");
        expect(await isOpen(menu), "hamburger closed when nested summary was clicked");
        const box = await nested.locator(":scope > div").boundingBox();
        expect(box, "nested list has no box");
        await page.mouse.click(box.x + 2, box.y + box.height / 2);
        expect(await isOpen(menu), "hamburger closed after click inside nested list");
        await page.screenshot({ path: `${SHOTS}/menu-nested-open-${width}.png` });
      });
    }

    await step(`${label}: click outside closes (menu opened again)`, async () => {
      if (!(await isOpen(menu))) await open(menu);
      await page.mouse.click(outside.x, outside.y);
      expect(!(await isOpen(menu)), "menu still open after click outside");
    });

    await step(`${label}: menu link navigates`, async () => {
      menu = await prepare(width, height);
      await open(menu);
      const target = width < 640 ? "Historia" : "Kategorie";
      await menu.getByRole("link", { name: target }).click();
      await page.waitForURL(/\/(history|settings\/categories)/, { timeout: 30000 });
      return page.url();
    });
  }

  return { passed: rows.filter((r) => r.pass).length, failed: rows.filter((r) => !r.pass).length, rows };
}
