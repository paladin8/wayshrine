import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { preview } from "vite";

test("production build starts, explores, and resumes a journey", { timeout: 90_000 }, async (t) => {
  await access(new URL("../dist/index.html", import.meta.url));
  const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: true } });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  });
  const address = server.httpServer.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const titleMusic = new URL("/audio/music/homeward-breeze.mp3", origin).href;
  const navigation = { waitUntil: "domcontentloaded", timeout: 60_000 };

  browser = await chromium.launch({
    // CI has no physical GPU. Allow Chromium to use its software WebGL renderer.
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });

  const page = await browser.newPage({ locale: "en-US", reducedMotion: "reduce" });
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(origin + "/") && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "unknown";
    // Replacing the page can cancel in-flight audio streams and preloads.
    if (req.url().startsWith(origin + "/audio/") && req.resourceType() === "media" && reason === "net::ERR_ABORTED") return;
    errors.push(`requestfailed: ${req.method()} ${req.url()} (${reason})`);
  });
  const startGame = async (start) => {
    const terrainWorker = page.waitForEvent("worker", {
      predicate: (worker) => new URL(worker.url()).pathname.includes("/assets/chunk-worker-"),
    });
    await Promise.all([start.click(), terrainWorker]);
    await page.locator("body > canvas[data-engine]").waitFor();
    await page.locator(".hud").waitFor();
  };

  const audio = await page.request.get(titleMusic, { headers: { Range: "bytes=0-1023" } });
  assert.equal(audio.status(), 206, "title music must support partial downloads");
  assert.equal((await audio.body()).length, 1024);
  await audio.dispose();

  await page.goto(origin, navigation);
  const menu = page.locator(".ts-panel");
  await menu.waitFor({ state: "visible" });
  const resume = menu.getByRole("button", { name: /^Continue/ });
  await menu.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("textbox", { name: /^World seed/ }).fill("browser-smoke");
  await startGame(page.locator(".sp-overlay.open .ts-btn.primary"));

  await page.keyboard.press("m");
  await page.locator(".map.large").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".map.small").waitFor();
  await page.keyboard.press("z");

  await page.locator(".hud .gear").click();
  await Promise.all([
    page.waitForEvent("domcontentloaded", { timeout: navigation.timeout }),
    page.getByRole("button", { name: "Return to title" }).click(),
  ]);
  await menu.waitFor();
  assert.match(await resume.innerText(), /browser-smoke/);
  await page.reload(navigation);
  await startGame(resume);

  assert.equal(await page.locator(".crash").count(), 0);
  assert.deepEqual([...errors], []);
});
