import { useLocation, useNavigate, useSearchParams } from "react-router";

const PARAM = "past";

interface PastRecordState {
  pastRecord?: boolean;
}

/**
 * 지난 기록 보기 창은 주소(?past=방문id)로 연다. 휴대폰의 뒤로 가기가 창만 닫고 기록 화면은 그대로 둔다
 * (저장하지 않은 변경 확인은 경로가 바뀔 때만 뜬다).
 * - open: 기록을 열며 주소를 하나 쌓는다
 * - show: 열린 창에서 다른 기록으로(이전·다음) — 주소를 바꾸기만 한다
 * - close: 이 화면에서 열었으면 뒤로, 주소로 바로 들어왔으면 매개변수만 지운다
 */
export function usePastRecordParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openedHere =
    (location.state as PastRecordState | null)?.pastRecord === true;

  const withRecord = (visitId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (visitId) next.set(PARAM, visitId);
    else next.delete(PARAM);
    return next;
  };

  return {
    visitId: searchParams.get(PARAM),
    open: (visitId: string) =>
      setSearchParams(withRecord(visitId), {
        state: { pastRecord: true } satisfies PastRecordState,
      }),
    show: (visitId: string) =>
      setSearchParams(withRecord(visitId), {
        replace: true,
        state: location.state,
      }),
    close: () => {
      if (openedHere) void navigate(-1);
      else setSearchParams(withRecord(null), { replace: true });
    },
  };
}
