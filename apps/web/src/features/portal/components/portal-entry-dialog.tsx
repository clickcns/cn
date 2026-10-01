import { useState } from "react";
import { getErrorMessage } from "@repo/api-client";
import {
  formLabel,
  portalGuide,
  type FormId,
  type PortalEntry,
  type PortalRow,
  type VisitDetail,
} from "@repo/shared-types";
import {
  CircleCheck,
  ExternalLink,
  SquareCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogPageContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/features/portal/components/copy-button";
import {
  useMarkPortalEntry,
  useUnmarkPortalEntry,
} from "@/features/portal/hooks/use-portal-entries";
import { formatDateTimeLabel } from "@/lib/date";

/**
 * 서식 하나를 공식 전산(심평원·공단 사이트·스마트장기요양 앱)에 옮겨 적는 창. 포털 화면 순서대로
 * 체크할 항목과 붙여 넣을 값을 늘어놓고, 다 넣으면 한 번 [입력 완료]를 누른다(칸마다 체크하지 않음).
 * 휴대폰은 화면 전체라 앱과 오가며 쓴다.
 */
export function PortalEntryDialog({
  visit,
  formId,
  entry,
  onClose,
}: {
  visit: VisitDetail;
  formId: FormId;
  entry: PortalEntry | undefined;
  onClose: () => void;
}) {
  const { info, sections, checks } = portalGuide(visit, formId, entry);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPageContent>
        <div className="border-border flex shrink-0 items-start gap-3 border-b px-4 py-3 md:px-6 md:pt-5">
          <div className="min-w-0 flex-1">
            <DialogTitle>{info.short}에 옮겨 적기</DialogTitle>
            <DialogDescription>
              {formLabel(formId)} · {visit.recipient.name}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="닫기">
              <X />
            </Button>
          </DialogClose>
        </div>
        <DialogBody className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Button variant="outline" asChild className="self-start">
              <a href={info.url} target="_blank" rel="noopener noreferrer">
                {info.linkLabel}
                <ExternalLink />
              </a>
            </Button>
            <p className="text-muted-foreground text-sm">{info.login}</p>
          </div>

          <ul className="flex flex-col gap-2">
            {checks.map((check) => (
              <li key={check.text} className="flex items-start gap-2">
                {check.ok ? (
                  <CircleCheck
                    className="text-success mt-0.5 size-5 shrink-0"
                    aria-label="확인됨"
                  />
                ) : (
                  <TriangleAlert
                    className="text-warning mt-0.5 size-5 shrink-0"
                    aria-label="주의"
                  />
                )}
                <span>{check.text}</span>
              </li>
            ))}
          </ul>

          <ol className="flex flex-col gap-4">
            {info.before.map((step) => (
              <StepItem key={step} text={step} />
            ))}
            {sections.map((section, index) => (
              <li key={section.title} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 font-bold">
                  <span className="bg-primary-soft text-primary inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums">
                    {index + 1}
                  </span>
                  {section.title}
                </h3>
                <ul className="border-border divide-border flex flex-col divide-y rounded-xl border">
                  {section.rows.map((row) => (
                    <RowLine key={row.key} row={row} />
                  ))}
                </ul>
              </li>
            ))}
            {info.after.map((step) => (
              <StepItem key={step} text={step} />
            ))}
          </ol>
          <p className="text-muted-foreground text-sm">{info.orderNote}.</p>
        </DialogBody>
        <EntryFooter
          visitId={visit.id}
          formId={formId}
          portalLabel={info.short}
          entry={entry}
          onMarked={onClose}
        />
      </DialogPageContent>
    </Dialog>
  );
}

/** 서식 칸 앞뒤로 포털에서 하는 일(태그 인식, 서명·종료 전송 등). */
function StepItem({ text }: { text: string }) {
  return <li className="bg-muted rounded-xl px-4 py-3 font-medium">{text}</li>;
}

function RowLine({ row }: { row: PortalRow }) {
  const empty = row.checks.length === 0 && row.values.length === 0;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <span className="text-muted-foreground text-sm">{row.label}</span>
      {row.checks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.checks.map((check) => (
            <span
              key={check}
              className="border-primary/40 bg-primary-soft text-primary inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold"
            >
              <SquareCheck className="size-4 shrink-0" aria-hidden />
              {check}
            </span>
          ))}
        </div>
      )}
      {row.values.map((value) => (
        <div
          key={`${value.label ?? ""}${value.text}`}
          className="flex items-start gap-2"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {value.label && (
              <span className="text-muted-foreground text-xs">
                {value.label}
              </span>
            )}
            <p className="bg-muted rounded-lg px-3 py-2 break-words whitespace-pre-line">
              {value.text}
              {value.suffix && (
                <span className="text-muted-foreground"> {value.suffix}</span>
              )}
            </p>
          </div>
          <CopyButton text={value.text} label={value.label ?? row.label} />
        </div>
      ))}
      {empty && (
        <span className="text-muted-foreground">비워 둠(체크하지 않음)</span>
      )}
      {row.note && (
        <span className="text-muted-foreground text-sm">{row.note}</span>
      )}
    </li>
  );
}

/** 서식마다 한 번: [입력 완료](넓은 화면만 메모) 또는 완료 표시와 [되돌리기]. */
function EntryFooter({
  visitId,
  formId,
  portalLabel,
  entry,
  onMarked,
}: {
  visitId: string;
  formId: FormId;
  portalLabel: string;
  entry: PortalEntry | undefined;
  onMarked: () => void;
}) {
  const [note, setNote] = useState("");
  const mark = useMarkPortalEntry(visitId);
  const unmark = useUnmarkPortalEntry(visitId);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 md:px-6">
      {entry ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-success flex items-start gap-2 font-semibold">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              {portalLabel} 입력 완료
              <span className="text-muted-foreground block text-sm font-normal">
                {formatDateTimeLabel(entry.enteredAt)} · {entry.enteredBy.name}
                {entry.note && ` · ${entry.note}`}
              </span>
            </span>
          </p>
          <Button
            variant="outline"
            disabled={unmark.isPending}
            onClick={() =>
              unmark.mutate(formId, {
                onError: (error) =>
                  toast.error(getErrorMessage(error, "되돌리지 못했습니다")),
              })
            }
          >
            되돌리기
          </Button>
        </div>
      ) : (
        <>
          {/* 휴대폰은 본문을 넓게 두려고 메모 칸을 숨긴다(버튼만). */}
          <div className="hidden flex-col gap-1.5 md:flex">
            <Label htmlFor="portal-note">
              접수번호·메모{" "}
              <span className="text-muted-foreground font-normal">(선택)</span>
            </Label>
            <Input
              id="portal-note"
              value={note}
              maxLength={200}
              placeholder="예: 최종 제출함"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button
            disabled={mark.isPending}
            onClick={() =>
              mark.mutate(
                { formId, note },
                {
                  onSuccess: () => {
                    toast.success(`${portalLabel} 입력 완료로 표시했습니다`);
                    onMarked();
                  },
                  onError: (error) =>
                    toast.error(getErrorMessage(error, "표시하지 못했습니다")),
                },
              )
            }
          >
            입력 완료
          </Button>
        </>
      )}
    </div>
  );
}
