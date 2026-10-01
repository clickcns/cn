import { useId, useState, type ReactNode } from "react";
import {
  fieldEvidence,
  FORMS,
  formatFieldValue,
  type DictationSentence,
  type DraftIssue,
  type FilledDraftForm,
  type VisitDictation,
} from "@repo/shared-types";
import {
  ChevronRight,
  CircleAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** 근거 문장(옅게). quotes가 있으면 문장 안의 그 표기를 형광펜으로 칠한다. */
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
    <ul className="mt-1 flex flex-col gap-0.5">
      {ids.map((id) => {
        const sentence = sentences.get(id);
        if (!sentence) return null;
        return (
          <li key={id} className="text-muted-foreground flex gap-2 text-sm">
            <span className="shrink-0 font-semibold tabular-nums">{id}</span>
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
  fields,
  sentences,
  showTitle,
  showEvidence,
}: FilledDraftForm & {
  sentences: ReadonlyMap<string, DictationSentence>;
  showTitle: boolean;
  showEvidence: boolean;
}) {
  const form = FORMS[formId];
  return (
    <div className="flex flex-col gap-2">
      {showTitle && (
        <h4 className="font-semibold">
          <span className="text-muted-foreground mr-1.5">{form.code}</span>
          {form.shortTitle}
        </h4>
      )}
      <ul className="border-border divide-border divide-y rounded-xl border">
        {fields.map((field) => (
          <li
            key={field.key}
            className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4"
          >
            <span className="text-muted-foreground shrink-0 font-semibold sm:w-44">
              {field.label}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "whitespace-pre-wrap",
                  field.type !== "text" && "font-semibold tabular-nums",
                )}
              >
                {formatFieldValue(field, draft.values[field.key])}
              </p>
              {showEvidence && (
                <EvidenceSentences
                  {...fieldEvidence(draft, field.key)}
                  sentences={sentences}
                />
              )}
            </div>
          </li>
        ))}
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
  // 두 서식에 같은 문제가 나오면 서식마다 남아 있으므로 문구는 한 번만 보여 준다.
  const messages = [
    ...new Set(
      issues
        .filter((issue) => issue.severity === severity)
        .map((issue) => issue.message),
    ),
  ];
  if (messages.length === 0) return null;
  const tone = ISSUE_TONES[severity];
  const Icon = tone.icon;
  return (
    <div className={cn("rounded-xl border p-4", tone.box)}>
      <p className={cn("flex items-center gap-2 font-bold", tone.text)}>
        <Icon className="size-5 shrink-0" />
        {tone.title}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 기록 초안 확인: 서식별로 채운 칸의 값과 자동 검사 결과. 값마다 근거 문장은 [근거 문장 보기]를 켜면
 * 보인다(같은 문장이 여러 칸에 되풀이되므로 평소에는 접어 둔다). 빠진 항목은 패널이 따로 보여 준다.
 */
export function DraftReview({
  dictation,
  filled,
  showTitles,
}: {
  dictation: VisitDictation;
  /** 채운 칸(filledDraftFields) */
  filled: readonly FilledDraftForm[];
  /** 서식이 여럿이면 서식 이름을 붙인다 */
  showTitles: boolean;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const evidenceSwitchId = useId();
  const sentences = new Map(dictation.sentences.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-4">
      {filled.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">초안 내용</h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor={evidenceSwitchId}
                className="text-muted-foreground text-sm"
              >
                근거 문장 보기
              </Label>
              <Switch
                id={evidenceSwitchId}
                checked={showEvidence}
                onCheckedChange={setShowEvidence}
              />
            </div>
          </div>
          {filled.map((form) => (
            <FormDraftReview
              key={form.formId}
              {...form}
              sentences={sentences}
              showTitle={showTitles}
              showEvidence={showEvidence}
            />
          ))}
        </div>
      )}

      <IssueBox severity="removed" issues={dictation.issues} />
      <IssueBox severity="check" issues={dictation.issues} />
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
    <details className="border-border group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRight className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-90" />
        구술 전체 보기
        <span className="text-muted-foreground ml-auto text-sm font-normal">
          {dictation.sentences.length}문장
        </span>
      </summary>
      <ol className="border-border flex flex-col gap-2 border-t px-4 py-3">
        {dictation.sentences.map((sentence) => (
          <li key={sentence.id} className="flex gap-2">
            <span className="text-muted-foreground shrink-0 text-sm leading-[inherit] font-semibold tabular-nums">
              {sentence.id}
            </span>
            <span>{sentence.text}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
