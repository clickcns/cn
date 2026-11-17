import { useLocation, useNavigate, useSearchParams } from "react-router";

interface DialogParamState {
  /** 이 화면에서 창을 열며 쌓은 주소의 매개변수 이름 */
  dialogParam?: string;
}

/**
 * 주소의 매개변수 하나(?past=방문id, ?notices=날짜)로 여는 창. 휴대폰의 뒤로 가기가 창만 닫고 화면은 그대로
 * 둔다(저장하지 않은 변경 확인은 경로가 바뀔 때만 뜬다).
 * - open: 창을 열며 주소를 하나 쌓는다
 * - show: 열린 창에서 다른 값으로(이전·다음) — 주소를 바꾸기만 한다
 * - close: 이 화면에서 열었으면 뒤로, 주소로 바로 들어왔으면 매개변수만 지운다
 */
export function useDialogParam(param: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const openedHere =
    (location.state as DialogParamState | null)?.dialogParam === param;

  const withValue = (value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(param, value);
    else next.delete(param);
    return next;
  };

  return {
    value: searchParams.get(param),
    open: (value: string) =>
      setSearchParams(withValue(value), {
        state: { dialogParam: param } satisfies DialogParamState,
      }),
    show: (value: string) =>
      setSearchParams(withValue(value), {
        replace: true,
        state: location.state,
      }),
    close: () => {
      if (openedHere) void navigate(-1);
      else setSearchParams(withValue(null), { replace: true });
    },
  };
}
