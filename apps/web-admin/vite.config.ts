import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // 워크스페이스 패키지는 "@repo/source" 조건으로 dist 대신 src를 읽는다(HMR 즉시 반영).
    conditions: ["@repo/source", ...defaultClientConditions],
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5211,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3210",
    },
  },
  preview: {
    port: 5211,
    strictPort: true,
  },
});
