import {
  CARE_GRADE_LABELS,
  HOME_CARE_MONTHLY_VISITS,
  PROGRAM_SHORT_LABELS,
  type Recipient,
} from "@repo/shared-types";
import { CircleCheckIcon, HeartHandshakeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DashboardCardHeader } from "@/features/dashboard/components/dashboard-card";
import { MonthFallback } from "@/features/dashboard/components/month-fallback";
import type { RecipientChecks } from "@/features/dashboard/lib/recipient-checks";
import { HomeCareCounts } from "@/features/visits/components/home-care-counts";
import { visitsHref } from "@/features/visits/lib/visits-href";

/**
 * 이달 수급자 확인: 재택의료 월 요건이 모자란 수급자와 (재택의료 밖에서) 이달 방문이 없는
 * 수급자. 누르면 방문 달력이 그 수급자 방문만 보여 준다.
 */
export function RecipientMonthCard({
  month,
  checks,
  error,
  onRetry,
  organizationNames,
}: {
  month: string;
  /** undefined는 받는 중, null은 방문이 너무 많아 목록이 없음 */
  checks: RecipientChecks | null | undefined;
  error: unknown;
  onRetry: () => void;
  organizationNames: Map<string, string> | undefined;
}) {
  const row = (recipient: Recipient, trailing: ReactNode) => (
    <li key={recipient.id}>
      <RecipientLink
        recipient={recipient}
        month={month}
        organizationName={organizationNames?.get(recipient.organizationId)}
        trailing={trailing}
      />
    </li>
  );

  return (
    <Card>
      <DashboardCardHeader
        icon={HeartHandshakeIcon}
        title={`${Number(month.slice(5))}월 수급자 확인`}
        description={`재택의료 월 요건(의사 ${HOME_CARE_MONTHLY_VISITS.DOCTOR}·간호사 ${HOME_CARE_MONTHLY_VISITS.NURSE}·사회복지사 ${HOME_CARE_MONTHLY_VISITS.SOCIAL_WORKER}회, 예정 포함)과 이달 방문이 없는 수급자입니다. 이름을 누르면 그 수급자의 방문 달력을 봅니다.`}
      />
      {checks == null ? (
        <MonthFallback
          tooMany={checks === null}
          error={error}
          onRetry={onRetry}
        />
      ) : (
        <div className="grid gap-5 px-5 py-4">
          <Section
            title="재택의료 월 요건 부족"
            count={
              checks.homeCare.length > 0
                ? `${checks.lacking.length}명 / 재택의료 수급자 ${checks.homeCare.length}명`
                : undefined
            }
          >
            {checks.homeCare.length === 0 ? (
              <Note>재택의료센터에 등록한 수급자가 없습니다.</Note>
            ) : checks.lacking.length === 0 ? (
              <Note done>
                재택의료 수급자 모두 이달 요건을 채웠습니다(예정 포함).
              </Note>
            ) : (
              <ul className="grid gap-0.5">
                {checks.lacking.map(({ recipient, counts, shortfall }) =>
                  row(
                    recipient,
                    <span className="flex items-center gap-2">
                      <HomeCareCounts counts={counts} />
                      <span className="text-warning text-xs font-semibold whitespace-nowrap tabular-nums">
                        {shortfall}회 부족
                      </span>
                    </span>,
                  ),
                )}
              </ul>
            )}
          </Section>

          <Section
            title="이달 방문 없는 수급자"
            count={`${checks.noVisit.length}명 · 재택의료 제외`}
          >
            {checks.noVisit.length === 0 ? (
              <Note done>모든 수급자에게 이달 방문이 있습니다.</Note>
            ) : (
              <ul className="grid gap-0.5">
                {checks.noVisit.map((recipient) =>
                  row(
                    recipient,
                    recipient.programs.length > 0 ? (
                      <span className="flex flex-wrap justify-end gap-1">
                        {recipient.programs.map((program) => (
                          <Badge key={program} variant="outline">
                            {PROGRAM_SHORT_LABELS[program]}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <Badge variant="warning">등록 사업 없음</Badge>
                    ),
                  ),
                )}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {count && (
          <span className="text-muted-foreground text-xs font-normal tabular-nums">
            {count}
          </span>
        )}
      </h3>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </section>
  );
}

function Note({ done, children }: { done?: boolean; children: ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 py-1 text-sm">
      {done && (
        <CircleCheckIcon className="text-success size-4 shrink-0" aria-hidden />
      )}
      {children}
    </p>
  );
}

/** 수급자 한 줄: 이름·등급·기관과 오른쪽 내용. 누르면 이달 방문 달력을 그 수급자로 좁힌다. */
function RecipientLink({
  recipient,
  month,
  organizationName,
  trailing,
}: {
  recipient: Recipient;
  month: string;
  organizationName: string | undefined;
  trailing: ReactNode;
}) {
  const detail = [
    recipient.careGrade && CARE_GRADE_LABELS[recipient.careGrade],
    organizationName,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to={visitsHref({ view: "calendar", month, recipient: recipient.id })}
      className="hover:bg-muted focus-visible:ring-ring/25 flex items-center justify-between gap-3 rounded px-2 py-1.5 outline-none focus-visible:ring-3"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-medium">{recipient.name}</span>
        {detail && (
          <span className="text-muted-foreground truncate text-xs">
            {detail}
          </span>
        )}
      </span>
      {trailing}
    </Link>
  );
}
