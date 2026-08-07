#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root = process.cwd();
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(root, "scripts", "thumbnail.html")).href, { waitUntil: "load" });
    await page.screenshot({ path: path.join(root, "public", "thumbnail.jpg"), type: "jpeg", quality: 92 });
    console.log("Rendered public/thumbnail.jpg (512x512 JPG).");
} finally {
    await browser.close();
}
