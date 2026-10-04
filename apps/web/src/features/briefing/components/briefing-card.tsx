import {
  BRIEFING_KIND_LABELS,
  briefingForViewer,
  daysBetween,
  formatKstDate,
  FORMS,
  PROFESSION_LABELS,
  PROGRAM_SHORT_LABELS,
  relativeDayLabel,
  type BriefingSource,
  type VisitDetail,
} from "@repo/shared-types";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { usePastRecordParam } from "@/features/past-records/hooks/use-past-record-param";
import { usePastBriefing } from "@/features/past-records/hooks/use-past-records";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import { formatDateLabel } from "@/lib/date";

/** "9월 22일 (화) · 3일 전" */
function whenLabel(date: string, today: string): string {
  const days = daysBetween(date, today);
  const ago =
    relativeDayLabel(date, today) ??
    (days > 0 ? `${days}일 전` : `${-days}일 뒤`);
  return `${formatDateLabel(date)} · ${ago}`;
}

/** 묶음 이름: "간호사", 같은 직종이 사업별로 둘이면 "간호사 · 방문간호" (기록 id → 이름) */
function sourceTitles(sources: readonly BriefingSource[]): Map<string, string> {
  return new Map(
    sources.map((source) => {
      const label = PROFESSION_LABELS[source.profession];
      const shared =
        sources.filter((other) => other.profession === source.profession)
          .length > 1;
      return [
        source.recordId,
        shared ? `${label} · ${PROGRAM_SHORT_LABELS[source.program]}` : label,
      ];
    }),
  );
}

/**
 * 방문 전 브리핑: 직종마다 가장 최근 기록에서 정한 칸만 그대로(간호지시·계획·살펴볼 것·한 일·메모).
 * 간호사에게는 의사 간호지시, 누구에게나 본인 직종의 계획을 맨 위 요약 줄에. 쓰기 전(예정·작성 중)
 * 방문에만 보이고, 지난 기록이 없거나 받는 중이면 숨긴다(지난 기록 카드가 알린다).
 */
export function BriefingCard({ visit }: { visit: VisitDetail }) {
  const briefing = usePastBriefing(visit);
  const { open } = usePastRecordParam();
  if (!briefing || briefing.length === 0) return null;
  const today = formatKstDate();
  const { highlights, sources } = briefingForViewer(briefing, visit.profession);
  const titles = sourceTitles(sources);
  // 서식 둘을 쓴 기록(의사 제6호·제4호)은 비슷한 칸 이름이 겹치므로 칸 이름에 서식을 붙인다
  const multiForm = new Set(
    sources
      .filter((source) => new Set(source.items.map((i) => i.formId)).size > 1)
      .map((source) => source.recordId),
  );

  const summary =
    highlights.length > 0 ? (
      <ul className="bg-primary-soft flex flex-col gap-2 rounded-xl px-4 py-3">
        {highlights.map(({ source, item }) => (
          <li key={`${source.recordId}.${item.formId}.${item.key}`}>
            <p className="font-semibold">
              <span className="text-primary">
                {source.profession === visit.profession
                  ? "지난번 "
                  : `${PROFESSION_LABELS[source.profession]} `}
                {BRIEFING_KIND_LABELS[item.kind]}
              </span>{" "}
              {item.text}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatDateLabel(source.date)} · {source.staffName}
            </p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-muted-foreground">
        최근 기록:{" "}
        {sources
          .map(
            (source) =>
              `${titles.get(source.recordId)} ${formatDateLabel(source.date)}`,
          )
          .join(" · ")}
      </p>
    );

  return (
    <CollapsibleCard
      title="방문 전 확인"
      summary={summary}
      storageKey="carenote:briefing-expanded"
    >
      {sources.map((source) => (
        <section
          key={source.recordId}
          aria-label={`${titles.get(source.recordId)} 최근 기록`}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {titles.get(source.recordId)}
                {source.draft && <VisitStatusBadge status="DRAFT" size="sm" />}
              </p>
              <p className="text-muted-foreground text-sm">
                {whenLabel(source.date, today)} · {source.staffName}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2 shrink-0 px-3"
              onClick={() => open(source.recordId)}
            >
              기록 보기
            </Button>
          </div>
          <dl className="flex flex-col gap-2">
            {source.items.map((item) => (
              <div key={`${item.formId}.${item.key}`} className="flex flex-col">
                <dt className="text-muted-foreground text-sm font-semibold">
                  {item.label}
                  {multiForm.has(source.recordId) && (
                    <span className="font-normal">
                      {" "}
                      · {FORMS[item.formId].code}
                    </span>
                  )}
                </dt>
                <dd className="line-clamp-4 whitespace-pre-wrap">
                  {item.text}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-muted-foreground text-sm">
        직종마다 가장 최근 기록에 적힌 그대로입니다.
      </p>
    </CollapsibleCard>
  );
}
