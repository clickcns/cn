import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface FormDialogFooterProps {
  /** 확인 버튼 문구. 예: "저장", "등록" */
  submitText: string;
  onCancel: () => void;
  /** 처리 중에는 두 버튼을 막고 확인 버튼에 스피너를 보인다. */
  isPending?: boolean;
  /** 주면 폼 제출 대신 이 함수를 부른다(확인 다이얼로그). */
  onSubmit?: () => void;
  destructive?: boolean;
}

/** 다이얼로그 하단의 취소·확인 버튼. 폼 안에서는 확인 버튼이 폼을 제출한다. */
export function FormDialogFooter({
  submitText,
  onCancel,
  isPending = false,
  onSubmit,
  destructive = false,
}: FormDialogFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={isPending}>
        취소
      </Button>
      <Button
        type={onSubmit ? "button" : "submit"}
        variant={destructive ? "destructive" : "default"}
        onClick={onSubmit}
        disabled={isPending}
      >
        {isPending && <Spinner />}
        {submitText}
      </Button>
    </DialogFooter>
  );
}
