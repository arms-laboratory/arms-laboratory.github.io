import { test, expect } from "@playwright/test";

const labs = [
  "simulators.html",
  "architecture.html",
  "index.html",
  "timer.html",
  "interrupt.html",
  "encoder.html",
  "sampling.html",
  "frequency.html",
  "position.html",
  "motor.html",
  "timer-calculator.html",
  "speed-calculator.html",
];

for (const name of labs) {
  test(`Teaching page loads without script or asset errors: ${name}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        new URL(response.url()).origin === "http://127.0.0.1:4173"
      ) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    const response = await page.goto(`/teaching/mechatronics/${name}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(
      page.locator('.arms-main-nav a[aria-current="location"]'),
    ).toHaveAttribute("href", "/teaching/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://arms.engr.ucdavis.edu/teaching/mechatronics/${name}`,
    );
    expect(
      await page
        .locator(".arms-brand img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    ).toBe(true);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Teaching navigation reaches the collection and the CPU lab", async ({
  page,
}) => {
  await page.goto("/teaching/");
  await page
    .getByRole("link", { name: "Explore the mechatronics simulators" })
    .click();
  await expect(page).toHaveURL(/\/teaching\/mechatronics\/simulators.html$/);
  await page.getByRole("link", { name: /AVR CPU & Assembly Lab/ }).click();
  await expect(page).toHaveURL(/\/teaching\/mechatronics\/index.html$/);
  await expect(page.locator("#title")).not.toBeEmpty();
  await page.getByRole("button", { name: "Fetch", exact: false }).click();
  await expect(page.locator("#phase")).not.toHaveText("READY");
});

test("Teaching header supports keyboard and mobile navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/teaching/mechatronics/simulators.html");
  await page.keyboard.press("Tab");
  await expect(page.locator(".arms-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#teaching-content")).toBeFocused();
  if (testInfo.project.name === "phone") {
    const toggle = page.getByRole("button", { name: "Menu" });
    await expect(page.locator(".arms-main-nav")).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".arms-main-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(page.locator(".arms-main-nav")).toBeHidden();
  }
  await page
    .locator(".arms-course-trail")
    .getByRole("link", { name: "Teaching", exact: true })
    .click();
  await expect(page).toHaveURL(/\/teaching\/$/);
});

test("The AVR instruction reference PDF is available", async ({ request }) => {
  const response = await request.get("/teaching/mechatronics/manual.pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
});
