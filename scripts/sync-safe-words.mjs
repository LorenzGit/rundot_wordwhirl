#!/usr/bin/env node
/**
 * Sync src/game/words/safeWords.data.ts from the root allow-list file.
 * Source of truth: safe-english-words-3to6.txt (3–6 letter English words).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcPath = path.join(root, "safe-english-words-3to6.txt");
const outPath = path.join(root, "src", "game", "words", "safeWords.data.ts");

if (!fs.existsSync(srcPath)) {
    console.error(`Missing source word list: ${srcPath}`);
    process.exit(1);
}

const words = fs
    .readFileSync(srcPath, "utf8")
    .split(/\n/)
    .map((line) => line.trim().toUpperCase())
    .filter((word) => word.length >= 3 && word.length <= 6 && /^[A-Z]+$/.test(word));

const seen = new Set();
const unique = [];
for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    unique.push(word);
}

const body = `/**
 * AUTO-GENERATED from /safe-english-words-3to6.txt
 * Do not edit by hand. Regenerate with: node scripts/sync-safe-words.mjs
 */
export const SAFE_WORD_LIST = Object.freeze([
${unique.map((word) => `    "${word}",`).join("\n")}
] as const);

export type SafeWord = (typeof SAFE_WORD_LIST)[number];
`;

fs.writeFileSync(outPath, body);
console.log(`Synced ${unique.length} safe words → ${path.relative(root, outPath)}`);
