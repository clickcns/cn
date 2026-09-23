import type { ReactNode } from "react";
import {
  fieldEvidence,
  FORMS,
  formatFieldValue,
  formFields,
  isEmptyValue,
  type DictationSentence,
  type DraftIssue,
  type FormDraft,
  type FormId,
  type VisitDictation,
} from "@repo/shared-types";
import { CircleAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 근거 문장. quotes가 있으면 문장 안의 그 표기를 형광펜으로 칠한다. */
function EvidenceSentences({
  ids,
  quotes,
  sentences,
}: {
  ids: readonly string[];
  quotes: readonly string[];
  sentences: ReadonlyMap<string, DictationSentence>;
}) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {ids.map((id) => {
        const sentence = sentences.get(id);
        if (!sentence) return null;
        return (
          <li key={id} className="text-muted-foreground flex gap-2 text-sm">
            <span className="bg-muted text-foreground h-fit shrink-0 rounded-md px-1.5 font-semibold tabular-nums">
              {id}
            </span>
            <span>
              <Highlighted text={sentence.text} quotes={quotes} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** text 안의 quotes를 <mark>로 감싼다. 찾지 못한 표기는 그냥 둔다. */
function Highlighted({
  text,
  quotes,
}: {
  text: string;
  quotes: readonly string[];
}) {
  const ranges = quotes
    .map((quote) => ({ start: text.indexOf(quote), length: quote.length }))
    .filter((range) => range.start >= 0 && range.length > 0)
    .sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { start, length } of ranges) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={start}
        className="bg-warning-soft text-foreground rounded px-0.5 font-semibold"
      >
        {text.slice(start, start + length)}
      </mark>,
    );
    cursor = start + length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function FormDraftReview({
  formId,
  draft,
  sentences,
  showTitle,
}: {
  formId: FormId;
  draft: FormDraft;
  sentences: ReadonlyMap<string, DictationSentence>;
  showTitle: boolean;
}) {
  const form = FORMS[formId];
  const fields = formFields(form).filter(
    (field) => !isEmptyValue(draft.values[field.key]),
  );
  if (fields.length === 0) return null;

  return (
    <div>
      {showTitle && (
        <h3 className="text-base font-bold">
          <span className="text-muted-foreground mr-1.5 font-semibold">
            {form.code}
          </span>
          {form.shortTitle}
        </h3>
      )}
      <ul className="divide-border divide-y">
        {fields.map((field) => {
          const evidence = fieldEvidence(draft, field.key);
          const value = formatFieldValue(field, draft.values[field.key]);
          const long = field.type === "text" || value.length > 24;
          return (
            <li key={field.key} className="py-3">
              <div
                className={
                  long
                    ? "flex flex-col gap-1"
                    : "flex items-baseline justify-between gap-3"
                }
              >
                <span className="text-muted-foreground shrink-0 font-semibold">
                  {field.label}
                </span>
                <span
                  className={
                    long
                      ? "whitespace-pre-wrap"
                      : "text-right text-lg font-semibold tabular-nums"
                  }
                >
                  {value}
                </span>
              </div>
              <EvidenceSentences {...evidence} sentences={sentences} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ISSUE_TONES = {
  removed: {
    title: "근거와 맞지 않아 초안에서 뺀 값",
    icon: CircleAlert,
    box: "border-destructive/20 bg-destructive-soft",
    text: "text-destructive",
  },
  check: {
    title: "확인해 주세요",
    icon: TriangleAlert,
    box: "border-warning/20 bg-warning-soft",
    text: "text-warning",
  },
} satisfies Record<
  DraftIssue["severity"],
  { title: string; icon: LucideIcon; box: string; text: string }
>;

/** 자동 검사 결과 한 묶음(뺀 값 또는 확인할 값). */
function IssueBox({
  severity,
  issues,
}: {
  severity: DraftIssue["severity"];
  issues: readonly DraftIssue[];
}) {
  const matched = issues.filter((issue) => issue.severity === severity);
  if (matched.length === 0) return null;
  const tone = ISSUE_TONES[severity];
  const Icon = tone.icon;
  return (
    <div className={cn("rounded-xl border p-4", tone.box)}>
      <p className={cn("flex items-center gap-2 font-bold", tone.text)}>
        <Icon className="size-5 shrink-0" />
        {tone.title}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {matched.map((issue) => (
          <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}

/** 기록 초안 확인: 서식별로 칸마다 값과 근거 문장, 자동 검사 결과. */
export function DraftReview({
  dictation,
  formIds,
}: {
  dictation: VisitDictation;
  formIds: readonly FormId[];
}) {
  const { draft, issues } = dictation;
  const sentences = new Map(dictation.sentences.map((s) => [s.id, s]));
  const filled = formIds.filter((formId) =>
    Object.values(draft[formId]?.values ?? {}).some(
      (value) => !isEmptyValue(value),
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      {filled.length === 0 && (
        <p className="text-muted-foreground">
          초안에 채운 항목이 없습니다. 아래 빠진 항목을 말씀해 주세요.
        </p>
      )}

      {filled.map((formId) => (
        <FormDraftReview
          key={formId}
          formId={formId}
          draft={draft[formId]!}
          sentences={sentences}
          showTitle={formIds.length > 1}
        />
      ))}

      <IssueBox severity="removed" issues={issues} />
      <IssueBox severity="check" issues={issues} />
    </div>
  );
}

/** 구술 전체(문장 번호와 함께). 접어 두고 필요할 때 펼친다. */
export function TranscriptDetails({
  dictation,
}: {
  dictation: VisitDictation;
}) {
  return (
    <details className="border-border rounded-xl border">
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        구술 전체 보기
        <span className="text-muted-foreground ml-2 font-normal">
          {dictation.sentences.length}문장 · 녹음 {dictation.takes}회 ·{" "}
          {Math.round(dictation.audioSeconds)}초
        </span>
      </summary>
      <ol className="border-border flex flex-col gap-2 border-t px-4 py-3">
        {dictation.sentences.map((sentence) => (
          <li key={sentence.id} className="flex gap-2">
            <span className="bg-muted h-fit shrink-0 rounded-md px-1.5 text-sm font-semibold tabular-nums">
              {sentence.id}
            </span>
            <span>{sentence.text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
