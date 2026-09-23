/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 서버 주소. 비우면 vite 프록시(`/api`)를 쓴다. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
