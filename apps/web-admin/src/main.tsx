import { StrictMode } from "react";
import { allowShortPasswordsForDev } from "@repo/shared-types";
import { createRoot } from "react-dom/client";
import App from "@/app";
import "@/index.css";

// 개발 API 서버(pnpm dev)와 같은 비밀번호 규칙
if (import.meta.env.DEV) allowShortPasswordsForDev();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
