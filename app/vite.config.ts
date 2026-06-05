import { defineConfig } from "vite";
import istanbul from "vite-plugin-istanbul";

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  root: "src",
  publicDir: false,
  plugins: [...(process.env.COVERAGE ? [istanbul({ include: "src/**/*.{ts,tsx}", exclude: ["node_modules", "testing/**", "src/**/*.spec.ts"] })] : [])],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/_status": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
});
