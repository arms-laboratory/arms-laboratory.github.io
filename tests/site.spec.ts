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
  "/members/alumni/",
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
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://arms.engr.ucdavis.edu${route}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("img:not([alt])")).toHaveCount(0);
    if (route === "/research/") {
      await expect(
        page.getByRole("link", { name: "Browse all 46 ARMS publications" }),
      ).toBeVisible();
    }
    if (route === "/") {
      await expect(page.locator(".reading-number")).toHaveText("46");
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
    if (
      process.env.ARMS_REVIEW_DIR &&
      [
        "/",
        "/research/",
        "/members/",
        "/members/alumni/",
        "/research/hybrid-manufacturing/",
      ].includes(route)
    ) {
      await mkdir(process.env.ARMS_REVIEW_DIR, { recursive: true });
      for (const image of await page.locator("main img:visible").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(
          process.env.ARMS_REVIEW_DIR,
          `update-${route.split("/").filter(Boolean).join("-") || "home"}-${test.info().project.name}.png`,
        ),
        fullPage: true,
      });
    }
  });
}

test("homepage research cards align and images load", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle(
    "Advanced Research for Manufacturing Systems | ARMS Laboratory, UC Davis",
  );
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
    expect(boxes[0].height).toBeGreaterThanOrEqual(350);
    expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThan(1);
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

test("research titles precede uncropped visuals across screen sizes", async ({
  page,
}, testInfo) => {
  const widths =
    testInfo.project.name === "desktop"
      ? [768, 900, 1024, 1280, 1440, 1920]
      : [360, 390, 600];
  for (const route of ["/", "/research/"]) {
    await page.goto(route);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      const cards = await page
        .locator(".research-grid article")
        .evaluateAll((elements) =>
          elements.map((card) => {
            const rect = (selector: string) =>
              card.querySelector(selector)!.getBoundingClientRect();
            const title = rect("h3");
            const media = rect(".research-media");
            const copy = rect(".research-copy");
            return {
              titleTop: title.top,
              titleBottom: title.bottom,
              mediaTop: media.top,
              mediaBottom: media.bottom,
              copyTop: copy.top,
            };
          }),
        );
      for (const card of cards) {
        expect(card.titleBottom).toBeLessThanOrEqual(card.mediaTop);
        expect(card.mediaBottom).toBeLessThanOrEqual(card.copyTop);
      }
      if (width > 900) {
        expect(Math.abs(cards[0].titleTop - cards[1].titleTop)).toBeLessThan(1);
        expect(Math.abs(cards[0].mediaTop - cards[1].mediaTop)).toBeLessThan(1);
        expect(Math.abs(cards[0].copyTop - cards[1].copyTop)).toBeLessThan(1);
      }
      expect(
        await page
          .locator(".research-media > img")
          .evaluate((el) => getComputedStyle(el).objectFit),
      ).toBe("contain");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (route === "/") {
        const intro = await page
          .locator(".lab-introduction")
          .evaluate((el) => ({
            headingBottom: el.querySelector("h2")!.getBoundingClientRect()
              .bottom,
            copyTop: el.querySelector("div + div")!.getBoundingClientRect().top,
          }));
        expect(intro.copyTop).toBeGreaterThan(intro.headingBottom);
      }
    }
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
  await expect(visible).toHaveCount(46);
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
  await expect(visible).toHaveCount(5);
  await page.locator("#pub-topic").selectOption("all");
  await page.locator("#pub-search").fill("Manufacturability-Driven");
  await expect(visible).toHaveCount(1);
  await expect(visible.locator("h3 a")).toHaveAttribute(
    "href",
    "https://doi.org/10.1007/s00170-026-19208-w",
  );
  await page.locator("#pub-search").fill("Productive Energy Fluence");
  await expect(visible).toHaveCount(1);
  await expect(visible.locator("h3 a")).toHaveAttribute(
    "href",
    "https://doi.org/10.1016/j.jmapro.2025.03.047",
  );
  await page.locator("#pub-search").fill("grid molding");
  await expect(visible).toHaveCount(1);
  await page.locator("#pub-search").fill("dual-camera");
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText("Lafirenza, M.");
  await expect(visible).toContainText(
    "Manufacturing Letters, 44, Supplement, 904–914",
  );
  await expect(
    visible.getByRole("link", { name: "View article" }),
  ).toHaveAttribute("href", "https://doi.org/10.1016/j.mfglet.2025.06.107");
  await page.locator("#pub-search").fill("no-matching-publication-xyz");
  await expect(visible).toHaveCount(0);
  await expect(page.locator("#pub-empty")).toBeVisible();
  await expect(page.locator(".pub-year:not([hidden])")).toHaveCount(0);
});

test("hybrid research balances figures and video on desktop and phone", async ({
  page,
}, testInfo) => {
  await page.goto("/research/hybrid-manufacturing/");
  const result = await page.locator("#grid-molding").evaluate((section) => {
    const heading = section.querySelector("h2")!.getBoundingClientRect();
    const copy = section
      .querySelector(".project-layout .project-story")!
      .getBoundingClientRect();
    const photo = section
      .querySelector(".project-layout figure")!
      .getBoundingClientRect();
    const process = section
      .querySelector(".diagram-scroll")!
      .getBoundingClientRect();
    const video = section
      .querySelector(".research-video")!
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
      processX: process.left,
      videoX: video.left,
      videoY: video.top,
      processBottom: process.bottom,
    };
  });
  expect(result.headingBottom).toBeLessThanOrEqual(result.copyY);
  expect(result.processY).toBeGreaterThan(result.photoBottom);
  if (testInfo.project.name === "desktop") {
    expect(result.photoX).toBeGreaterThan(result.copyX);
    expect(Math.abs(result.copyY - result.photoY)).toBeLessThan(1);
    expect(result.videoX).toBeGreaterThan(result.processX);
    expect(Math.abs(result.videoY - result.processY)).toBeLessThan(1);
  } else {
    expect(result.photoY).toBeGreaterThan(result.copyY);
    expect(result.videoY).toBeGreaterThan(result.processBottom);
    await page.locator(".diagram-scroll").focus();
    await expect(page.locator(".diagram-scroll")).toBeFocused();
  }
  for (const id of ["grid-molding", "ded-control", "process-planning"]) {
    const positions = await page.locator(`#${id}`).evaluate((section) => {
      const copy = section
        .querySelector(".project-layout .project-story")!
        .getBoundingClientRect();
      const figure = section
        .querySelector(".project-layout figure")!
        .getBoundingClientRect();
      const layout = section
        .querySelector(".project-layout")!
        .getBoundingClientRect();
      const video = section
        .querySelector(".research-video")
        ?.getBoundingClientRect();
      return {
        copyX: copy.left,
        copyY: copy.top,
        copyBottom: copy.bottom,
        figureX: figure.left,
        figureY: figure.top,
        layoutBottom: layout.bottom,
        videoY: video?.top,
      };
    });
    if (testInfo.project.name === "desktop") {
      expect(positions.figureX).toBeGreaterThan(positions.copyX);
      expect(Math.abs(positions.figureY - positions.copyY)).toBeLessThan(1);
    } else {
      expect(positions.figureY).toBeGreaterThan(positions.copyBottom);
    }
    if (positions.videoY !== undefined && id !== "ded-control")
      expect(positions.videoY).toBeGreaterThan(positions.layoutBottom);
  }
  for (const width of testInfo.project.name === "desktop"
    ? [1024, 1280, 1440, 1920]
    : [360, 390, 760]) {
    await page.setViewportSize({ width, height: 1000 });
    const ded = await page.locator("#ded-control").evaluate((section) => {
      const rect = (selector: string) =>
        section.querySelector(selector)!.getBoundingClientRect();
      const copy = rect(".project-story");
      const diagram = rect(".wide-figure");
      const video = rect(".research-video");
      return {
        copyX: copy.left,
        copyBottom: copy.bottom,
        diagramX: diagram.left,
        diagramBottom: diagram.bottom,
        diagramWidth: diagram.width,
        videoX: video.left,
        videoY: video.top,
        videoWidth: video.width,
      };
    });
    expect(Math.abs(ded.diagramX - ded.videoX)).toBeLessThan(1);
    expect(Math.abs(ded.diagramWidth - ded.videoWidth)).toBeLessThan(1);
    expect(ded.videoY - ded.diagramBottom).toBeGreaterThanOrEqual(23);
    expect(ded.videoY - ded.diagramBottom).toBeLessThanOrEqual(25);
    if (testInfo.project.name === "desktop") {
      expect(ded.videoX).toBeGreaterThan(ded.copyX);
      expect(ded.videoY).toBeLessThan(ded.copyBottom);
    } else {
      expect(ded.videoY).toBeGreaterThan(ded.copyBottom);
    }
  }
  await page.setViewportSize({
    width: testInfo.project.name === "desktop" ? 1440 : 390,
    height: 1000,
  });
  await page.locator(".more-demonstrations summary").click();
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  if (process.env.ARMS_REVIEW_DIR) {
    await page.locator(".more-demonstrations summary").click();
    await mkdir(process.env.ARMS_REVIEW_DIR, { recursive: true });
    await page.locator("#ded-control").screenshot({
      path: join(
        process.env.ARMS_REVIEW_DIR,
        `ded-control-${testInfo.project.name}.png`,
      ),
    });
  }
});

