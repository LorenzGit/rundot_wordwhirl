import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from "@series-inc/rundot-game-sdk/vite";

const plugins = [rundotGameLibrariesPlugin(), react(), tailwindcss()];

// Playground is opt-in because it signs in to real RUN services and purchases persist.
if (process.env.RUNDOT_PLAYGROUND === "1") plugins.push(rundotGamePlaygroundPlugin());

export default defineConfig({
    base: "./",
    plugins,
    server: { allowedHosts: true, port: 5183 },
    build: {
        target: "es2022",
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                /**
                 * Vendor libraries get their own chunks so they cache
                 * independently of game code — and so the standalone build,
                 * where React is bundled rather than supplied by the RUN host,
                 * does not pile everything into one chunk over the 600 kB
                 * budget `scripts/check-build.mjs` enforces.
                 */
                manualChunks(id) {
                    if (!id.includes("node_modules")) return undefined;
                    if (id.includes("node_modules/pixi.js")) return "pixi";
                    if (/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return "react";
                    return undefined;
                },
            },
        },
    },
    esbuild: { target: "es2022" },
    optimizeDeps: { esbuildOptions: { target: "es2022" } },
});
