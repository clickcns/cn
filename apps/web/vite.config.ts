import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      // 간호사가 기록을 쓰는 도중에 새 버전이 강제로 적용되면 입력이 날아간다.
      // 사용자가 직접 "새로고침"을 누를 때만 갱신한다.
      registerType: "prompt",
      manifest: {
        name: "케어노트",
        short_name: "케어노트",
        description: "방문 의료·간호 기록 도우미",
        theme_color: "#2446b0",
        background_color: "#f5f7f9",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "ko",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Pretendard는 한글 조각 글꼴이 90개가 넘어 미리 받으면 첫 설치가 3MB를 넘는다.
        // 글꼴은 미리 받지 않고, 실제로 쓰인 조각만 런타임에 캐시한다.
        globPatterns: ["**/*.{js,css,html,ico,svg}"],
        navigateFallback: "index.html",
        // 같은 도메인의 /admin 은 관리 웹, /dev 는 개발 지침 문서다. 현장 웹 서비스 워커가
        // 가로채면 그 대신 현장 웹이 뜬다.
        navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/dev(\/|$)/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
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
    port: 5210,
    strictPort: true,
    // 같은 LAN의 폰·태블릿에서 실기기로 확인하기 위해 모든 인터페이스에 바인딩한다.
    host: true,
    proxy: {
      "/api": "http://localhost:3210",
    },
  },
  preview: {
    port: 5210,
    strictPort: true,
  },
});
