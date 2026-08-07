#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const root = process.cwd();
const output = path.join(root, "tmp", "visual-qa");
const port = 5395;
const viewports = [
    { name: "phone-small", width: 320, height: 568, scale: 2 },
    { name: "phone-tall", width: 390, height: 844, scale: 2 },
    { name: "tablet", width: 768, height: 1024, scale: 2 },
    { name: "tablet-wide", width: 1024, height: 768, scale: 1 },
    { name: "desktop", width: 1440, height: 900, scale: 1 },
];
const screens = ["main", "route", "shop", "settings", "how-to", "game", "results"];
fs.mkdirSync(output, { recursive: true });

const server = await createServer({
    configFile: path.join(root, "vite.config.js"),
    logLevel: "silent",
    server: { port, strictPort: true },
});
await server.listen();
const problems = [];
const evidence = { screenshots: [], smallestDomTextPx: Infinity, smallestTarget: Infinity, behaviour: {} };
let browser;

try {
    browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    for (const viewport of viewports) {
        const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.scale,
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => problems.push(`${viewport.name}: page error: ${error.message}`));
        page.on("console", (message) => {
            if (message.type() === "error") problems.push(`${viewport.name}: console error: ${message.text()}`);
        });
        for (const screen of screens) {
            await page.goto(`http://localhost:${port}/?screen=${screen}&qa=1`, { waitUntil: "load" });
            await page.waitForTimeout(screen === "game" ? 900 : screen === "results" ? 2000 : 350);
            const shot = path.join(output, `${viewport.name}-${screen}.png`);
            await page.screenshot({ path: shot });
            evidence.screenshots.push(shot);
            const metrics = await page.evaluate(() => {
                const visible = [...document.querySelectorAll("body *")].filter((element) => {
                    const style = getComputedStyle(element);
                    return (
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        element.getBoundingClientRect().width > 0
                    );
                });
                const textSizes = visible
                    .filter((element) => (element.textContent ?? "").trim() && element.children.length === 0)
                    .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
                    .filter(Number.isFinite);
                const targets = [...document.querySelectorAll("button, input, select")]
                    .filter((element) => !element.matches(":disabled"))
                    .map((element) =>
                        Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height),
                    );
                return {
                    text: textSizes.length ? Math.min(...textSizes) : 999,
                    target: targets.length ? Math.min(...targets) : 999,
                    overflow: document.documentElement.scrollWidth > innerWidth + 1,
                };
            });
            evidence.smallestDomTextPx = Math.min(evidence.smallestDomTextPx, metrics.text);
            evidence.smallestTarget = Math.min(evidence.smallestTarget, metrics.target);
            if (metrics.text < 10) problems.push(`${viewport.name}/${screen}: DOM text ${metrics.text}px below 10px`);
            if (metrics.target < 44) problems.push(`${viewport.name}/${screen}: target ${metrics.target}px below 44px`);
            if (metrics.overflow) problems.push(`${viewport.name}/${screen}: horizontal page overflow`);
        }
        await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on("pageerror", (error) => problems.push(`behaviour: page error: ${error.message}`));
    await page.goto(`http://localhost:${port}/?screen=game&qa=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__gameQa && window.__wordwhirlQaGeometry, null, { timeout: 10_000 });
    await page.evaluate(() => window.__gameQa.seedLevel(1));
    await page.waitForTimeout(500);
    const geometry = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        const data = window.__wordwhirlQaGeometry();
        return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, data };
    });
    const point = (letter) => {
        const found = geometry.data.letters.find((entry) => entry.letter === letter);
        if (!found) throw new Error(`missing ${letter} geometry`);
        return {
            x: geometry.rect.x + (found.x / geometry.data.designWidth) * geometry.rect.width,
            y: geometry.rect.y + (found.y / geometry.data.designHeight) * geometry.rect.height,
        };
    };
    const pathPoints = [point("S"), point("U"), point("N")];
    await page.mouse.move(pathPoints[0].x, pathPoints[0].y);
    await page.mouse.down();
    for (const next of pathPoints.slice(1)) await page.mouse.move(next.x, next.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__gameQa.snapshot().result !== null, null, { timeout: 4_000 });
    evidence.behaviour.swipeCompletesLevel = true;

    await page.evaluate(() => window.__gameQa.seedLevel(2));
    await page.waitForTimeout(450);
    await page.keyboard.type("WON");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__gameQa.snapshot().foundWords.includes("WON"), null, { timeout: 2_000 });
    evidence.behaviour.keyboardAcceptsWord = true;

    await page.evaluate(() => window.__gameQa.seedLevel(3));
    await page.waitForTimeout(450);
    await page.evaluate(() => window.__gameQa.hint());
    const hinted = await page.evaluate(() => window.__gameQa.snapshot());
    if (hinted.revealedCells.length !== 1) problems.push("behaviour: free hint did not reveal exactly one cell");
    evidence.behaviour.freeHint = hinted.revealedCells.length === 1;

    await page.evaluate(() => window.__gameQa.setPaused(true));
    if (!(await page.evaluate(() => window.__gameQa.snapshot().paused)))
        problems.push("behaviour: pause did not engage");
    await page.evaluate(() => window.__gameQa.setPaused(false));
    evidence.behaviour.pauseResume = true;

    await page.evaluate(() => window.__gameQa.setSetting("reducedMotion", true));
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__gameQa, null, { timeout: 10_000 });
    if (!(await page.evaluate(() => window.__gameQa.snapshot().reducedMotion)))
        problems.push("behaviour: reduced motion did not persist");
    await page.evaluate(() => window.__gameQa.setSetting("reducedMotion", false));
    evidence.behaviour.saveReload = true;
    await context.close();
} finally {
    await browser?.close();
    await server.close();
}

fs.writeFileSync(path.join(output, "visual-qa-report.json"), JSON.stringify({ ...evidence, problems }, null, 2));
if (problems.length) {
    console.error(`Visual QA failed (${problems.length}):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
} else
    console.log(
        `Visual QA passed: ${evidence.screenshots.length} captures; swipe, keyboard, hint, pause, and save/reload verified.`,
    );
