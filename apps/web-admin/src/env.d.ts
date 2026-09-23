/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 기본 주소. 없으면 "/api"(vite 프록시)를 쓴다. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
