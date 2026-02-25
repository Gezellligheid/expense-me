import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Keep our hand-crafted public/manifest.json — don't auto-generate one
      manifest: false,
      workbox: {
        // Pre-cache all JS, CSS, HTML, images and fonts
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Cache Google Fonts, Firebase SDK and other CDN assets at runtime
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "firebase-cache" },
          },
        ],
        // Gracefully handle navigation for SPA routing
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        // Enables the SW in dev mode so "install" prompt appears locally
        enabled: true,
        type: "module",
      },
    }),
  ],
});
