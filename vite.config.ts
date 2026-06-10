import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import istanbul from "vite-plugin-istanbul";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ``);

  if (!env.VITE_API_BASE_URL?.trim()) {
    throw new Error(`VITE_API_BASE_URL is required and must be non-empty for Athena frontend builds.`);
  }

  return {
    root: "src",
    publicDir: false,
    resolve: {
      alias: {
        "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      },
    },
    plugins: [...(process.env.COVERAGE ? [istanbul({ include: "src/**/*.{ts,tsx}", exclude: ["node_modules", "testing/**", "src/**/*.spec.ts"] })] : [])],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: "../dist/public",
      emptyOutDir: true,
    },
  };
});
