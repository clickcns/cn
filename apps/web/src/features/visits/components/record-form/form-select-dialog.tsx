import { useState } from "react";
import {
  formLabel,
  formRulesFor,
  resolveFormIds,
  type FormChoices,
  type FormId,
  type VisitDetail,
} from "@repo/shared-types";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormChoiceList } from "@/features/forms/components/form-choice-list";

interface FormSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: VisitDetail;
  /** 이 서식에 작성한 내용이 있는지(저장했거나 화면에서 고친 값). 빼기 전에 알린다. */
  hasContent: (formId: FormId) => boolean;
  onSubmit: (formIds: FormId[]) => void;
  isPending: boolean;
}

/** 확정 전 방문의 작성 서식 바꾸기. 필수 서식은 그대로 두고 선택 서식만 켜고 끈다. */
export function FormSelectDialog(props: FormSelectDialogProps) {
  const { open, onOpenChange, isPending } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent>
        {/* 열 때마다 지금 방문의 서식에서 시작한다. */}
        {open && <FormSelectBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function FormSelectBody({
  onOpenChange,
  visit,
  hasContent,
  onSubmit,
  isPending,
}: FormSelectDialogProps) {
  const rules = formRulesFor(visit.program, visit.staff.profession);
  // 지금 방문의 서식에서 시작한다(선택 서식마다 켬·끔).
  const [choices, setChoices] = useState<FormChoices>(() =>
    Object.fromEntries(
      rules.map((rule) => [rule.formId, visit.formIds.includes(rule.formId)]),
    ),
  );
  const selected = resolveFormIds(
    visit.program,
    visit.staff.profession,
    choices,
  );
  const removedWithContent = visit.formIds.filter(
    (formId) => !selected.includes(formId) && hasContent(formId),
  );
  // 둘 다 규칙 순서다.
  const unchanged = selected.join() === visit.formIds.join();

  return (
    <>
      <DialogHeader>
        <DialogTitle>작성 서식 바꾸기</DialogTitle>
        <DialogDescription>
          이번 방문에서 쓸 서식을 고릅니다. 필수 서식은 뺄 수 없습니다.
        </DialogDescription>
      </DialogHeader>
      <FormChoiceList
        idPrefix="form-select"
        rules={rules}
        selected={selected}
        onToggle={(formId, on) =>
          setChoices((current) => ({ ...current, [formId]: on }))
        }
        disabled={isPending}
      />
      {removedWithContent.length > 0 && (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive-soft text-destructive flex items-start gap-2 rounded-xl border p-3 font-semibold"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          {removedWithContent.map(formLabel).join(", ")}에 작성한 내용이
          지워집니다.
        </p>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          취소
        </Button>
        <Button
          variant={removedWithContent.length > 0 ? "destructive" : "default"}
          onClick={() => onSubmit(selected)}
          disabled={isPending || unchanged}
        >
          {isPending ? "바꾸는 중…" : "서식 바꾸기"}
        </Button>
      </DialogFooter>
    </>
  );
}
