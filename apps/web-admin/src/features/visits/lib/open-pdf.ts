import { getErrorMessage, type FileDownload } from "@repo/api-client";
import { toast } from "sonner";

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
    const { blob, filename } = await load();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    }
    // 새 탭이 PDF를 다 읽은 뒤에 푼다.
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (error) {
    tab?.close();
    toast.error(getErrorMessage(error));
  }
}
