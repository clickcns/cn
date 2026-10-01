import { useState, type ReactNode } from "react";
import {
  FORMS,
  formFields,
  formLabel,
  notReusedLabels,
  PROGRAM_LABELS,
  recordDate,
  reusableValues,
  withParticle,
  type FormData,
  type FormId,
  type RecipientRecord,
} from "@repo/shared-types";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Info,
  LoaderCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogPageContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { FormHeading, FormView } from "@/features/forms/components/form-view";
import { FormTabs } from "@/features/forms/components/form-tabs";
import { formPanelId } from "@/features/forms/lib/field-ids";
import { usePastRecordParam } from "@/features/past-records/hooks/use-past-record-param";
import {
  usePastRecords,
  type PastRecordsAnchor,
} from "@/features/past-records/hooks/use-past-records";
import {
  recordDateLabel,
  recordStaffLabel,
} from "@/features/past-records/lib/record-labels";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { visitTimeRange } from "@/lib/date";

const PANEL_PREFIX = "past-panel";

/** 지난 기록에서 이번 기록으로 불러올 값. */
export interface PastApplyRequest {
  formId: FormId;
  /** 다시 쓸 칸만(reusableValues — 방문마다 새로 정하는 칸·제공 시간은 빠져 있다) */
  values: FormData;
  /** 알림·확인 문구에 쓰는 출처: "9월 24일 (수) 기록의 간호관리" */
  source: string;
  /** 그 기록의 방문 날짜(한국 날짜) — 채운 칸의 "지난 기록" 표시 */
  date: string;
}

/** 처음 보여 줄 서식: 지금 보고 있는 서식, 이번 방문에도 있는 서식, 그 기록의 첫 서식 순. */
function initialFormId(
  formIds: readonly FormId[],
  visitFormIds: readonly FormId[],
  preferred: FormId | undefined,
): FormId {
  if (preferred && formIds.includes(preferred)) return preferred;
  return formIds.find((formId) => visitFormIds.includes(formId)) ?? formIds[0]!;
}

function PastRecordView({
  record,
  visitFormIds,
  preferredFormId,
  onApply,
  nav,
}: {
  record: RecipientRecord;
  visitFormIds: readonly FormId[];
  preferredFormId: FormId | undefined;
  onApply: ((request: PastApplyRequest) => void) | undefined;
  /** 앞뒤 기록으로 넘기는 버튼 줄 */
  nav: ReactNode;
}) {
  const [formId, setFormId] = useState(() =>
    initialFormId(record.formIds, visitFormIds, preferredFormId),
  );
  const form = FORMS[formId];
  const data = record.forms[formId];
  const date = recordDateLabel(record);
  const time = visitTimeRange(record);
  // 불러오기는 이번 방문에도 있는 서식만.
  const apply =
    onApply && visitFormIds.includes(formId)
      ? (values: FormData, what: string) =>
          onApply({
            formId,
            values,
            source: `${date} 기록의 ${what}`,
            date: recordDate(record),
          })
      : undefined;
  const wholeValues = apply ? reusableValues(formFields(form), data) : {};
  const notReused = notReusedLabels(form);

  return (
    <>
      <div className="border-border flex shrink-0 items-start gap-3 border-b px-4 py-3 md:px-6 md:pt-5">
        <div className="min-w-0 flex-1">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {date} 기록
            {record.status === "DRAFT" && (
              <VisitStatusBadge status="DRAFT" size="sm" />
            )}
          </DialogTitle>
          <DialogDescription>
            {PROGRAM_LABELS[record.program]} · {recordStaffLabel(record)}
            {time && ` · ${time.start} ~ ${time.end}`}
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label="닫기">
            <X />
          </Button>
        </DialogClose>
      </div>

      <DialogBody className="flex flex-col gap-4">
        {record.formIds.length > 1 && (
          <FormTabs
            formIds={record.formIds}
            value={formId}
            onChange={setFormId}
            panelIdPrefix={PANEL_PREFIX}
          />
        )}
        <section
          id={formPanelId(PANEL_PREFIX, formId)}
          role={record.formIds.length > 1 ? "tabpanel" : undefined}
          className="flex flex-col gap-4"
        >
          {onApply && !apply && (
            <Notice
              tone="primary"
              icon={Info}
              message={`이번 방문에는 ${withParticle(formLabel(formId), "이/가")} 없어 보기만 할 수 있습니다`}
            />
          )}
          <FormHeading form={form} />
          <FormView
            form={form}
            data={data}
            sectionAction={(section) => {
              if (!apply) return null;
              const values = reusableValues(section.fields, data);
              if (Object.keys(values).length === 0) return null;
              return (
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => apply(values, section.title)}
                  aria-label={`${section.title} 구분 불러오기`}
                >
                  <ClipboardPaste />이 구분 불러오기
                </Button>
              );
            }}
          />
        </section>
      </DialogBody>

      <div className="border-border flex shrink-0 flex-col gap-3 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        {apply && (
          <>
            {notReused.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {withParticle(notReused.join("·"), "은/는")} 방문마다 새로
                적으므로 불러오지 않습니다. 불러온 뒤 이번 방문과 맞는지 확인해
                주세요.
              </p>
            )}
            {Object.keys(wholeValues).length > 0 && (
              <Button onClick={() => apply(wholeValues, form.shortTitle)}>
                <ClipboardPaste />이 서식 전체 불러오기
              </Button>
            )}
          </>
        )}
        {nav}
      </div>
    </>
  );
}

