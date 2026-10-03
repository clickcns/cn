import type { FileDownload } from "@repo/api-client";

/** 서버가 만든 파일을 그 이름으로 내려받는다. */
export function downloadFile({ blob, filename }: FileDownload): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
