import {
  HOME_CARE_BASE_FEE,
  HOME_CARE_CONTINUITY_MONTHS,
  HOME_CARE_EXTRA_NURSING_MAX,
  HOME_CARE_MONTHLY_VISITS,
  HOME_CARE_REVENUE_PART_INFO,
  HOME_CARE_REVENUE_PARTS,
  type HomeCareMonthRevenue,
  type HomeCareRevenuePart,
} from "@repo/shared-types";
import { BanknoteIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatManwon, formatNumber, wonToManwon } from "@/lib/format";

/** 항목별 산정 조건 한 줄. */
const PART_NOTES: Record<HomeCareRevenuePart, string> = {
  base: `월 ${formatManwon(HOME_CARE_BASE_FEE)}, 요건을 채운 수급자`,
  visitFee: "제4호로 청구하는 의사 방문",
  extraNursing: `간호사 ${HOME_CARE_MONTHLY_VISITS.NURSE}회를 넘는 방문, 월 ${HOME_CARE_EXTRA_NURSING_MAX}회까지`,
  continuity: `기본료 ${HOME_CARE_CONTINUITY_MONTHS}개월 연속마다`,
};

/**
 * 그달 예상 수입: 총액과 항목별(기본료·방문진료료·추가간호료·지속관리료) 금액·건수. totals가
 * undefined면(받는 중·받지 못함) "—"를 보여 준다.
 */
export function RevenueSummary({
  totals,
  closed,
}: {
  totals: HomeCareMonthRevenue["totals"] | undefined;
  /** 지난달: "예상"이 아니라 그달 받을 수 있는 금액 */
  closed: boolean;
}) {
  return (
    <Card className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-10">
      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <BanknoteIcon className="size-4" aria-hidden />
          {closed ? "그달 받을 수 있는 금액" : "이달 예상 수입"}
        </div>
        <p className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">
            {totals ? formatNumber(wonToManwon(totals.total)) : "—"}
          </span>
          {totals && (
            <span className="text-muted-foreground text-sm">만원</span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {closed
            ? "미확정 방문을 확정하면 청구할 수 있는 금액 포함"
            : "예정·미확정 방문을 모두 마치고 확정하면"}
        </p>
      </div>
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-4">
        {HOME_CARE_REVENUE_PARTS.map((part) => {
          const total = totals?.parts[part];
          const { label, unit } = HOME_CARE_REVENUE_PART_INFO[part];
          return (
            <div key={part} className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {total ? formatManwon(total.amount) : "—"}
              </dd>
              <dd className="text-muted-foreground text-xs tabular-nums">
                {total && `${total.count}${unit} · `}
                {PART_NOTES[part]}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
