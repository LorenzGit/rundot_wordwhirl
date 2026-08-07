/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * Imported assets live under src/assets/ so Vite fingerprints them and
 * resolves deployment-safe URLs. Use public/ only for files that require an
 * exact, stable name.
 *
 * Boot contract:
 *   1. Loader visible immediately
 *   2. 'critical' awaited under the loader = only main-menu files
 *   3. Menu shows when critical is ready
 *   4. 'deferred' trickles after menu — never block first interaction
 *   5. Never put videos / heavy cutscenes in either gate bundle as preloads
 *
 * Keep 'critical' small: every asset here delays the main menu.
 */
import type { AssetsManifest, UnresolvedAsset } from "pixi.js";
import { skyUrlForLevel, SKY_COUNT } from "../game/skies.ts";

/**
 * A narrowing of Pixi's AssetsManifest: Pixi also allows `assets` to be a
 * record, but this template keeps it an array so the tier filters below can
 * check `assets.length`. Still assignable to AssetsManifest (Assets.init).
 */
export interface Manifest extends AssetsManifest {
    bundles: { name: string; assets: UnresolvedAsset[] }[];
}

const dawnUrl = skyUrlForLevel(1);
const deferredSkies: UnresolvedAsset[] = [];
for (let level = 2; level <= SKY_COUNT; level += 1) {
    deferredSkies.push({ alias: `wordwhirl-sky-l${String(level).padStart(2, "0")}`, src: skyUrlForLevel(level) });
}

export const MANIFEST: Manifest = {
    bundles: [
        {
            name: "critical",
            // Level-1 dawn is boot/menu default; stylesheets share the URL via CSS var.
            assets: [{ alias: "wordwhirl-sky-l01", src: dawnUrl }],
        },
        {
            name: "deferred",
            assets: deferredSkies,
        },
    ],
};

// Empty bundles are skipped so an unused tier never errors.
export const CRITICAL_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name !== "deferred" && b.assets.length > 0)
    .map((b) => b.name);

export const DEFERRED_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name === "deferred" && b.assets.length > 0)
    .map((b) => b.name);