/** 앞뒤 기록으로 넘기기. 받아 둔 기록 끝이면 다음 쪽을 받아 넘긴다. */
function PastRecordNav({
  older,
  newer,
  canFetchOlder,
  fetchingOlder,
  onOlder,
  onNewer,
}: {
  older: RecipientRecord | undefined;
  newer: RecipientRecord | undefined;
  canFetchOlder: boolean;
  fetchingOlder: boolean;
  onOlder: () => void;
  onNewer: () => void;
}) {
  const olderLabel = older ? recordDateLabel(older) : "이전 기록";
  const newerLabel = newer ? recordDateLabel(newer) : "다음 기록";
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={onOlder}
        disabled={(!older && !canFetchOlder) || fetchingOlder}
        aria-label={older ? `이전 기록: ${olderLabel}` : "이전 기록"}
      >
        {fetchingOlder ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <ChevronLeft />
        )}
        <span className="truncate">{olderLabel}</span>
      </Button>
      <Button
        variant="outline"
        onClick={onNewer}
        disabled={!newer}
        aria-label={newer ? `다음 기록: ${newerLabel}` : "다음 기록"}
      >
        <span className="truncate">{newerLabel}</span>
        <ChevronRight />
      </Button>
    </div>
  );
}

/**
 * 지난 기록 보기 창(?past=방문id). 좁은 화면은 화면 전체를 쓴다. 서식 탭·읽기 전용 서식과 앞뒤 기록으로
 * 넘기기, onApply 를 주면(작성 중인 기록 화면) 서식 전체·구분 불러오기 버튼을 보여 준다.
 */
export function PastRecordDialog({
  visit,
  preferredFormId,
  onApply,
  onCloseAutoFocus,
}: {
  visit: PastRecordsAnchor;
  /** 처음 열 서식(기록 화면에서 보고 있는 탭) */
  preferredFormId?: FormId;
  onApply?: (request: PastApplyRequest) => void;
  /** 닫은 뒤 포커스를 옮길 곳이 따로 있으면(불러온 칸) 기본 동작을 막는다 */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { visitId, show, close } = usePastRecordParam();
  const recordsQuery = usePastRecords(visit);
  const records = recordsQuery.data ?? [];
  const index = records.findIndex((record) => record.id === visitId);
  const record = records[index];
  const older = records[index + 1];
  const newer = index > 0 ? records[index - 1] : undefined;

  const showOlder = () => {
    if (older) {
      show(older.id);
      return;
    }
    void recordsQuery.fetchNextPage().then((result) => {
      const next = result.data?.[index + 1];
      if (next) show(next.id);
    });
  };

  return (
    <Dialog
      open={visitId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPageContent onCloseAutoFocus={onCloseAutoFocus}>
        {record ? (
          <PastRecordView
            key={record.id}
            record={record}
            visitFormIds={visit.formIds}
            preferredFormId={preferredFormId}
            onApply={onApply}
            nav={
              <PastRecordNav
                older={older}
                newer={newer}
                canFetchOlder={recordsQuery.hasNextPage}
                fetchingOlder={recordsQuery.isFetchingNextPage}
                onOlder={showOlder}
                onNewer={() => newer && show(newer.id)}
              />
            }
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <DialogTitle>지난 기록</DialogTitle>
            <DialogDescription>
              {recordsQuery.isPending
                ? "불러오는 중입니다"
                : "이 기록을 찾을 수 없습니다"}
            </DialogDescription>
            <DialogClose asChild>
              <Button variant="outline">닫기</Button>
            </DialogClose>
          </div>
        )}
      </DialogPageContent>
    </Dialog>
  );
}
