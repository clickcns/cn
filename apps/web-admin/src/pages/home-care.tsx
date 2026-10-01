import {
  addMonths,
  daysBetween,
  defaultDayOf,
  formatDateLabel,
  formatKstDate,
  HOME_CARE_BASE_FEE,
  HOME_CARE_FEE_VERDICTS,
  HOME_CARE_MONTHLY_VISITS,
  homeCareClaimDeadline,
  homeCareFeeStatuses,
  homeCareFeeTotals,
  isIsoMonth,
  monthOf,
  type HomeCareFeeVerdict,
  type Profession,
  type Recipient,
} from "@repo/shared-types";
import {
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  HeartHandshakeIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { MonthNav } from "@/components/month-nav";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { MonthFallback } from "@/features/dashboard/components/month-fallback";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { HomeCareFeeTable } from "@/features/home-care/components/home-care-fee-table";
import { lastStaffId } from "@/features/home-care/lib/last-staff";
import { useOrganizationColumnNames } from "@/features/organizations/hooks/use-organization-scope";
import {
  CreateVisitDialog,
  type CreateVisitDefaults,
} from "@/features/visits/components/create-visit-dialog";
import { useMonthVisits } from "@/features/visits/hooks/use-month-visits";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";
import { wonToManwon } from "@/lib/format";

/** 판정별 금액 칸. 지난달(closed)이면 이름·설명이 "못 받음·청구"로 바뀐다. */
const VERDICT_CARDS: Record<
  HomeCareFeeVerdict,
  {
    icon: LucideIcon;
    label: (closed: boolean) => string;
    detail: (closed: boolean) => string;
    /** 이 판정의 수급자가 있을 때의 강조 */
    tone: "warning" | "success" | "default";
  }
> = {
  SHORT: {
    icon: CircleAlertIcon,
    label: (closed) => (closed ? "못 받은 기본료" : "방문 부족"),
    detail: (closed) =>
      closed ? "그달 요건을 채우지 못함" : "지금 일정으로는 요건을 못 채움",
    tone: "warning",
  },
  PENDING: {
    icon: ClockIcon,
    label: () => "확정 남음",
    detail: (closed) =>
      closed ? "확정하면 청구할 수 있음" : "남은 방문·확정을 마치면 채움",
    tone: "default",
  },
  SECURED: {
    icon: CircleCheckIcon,
    label: () => "확보",
    detail: () => "확정 기록으로 요건을 채움",
    tone: "success",
  },
};

/**
 * 재택의료 기본료 점검: 재택의료센터 수급자마다 그달 재택의료기본료 요건(의사·간호사·사회복지사
 * 방문)을 확정 기록으로 판정하고, 판정별 금액과 모자란 방문을 보여 준다. 모자란 직종은 바로
 * 방문 등록 창으로 잡는다. 방문 달력과 같은 달력 API·범위라 캐시를 함께 쓴다.
 */
export default function HomeCarePage() {
  const today = formatKstDate();
  const thisMonth = monthOf(today);
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const month = isIsoMonth(monthParam) ? monthParam : thisMonth;
  const updateSearch = useSearchParamsUpdater();
  // 운영자가 "전체 기관"을 볼 때만 있다. 표를 기관별로 묶는다.
  const organizationNames = useOrganizationColumnNames();
  const [create, setCreate] = useState<CreateVisitDefaults | null>(null);

  const { visits, recipients, error, retry, isFetching } =
    useMonthVisits(month);
  const statuses = useMemo(
    () =>
      visits == null
        ? visits
        : recipients && homeCareFeeStatuses(recipients, visits, month, today),
    [visits, recipients, month, today],
  );
  const totals = statuses ? homeCareFeeTotals(statuses) : undefined;

  const closed = month < thisMonth;
  const deadline = homeCareClaimDeadline(month);
  const daysToDeadline = daysBetween(today, deadline);
  // 오늘을 넣어 센 이달 남은 날(다음 달 1일까지의 일수)
  const daysLeftInMonth =
    month === thisMonth
      ? daysBetween(today, `${addMonths(month, 1)}-01`)
      : null;

  const schedule = (recipient: Recipient, profession: Profession) =>
    setCreate({
      recipientId: recipient.id,
      program: "HOME_CARE_CENTER",
      staffId: visits
        ? lastStaffId(visits, recipient.id, profession)
        : undefined,
      date: defaultDayOf(month, today),
    });

  return (
    <>
      <PageHeader
        title="재택의료 기본료"
        description={`재택의료센터 수급자마다 그달 재택의료기본료(월 ${wonToManwon(HOME_CARE_BASE_FEE)}만원) 요건을 확정 기록으로 판정합니다. 모자란 방문은 바로 일정으로 잡습니다.`}
      />

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HOME_CARE_FEE_VERDICTS.map((verdict) => {
            const card = VERDICT_CARDS[verdict];
            const total = totals?.[verdict];
            return (
              <StatCard
                key={verdict}
                label={card.label(closed)}
                icon={card.icon}
                value={total && wonToManwon(total.amount)}
                unit="만원"
                tone={total?.count ? card.tone : "default"}
                detail={total && `${total.count}명 · ${card.detail(closed)}`}
              />
            );
          })}
          <StatCard
            label="청구 마감까지"
            icon={CalendarClockIcon}
            value={daysToDeadline >= 0 ? daysToDeadline : undefined}
            unit="일"
            tone={closed && daysToDeadline >= 0 ? "warning" : "default"}
            detail={
              daysToDeadline >= 0
                ? `${formatDateLabel(deadline)}까지 공단에 청구${daysLeftInMonth === null ? "" : ` · 이달 남은 날 ${daysLeftInMonth}일`}`
                : `${formatDateLabel(deadline)} 마감이 지났습니다`
            }
          />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <MonthNav
              month={month}
              thisMonth={thisMonth}
              onChange={(next) =>
                updateSearch({ month: next === thisMonth ? undefined : next })
              }
              busy={isFetching}
            />
            <p className="text-muted-foreground text-xs">
              요건: 의사 {HOME_CARE_MONTHLY_VISITS.DOCTOR}회 · 간호사{" "}
              {HOME_CARE_MONTHLY_VISITS.NURSE}회 · 사회복지사 상담{" "}
              {HOME_CARE_MONTHLY_VISITS.SOCIAL_WORKER}회 — 하나라도 빠지면 그달
              기본료는 0원
            </p>
          </div>

          {statuses == null ? (
            <MonthFallback
              tooMany={statuses === null}
              error={error}
              onRetry={retry}
            />
          ) : statuses.length === 0 ? (
            <EmptyState
              icon={HeartHandshakeIcon}
              title="재택의료센터에 등록한 수급자가 없습니다"
              description="수급자 화면에서 등록 사업에 재택의료센터를 넣으면 여기서 기본료 요건을 봅니다."
            />
          ) : (
            <HomeCareFeeTable
              statuses={statuses}
              month={month}
              closed={closed}
              organizationNames={organizationNames}
              onSchedule={schedule}
            />
          )}

          <p className="text-muted-foreground border-t px-5 py-3 text-xs">
            장기요양 재택의료센터 시범사업 지침(2026.2) 기준입니다. 직종 칸은
            방문한 직종으로 세고, 의사·간호사가 함께 방문하면 각각 셉니다. 아직
            보지 않는 규칙: 첫 포괄평가 달의 산정 기간, 케어플랜 없는 긴급왕진,
            의사 1인당 140명, 사망 종결 50%, 다른 기관 서비스와 같은 날 겹침.
          </p>
        </Card>
      </div>

      <CreateVisitDialog
        open={create !== null}
        onOpenChange={(open) => {
          if (!open) setCreate(null);
        }}
        defaults={create ?? undefined}
      />
    </>
  );
}
