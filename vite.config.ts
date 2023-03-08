import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  css: {
    devSourcemap: true,
  },
  plugins: [
    react(),
    // We have already written a service worker unser src/service-worker.ts
    // We use VitePWA to build that service worker through Vite's pipeline, and to inject the manifest (via workbox-build's injectManifest mode)
    // We could remove the dependency by wiring that up manually, but for now this is ok
    VitePWA({
      // Just inject self.__WB_MANIFEST
      strategies: "injectManifest",
      // Do not add a registration handler; we do this manually in index.tsx and serviceWorkerRegistration.ts
      injectRegister: null,
      // Our custom service worker script is under src/service-worker.ts (instead of /public/service-worker.js)
      srcDir: "src",
      filename: "service-worker.ts",
      // Settings for injecting the manifest for precaching
      injectManifest: {
        // These URLs are already hashed, so no need to cache-bust them
        // NOTE: This is the default; leaving it here for posterity
        // dontCacheBustURLsMatching: /[.-][a-f0-9]{8}\./,
      },
      outDir: "dist",
    }),
    visualizer({ template: "sunburst" }),
  ],
});
