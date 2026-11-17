import { useDialogParam } from "@/hooks/use-dialog-param";

/**
 * 지난 기록 보기 창은 주소(?past=방문id)로 연다. 휴대폰의 뒤로 가기가 창만 닫고 기록 화면은 그대로 둔다.
 */
export function usePastRecordParam() {
  const { value, open, show, close } = useDialogParam("past");
  return { visitId: value, open, show, close };
}
