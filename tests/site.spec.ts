import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const routes = [
  "/",
  "/research/",
  "/research/agentic-manufacturing/",
  "/research/hybrid-manufacturing/",
  "/about/",
  "/members/",
  "/open-positions/",
  "/publications/",
  "/visit/",
  "/map/",
  "/facilities/",
];
for (const route of routes) {
  test(`layout and accessibility: ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("img:not([alt])")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
}

test("homepage research cards align and images load", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  if (testInfo.project.name === "desktop") {
    const boxes = await page
      .locator(".research-grid article")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          height: card.querySelector(".research-media")!.getBoundingClientRect()
            .height,
          heading: card.querySelector("h3")!.getBoundingClientRect().top,
          copy: card
            .querySelector(".research-copy > p:not(.research-index)")!
            .getBoundingClientRect().top,
        })),
      );
    expect(boxes[0].height).toBe(350);
    expect(boxes[1].height).toBe(350);
    expect(Math.abs(boxes[0].heading - boxes[1].heading)).toBeLessThan(1);
    expect(Math.abs(boxes[0].copy - boxes[1].copy)).toBeLessThan(1);
  }
  if (process.env.ARMS_REVIEW_DIR) {
    await mkdir(process.env.ARMS_REVIEW_DIR, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(
        process.env.ARMS_REVIEW_DIR,
        `release-home-${testInfo.project.name}.png`,
      ),
      fullPage: testInfo.project.name === "phone",
    });
  }
});

test("publications expand, filter, search, and report no results", async ({
  page,
}) => {
  await page.goto("/publications/");
  const visible = page.locator(".pub-entry:not([hidden])");
  await expect(visible).toHaveCount(5);
  await page.locator("#pub-expand").focus();
  await page.keyboard.press("Enter");
  await expect(visible).toHaveCount(44);
  await expect(page.locator("#pub-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#pub-expand")).toBeFocused();
  expect(
    await page
      .locator("#pub-expand")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  await page.locator("#pub-topic").selectOption("hybrid");
  await expect(visible).toHaveCount(4);
  await page.locator("#pub-topic").selectOption("all");
  await page.locator("#pub-search").fill("grid molding");
  await expect(visible).toHaveCount(1);
  await page.locator("#pub-search").fill("no-matching-publication-xyz");
  await expect(visible).toHaveCount(0);
  await expect(page.locator("#pub-empty")).toBeVisible();
  await expect(page.locator(".pub-year:not([hidden])")).toHaveCount(0);
});

test("hybrid research keeps specimen and process figure layout", async ({
  page,
}, testInfo) => {
  await page.goto("/research/hybrid-manufacturing/");
  const result = await page.locator("#grid-molding").evaluate((section) => {
    const heading = section.querySelector("h2")!.getBoundingClientRect();
    const copy = section
      .querySelector(".grid-overview p")!
      .getBoundingClientRect();
    const photo = section
      .querySelector(".grid-overview figure")!
      .getBoundingClientRect();
    const process = section
      .querySelector(".diagram-scroll")!
      .getBoundingClientRect();
    return {
      headingBottom: heading.bottom,
      copyY: copy.top,
      copyX: copy.left,
      photoY: photo.top,
      photoX: photo.left,
      photoBottom: photo.bottom,
      processY: process.top,
      processWidth: process.width,
      photoWidth: photo.width,
    };
  });
  expect(result.headingBottom).toBeLessThanOrEqual(result.copyY);
  expect(result.processY).toBeGreaterThan(result.photoBottom);
  if (testInfo.project.name === "desktop") {
    expect(result.photoX).toBeGreaterThan(result.copyX);
    expect(Math.abs(result.copyY - result.photoY)).toBeLessThan(1);
    expect(result.processWidth).toBeGreaterThan(result.photoWidth * 2);
  } else {
    expect(result.photoY).toBeGreaterThan(result.copyY);
    await page.locator(".diagram-scroll").focus();
    await expect(page.locator(".diagram-scroll")).toBeFocused();
  }
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test("keyboard navigation and mobile menu", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  expect(
    await page
      .locator(".skip-link")
      .evaluate((el) => el.getBoundingClientRect().top),
  ).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  if (testInfo.project.name === "phone") {
    const toggle = page.locator(".menu-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#main-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(page.locator("#main-nav")).toBeHidden();
  }
});

test("reduced motion disables smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
});
