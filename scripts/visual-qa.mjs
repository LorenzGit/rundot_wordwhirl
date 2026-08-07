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

    // The level clear fires the celebration burst. Sample it frame by frame:
    // a unit mismatch in the particle integrator reads as normal particle
    // counts but absurd velocities, so assert on motion, not just presence.
    const particles = await page.evaluate(
        () =>
            new Promise((resolve) => {
                const start = performance.now();
                const samples = [];
                let peak = 0;
                const step = () => {
                    const data = window.__wordwhirlQaGeometry();
                    peak = Math.max(peak, data.particles.length);
                    samples.push(...data.particles);
                    if (performance.now() - start < 1500) requestAnimationFrame(step);
                    else
                        resolve({
                            designWidth: data.designWidth,
                            designHeight: data.designHeight,
                            cssPerDesignUnit: window.innerHeight / data.designHeight,
                            peak,
                            total: samples.length,
                            offscreen: samples.filter(
                                (p) =>
                                    p.x < -60 ||
                                    p.x > data.designWidth + 60 ||
                                    p.y < -60 ||
                                    p.y > data.designHeight + 60,
                            ).length,
                            maxSpeed: Math.max(0, ...samples.map((p) => Math.abs(p.vy))),
                            maxRadius: Math.max(0, ...samples.map((p) => p.radius)),
                        });
                };
                requestAnimationFrame(step);
            }),
    );
    const offscreenShare = particles.total ? particles.offscreen / particles.total : 1;
    const maxRadiusCss = particles.maxRadius * particles.cssPerDesignUnit;
    if (particles.peak < 20) problems.push(`behaviour: celebration emitted only ${particles.peak} particles`);
    if (offscreenShare > 0.05)
        problems.push(`behaviour: ${(offscreenShare * 100).toFixed(0)}% of particle frames rendered offscreen`);
    if (particles.maxSpeed > 3000)
        problems.push(`behaviour: particle speed peaked at ${Math.round(particles.maxSpeed)} units/s`);
    if (maxRadiusCss < 2)
        problems.push(`behaviour: largest particle is only ${maxRadiusCss.toFixed(1)} CSS px and will not read`);
    evidence.behaviour.particles = {
        peak: particles.peak,
        offscreenPct: +(offscreenShare * 100).toFixed(1),
        maxSpeedUnitsPerSec: Math.round(particles.maxSpeed),
        maxRadiusCssPx: +maxRadiusCss.toFixed(1),
    };

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
