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
        chunkSizeWarningLimit: 600,
        rollupOptions: { output: { manualChunks: { pixi: ["pixi.js"] } } },
    },
    esbuild: { target: "es2022" },
    optimizeDeps: { esbuildOptions: { target: "es2022" } },
});
