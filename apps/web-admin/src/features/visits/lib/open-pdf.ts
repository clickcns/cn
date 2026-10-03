import { getErrorMessage, type FileDownload } from "@repo/api-client";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download-file";

/**
 * 받은 PDF를 새 탭에 연다(보고 인쇄·저장한다). 요청이 끝난 뒤에 탭을 열면 팝업 차단에 걸리므로
 * 누르자마자 빈 탭을 열어 두고 PDF로 바꾼다. 탭을 열지 못하면 서버가 붙인 이름으로 내려받는다.
 */
export async function openPdf(
  load: () => Promise<FileDownload>,
): Promise<void> {
  const tab = window.open("", "_blank");
  tab?.document.write(
    '<p style="font-family:sans-serif;padding:24px;color:#555">PDF를 만드는 중입니다…</p>',
  );
  try {
    const file = await load();
    if (!tab) {
      downloadFile(file);
      return;
    }
    const url = URL.createObjectURL(file.blob);
    tab.location.href = url;
    // 새 탭이 PDF를 다 읽은 뒤에 푼다.
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (error) {
    tab?.close();
    toast.error(getErrorMessage(error));
  }
}