test("People links to all 26 alumni including the two 2026 graduates", async ({
  page,
}) => {
  await page.goto("/members/");
  await page.getByRole("link", { name: "Meet our alumni" }).click();
  await expect(page).toHaveURL(/\/members\/alumni\/$/);
  await expect(page.locator(".alumni-list > li")).toHaveCount(26);
  for (const name of ["Kazi Owais Ahmed", "Weijun Zhang"]) {
    const person = page
      .locator(".alumni-list > li")
      .filter({ has: page.getByRole("heading", { name: new RegExp(name) }) });
    await expect(person).toContainText("Ph.D.: UC Davis, 2026");
  }
  await expect(page.locator(".alumni-list > li").last()).toContainText(
    "Shuai Zhao",
  );
  await expect(page.locator('#main-nav a[href="/members/"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page
    .getByRole("link", { name: "Meet the current researchers" })
    .click();
  await expect(page).toHaveURL(/\/members\/$/);
});

test("research videos load only on request and remain available as direct links", async ({
  page,
}) => {
  const youtubeRequests: string[] = [];
  await page.route(
    /https:\/\/[^/]*(?:youtube|ytimg)\.[^/]+\//,
    async (route) => {
      youtubeRequests.push(route.request().url());
      await route.fulfill({
        contentType: "text/html",
        body: "<html lang='en'><title>Research video</title><body>Video player</body></html>",
      });
    },
  );
  await page.goto("/research/hybrid-manufacturing/");
  await expect(page.locator(".research-video")).toHaveCount(4);
  await expect(page.locator(".video-frame iframe")).toHaveCount(0);
  expect(youtubeRequests).toEqual([]);
  const gridVideo = page.locator("#grid-molding .research-video");
  await expect(
    gridVideo.getByRole("link", { name: "Watch on YouTube" }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=CHoZDgIJ8vY");
  await gridVideo.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(gridVideo.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/CHoZDgIJ8vY?rel=0",
  );
  await expect(gridVideo.locator("iframe")).toHaveAttribute(
    "title",
    "Grid molding fabrication",
  );
  const more = page.locator(".more-demonstrations");
  await expect(more).not.toHaveAttribute("open", "");
  await more.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("open", "");
  for (const id of ["lYD_JZTOk1c", "1j6TkN9_cVI", "lqQTS4TozRM"]) {
    const frame = page.locator(`[data-video-id="${id}"]`);
    await frame.getByRole("button").click();
    await expect(frame.locator("iframe")).toHaveAttribute(
      "src",
      `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    );
  }
  await expect(page.locator(".video-frame iframe")).toHaveCount(4);
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

test("search engine files use the university domain", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(
    "Sitemap: https://arms.engr.ucdavis.edu/sitemap.xml",
  );
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).not.toContain("https://arms-laboratory.github.io");
  expect(xml.match(/<loc>https:\/\/arms\.engr\.ucdavis\.edu\//g)?.length).toBe(
    10,
  );
});
