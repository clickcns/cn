import { getErrorMessage } from "@repo/api-client";
import {
  CARE_GRADE_LABELS,
  FORMS,
  formLabel,
  portalGuide,
  PROGRAM_LABELS,
  staffDisplayName,
  type FormId,
  type PortalEntry,
  type PortalRow,
  type PortalSection,
  type VisitDetail,
} from "@repo/shared-types";
import {
  CircleCheckIcon,
  ExternalLinkIcon,
  SquareCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/features/portal/components/copy-button";
import {
  useMarkPortalEntry,
  useUnmarkPortalEntry,
} from "@/features/portal/hooks/use-portal";
import { formatDate, formatDateTime, formatVisitTimeRange } from "@/lib/format";

/**
 * 서식 하나를 공식 전산에 옮겨 적는 도우미: 방문 정보와 포털 바로가기, 제출 전 확인, 포털 화면
 * 순서대로 늘어놓은 체크할 항목·붙여 넣을 값, 그리고 서식마다 한 번 누르는 [입력 완료].
 * 칸마다 체크하지 않는다(포털에서 한 번, 여기서 또 한 번 누르는 일이 되므로).
 */
export function PortalHelper({
  visit,
  formId,
  entry,
  onMarked,
}: {
  visit: VisitDetail;
  formId: FormId;
  entry: PortalEntry | undefined;
  /** 입력 완료로 표시한 뒤(다음 서식으로 넘어갈 때) */
  onMarked: () => void;
}) {
  const { info, sections, checks, checkCount, valueCount } = portalGuide(
    visit,
    formId,
    entry,
  );

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="grid gap-0.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-bold">{visit.recipient.name}</h2>
            <span className="text-muted-foreground text-sm">
              {[
                visit.recipient.careGrade &&
                  CARE_GRADE_LABELS[visit.recipient.careGrade],
                visit.recipient.chartNumber &&
                  `차트 ${visit.recipient.chartNumber}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <p className="text-sm">
            {formatDate(visit.scheduledAt)}{" "}
            {visit.startedAt &&
              formatVisitTimeRange(
                visit.scheduledAt,
                visit.startedAt,
                visit.endedAt,
              )}{" "}
            ·{" "}
            {staffDisplayName({
              name: visit.staff.name,
              profession: visit.profession,
            })}{" "}
            · {PROGRAM_LABELS[visit.program]}
          </p>
          <p className="text-muted-foreground text-sm">
            {formLabel(formId)}
            {visit.confirmedAt &&
              ` · ${visit.versionCount > 0 ? `${visit.versionCount}차 ` : ""}확정 ${formatDateTime(visit.confirmedAt)}`}
          </p>
        </div>
        <div className="grid justify-items-end gap-1">
          <Button variant="outline" asChild>
            <a href={info.url} target="_blank" rel="noopener noreferrer">
              {info.linkLabel}
              <ExternalLinkIcon />
            </a>
          </Button>
          <span className="text-muted-foreground text-xs">{info.login}</span>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-2 text-[15px] font-semibold">제출 전 확인</h3>
        <ul className="grid gap-1.5 text-sm">
          {checks.map((check) => (
            <CheckLine key={check.text} ok={check.ok} text={check.text} />
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{info.short} 화면 순서대로</CardTitle>
          <span className="text-muted-foreground text-xs tabular-nums">
            체크할 항목 {checkCount} · 붙여 넣을 값 {valueCount}
          </span>
        </CardHeader>
        {info.before.map((step) => (
          <StepLine key={step} text={step} />
        ))}
        {sections.map((section, index) => (
          <SectionBlock
            key={section.title}
            step={index + 1}
            section={section}
          />
        ))}
        {info.after.map((step) => (
          <StepLine key={step} text={step} />
        ))}
        <p className="text-muted-foreground border-t px-5 py-3 text-xs">
          {info.orderNote}. 값은 {FORMS[formId].code} 확정본에서 왔습니다.
        </p>
      </Card>

      <EntryFooter
        visitId={visit.id}
        formId={formId}
        portalLabel={info.short}
        entry={entry}
        onMarked={onMarked}
      />
    </div>
  );
}

function CheckLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CircleCheckIcon
          className="text-success mt-0.5 size-4 shrink-0"
          aria-label="확인됨"
        />
      ) : (
        <TriangleAlertIcon
          className="text-warning mt-0.5 size-4 shrink-0"
          aria-label="주의"
        />
      )}
      <span>{text}</span>
    </li>
  );
}

/** 서식 칸 앞뒤로 포털에서 하는 일(태그 인식, 임시저장·최종 제출 등). */
function StepLine({ text }: { text: string }) {
  return (
    <p className="bg-muted/40 border-t px-5 py-2.5 text-sm font-medium first:border-t-0">
      {text}
    </p>
  );
}

function SectionBlock({
  step,
  section,
}: {
  step: number;
  section: PortalSection;
}) {
  return (
    <section className="border-t first:border-t-0">
      <h4 className="flex items-center gap-2 px-5 pt-3.5 pb-1.5 text-sm font-semibold">
        <span className="bg-primary-soft text-primary inline-flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums">
          {step}
        </span>
        {section.title}
      </h4>
      <ul>
        {section.rows.map((row) => (
          <RowLine key={row.key} row={row} />
        ))}
      </ul>
    </section>
  );
}

function RowLine({ row }: { row: PortalRow }) {
  const empty = row.checks.length === 0 && row.values.length === 0;
  return (
    <li className="grid gap-x-4 gap-y-1 border-t border-dashed px-5 py-2 first:border-t-0 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
      <span className="text-muted-foreground text-sm">{row.label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {row.checks.map((check) => (
          <span
            key={check}
            className="border-primary/40 bg-primary-soft text-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold"
          >
            <SquareCheckIcon className="size-3.5 shrink-0" aria-hidden />
            {check}
          </span>
        ))}
        {row.values.map((value) => (
          <span
            key={`${value.label ?? ""}${value.text}`}
            className="inline-flex flex-wrap items-center gap-1.5"
          >
            {value.label && (
              <span className="text-muted-foreground text-xs">
                {value.label}
              </span>
            )}
            <code className="bg-muted rounded border px-2 py-0.5 font-sans text-sm break-all tabular-nums">
              {value.text}
            </code>
            {value.suffix && (
              <span className="text-muted-foreground text-sm">
                {value.suffix}
              </span>
            )}
            <CopyButton text={value.text} label={value.label ?? row.label} />
          </span>
        ))}
        {empty && (
          <span className="text-muted-foreground text-sm">
            비워 둠(체크하지 않음)
          </span>
        )}
        {row.note && (
          <span className="text-muted-foreground basis-full text-xs">
            {row.note}
          </span>
        )}
      </div>
    </li>
  );
}

/** 서식마다 한 번: [입력 완료](메모 선택) 또는 완료 표시와 [되돌리기]. */
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
  const mark = useMarkPortalEntry();
  const unmark = useUnmarkPortalEntry();

  if (entry) {
    return (
      <Card
        role="status"
        className="border-success bg-success-soft flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <div className="flex items-start gap-2.5">
          <CircleCheckIcon
            className="text-success mt-0.5 size-5 shrink-0"
            aria-hidden
          />
          <div className="grid">
            <span className="font-semibold">{portalLabel} 입력 완료</span>
            <span className="text-muted-foreground text-sm">
              {formatDateTime(entry.enteredAt)} · {entry.enteredBy.name}
              {entry.note && ` · ${entry.note}`}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={unmark.isPending}
          onClick={() =>
            unmark.mutate(
              { visitId, formId },
              {
                onError: (error) =>
                  toast.error(getErrorMessage(error, "되돌리지 못했습니다")),
              },
            )
          }
        >
          되돌리기
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-end justify-between gap-4 p-5">
      <div className="grid min-w-64 flex-1 gap-1.5">
        <Label htmlFor="portal-note">
          접수번호·메모{" "}
          <span className="text-muted-foreground font-normal">(선택)</span>
        </Label>
        <Input
          id="portal-note"
          value={note}
          maxLength={200}
          placeholder="예: 최종 제출함, 접수번호"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <Button
        disabled={mark.isPending}
        onClick={() =>
          mark.mutate(
            { visitId, formId, note },
            {
              onSuccess: () => {
                toast.success(`${portalLabel} 입력 완료로 표시했습니다`);
                setNote("");
                onMarked();
              },
              onError: (error) =>
                toast.error(getErrorMessage(error, "표시하지 못했습니다")),
            },
          )
        }
      >
        입력 완료 · 다음으로
      </Button>
    </Card>
  );
}
