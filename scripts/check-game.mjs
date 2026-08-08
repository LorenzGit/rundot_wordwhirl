#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const check = (condition, message) => {
    if (!condition) failures.push(message);
};

const platform = read("src/config/platform.ts");
const shop = json("rundot/shop.config.json");
const liveops = json("rundot/liveops.config.json");
const packageJson = json("package.json");
const gameConfig = json("game.config.prod.json");
const design = read("DESIGN.md");
const menu = read("src/ui/MainMenu.tsx");
const app = read("src/ui/App.tsx");
const sdk = read("src/sdk/runSdk.ts");

const ids = new Map([...platform.matchAll(/^\s{4}(\w+):\s*"([^"]+)"/gm)].map((match) => [match[1], match[2]]));
check(ids.get("rewardedHint") === "wordwhirl_hint_rewarded", "rewarded hint id drifted");
check(
    shop.items?.some((item) => item.itemId === ids.get("auroraCompassItem")),
    "shop item does not match platform registry",
);
const item = shop.items?.find((entry) => entry.itemId === ids.get("auroraCompassItem"));
check(item?.price?.type === "bucks" && item?.price?.value === "199", "Aurora Compass must cost 199 RB");
check(item?.active === true && item?.unique === true, "Aurora Compass must be active and unique");
check(
    item?.entitlements?.some(
        (entry) => entry.entitlementId === ids.get("auroraCompassEntitlement") && entry.consumable === false,
    ),
    "durable entitlement mismatch",
);
const hintPack = shop.items?.find((entry) => entry.itemId === ids.get("hintPackItem"));
check(hintPack?.price?.type === "bucks" && hintPack?.price?.value === "200", "Hint pack must cost 200 RB");
check(hintPack?.unique === false && hintPack?.active === true, "Hint pack must be active consumable");
check(
    hintPack?.entitlements?.some(
        (entry) => entry.entitlementId === ids.get("hintPackEntitlement") && entry.quantity === 30,
    ),
    "hint pack entitlement quantity must be 30",
);
const monetization = liveops.client?.values?.wordwhirl_monetization;
check(
    monetization?.enabled === true &&
        monetization?.purchasesEnabled === true &&
        monetization?.rewardedAdsEnabled === true,
    "LiveOps does not ship enabled monetization flags",
);
check(monetization?.placements?.hint_reveal?.enabled === true, "hint placement is disabled in LiveOps");
check(
    design.includes("200 RB") && design.includes("wordwhirl_hint_rewarded") && design.includes("start with **3**"),
    "DESIGN.md monetization brief drifted",
);
const controller = read("src/game/gameController.ts");
check(controller.includes("HINT_ECONOMY") && controller.includes("WATCH AD"), "hint stock economy not wired");
check(read("src/state/store.ts").includes("hints: 3"), "starter hint stock must be 3");

check(packageJson.name === "wordwhirl", "package name must be wordwhirl");
// Kept in lockstep with the version RUN serves, so the menu label matches the deployed build.
check(/^\d+\.\d+\.\d+$/.test(packageJson.version), "visible version must be valid semver");
check(
    menu.includes("packageJson.version") && menu.includes("v{packageJson.version}"),
    "visible version is not sourced from package.json",
);
check(app.includes('id="app-frame" tabIndex={-1}'), "app frame cannot receive focus after a host overlay");
check(sdk.includes('getElementById("app-frame")?.focus'), "host overlays do not restore keyboard focus");
check(String(gameConfig.orientation || "").toLowerCase() === "portrait", "RUN orientation must be Portrait");
check(Array.isArray(gameConfig.keywords) && gameConfig.keywords.length >= 3, "catalog needs at least three keywords");

// Dictionary allow-list: runtime set must match safe-english-words-3to6.txt,
// and every handcrafted answer/bonus must be a member of that set.
const safeSourcePath = path.join(root, "safe-english-words-3to6.txt");
check(fs.existsSync(safeSourcePath), "safe-english-words-3to6.txt is missing");
const safeFromFile = new Set(
    fs
        .readFileSync(safeSourcePath, "utf8")
        .split(/\n/)
        .map((line) => line.trim().toUpperCase())
        .filter((word) => word.length >= 3 && word.length <= 6 && /^[A-Z]+$/.test(word)),
);
const safeData = read("src/game/words/safeWords.data.ts");
const safeFromData = new Set([...safeData.matchAll(/"([A-Z]{3,6})"/g)].map((match) => match[1]));
check(safeFromData.size === safeFromFile.size, "safeWords.data.ts size drifted from safe-english-words-3to6.txt");
for (const word of safeFromFile) {
    if (!safeFromData.has(word)) {
        check(false, `safeWords.data.ts missing ${word}`);
        break;
    }
}
const levelsSource = read("src/game/words/levels.ts");
const answerBlocks = [...levelsSource.matchAll(/answers:\s*\[([^\]]*)\]/g)].map((match) => match[1]);
const bonusBlocks = [...levelsSource.matchAll(/bonus:\s*\[([^\]]*)\]/g)].map((match) => match[1]);
const levelWords = [...answerBlocks, ...bonusBlocks].flatMap((block) =>
    [...block.matchAll(/"([A-Z]+)"/g)].map((match) => match[1]),
);
check(levelWords.length > 0, "no level answer/bonus words found to audit");
for (const word of levelWords) {
    check(word.length >= 3 && word.length <= 6, `level word "${word}" must be 3–6 letters`);
    check(safeFromFile.has(word), `level word "${word}" is not in safe-english-words-3to6.txt`);
}
const levelsModule = read("src/game/words/levels.ts");
check(levelsModule.includes("LEVEL_LENGTH_BANDS"), "levels must declare length difficulty bands");
check(levelsModule.includes("maxWordLengthForLevel"), "levels must expose maxWordLengthForLevel");
check(read("src/game/words/rules.ts").includes("isSafeWord"), "evaluateWord must gate on isSafeWord");
check(read("src/game/words/dictionary.ts").includes("SAFE_WORDS"), "dictionary module missing SAFE_WORDS");

const sourceFiles = [];
function walk(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const child = path.join(relative, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (/\.(tsx?|css|html)$/.test(entry.name)) sourceFiles.push(child);
    }
}
walk("src");
for (const file of sourceFiles) {
    const source = read(file);
    check(!source.includes("Math.random("), `${file} uses Math.random()`);
    check(!/PIXEL FOUNDRY|Pixel Foundry|rundot_template/.test(source), `${file} retains template identity`);
}
check(!read("index.html").includes("PIXEL FOUNDRY"), "boot shell retains template identity");

const thumbnailPath = path.join(root, "public", "thumbnail.jpg");
check(fs.existsSync(thumbnailPath), "thumbnail.jpg is missing");
if (fs.existsSync(thumbnailPath)) {
    const bytes = fs.readFileSync(thumbnailPath);
    check(bytes.length > 10_000, `thumbnail.jpg is only ${bytes.length} bytes`);
    let dimensions = null;
    for (let offset = 2; offset + 9 < bytes.length; ) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1];
        const size = bytes.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xc3) {
            dimensions = { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
            break;
        }
        offset += 2 + size;
    }
    check(
        dimensions?.width === 512 && dimensions?.height === 512,
        `thumbnail must be 512x512, got ${dimensions?.width ?? "?"}x${dimensions?.height ?? "?"}`,
    );
}

if (failures.length) {
    console.error(`Game invariants failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else console.log("Game invariants passed.");
