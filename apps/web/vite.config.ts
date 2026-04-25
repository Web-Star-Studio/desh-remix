import { defineConfig } from "vite";

import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png", "desh-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gstatic-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Group heavy/seldom-used libs into their own chunks so the landing
        // page only downloads what it needs. Anything not listed stays in the
        // route-level lazy chunks (App.tsx React.lazy splits handle the rest).
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          // CRITICAL: React must be in its own chunk loaded before any other
          // vendor chunk that depends on it (tiptap, radix, framer, etc.).
          // Otherwise dynamic imports may execute before React globals exist,
          // causing "Cannot read properties of undefined (reading 'useState')".
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/") ||
            id.includes("/node_modules/react/jsx-runtime") ||
            id.includes("/node_modules/react/jsx-dev-runtime")
          ) {
            return "vendor-react";
          }
          // Vendors used only inside the dashboard / heavy editors / charts
          if (id.includes("mapbox-gl")) return "vendor-mapbox";
          if (id.includes("recharts")) return "vendor-recharts";
          if (id.includes("@tiptap") || id.includes("tippy.js") || id.includes("prosemirror"))
            return "vendor-tiptap";
          if (id.includes("react-syntax-highlighter") || id.includes("refractor") || id.includes("highlight.js"))
            return "vendor-syntax";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("micromark") || id.includes("mdast"))
            return "vendor-markdown";
          if (id.includes("@supabase/")) return "vendor-supabase";
          if (id.includes("@tanstack/react-query")) return "vendor-tanstack";
          if (id.includes("@radix-ui/")) return "vendor-radix";
          // framer-motion is widely used (incl. landings) — keep its own chunk
          if (id.includes("framer-motion")) return "vendor-framer";
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "vendor-dates";
          if (id.includes("dompurify") || id.includes("canvas-confetti") || id.includes("embla-carousel"))
            return "vendor-misc";
          return undefined;
        },
      },
    },
  },
}));
