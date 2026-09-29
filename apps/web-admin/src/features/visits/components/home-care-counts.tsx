import {
  HOME_CARE_MONTHLY_VISITS,
  PROFESSION_LABELS,
  type HomeCareVisitCounts,
} from "@repo/shared-types";
import { cn } from "@/lib/utils";

const HOME_CARE_PARTS: { key: keyof HomeCareVisitCounts; short: string }[] = [
  { key: "DOCTOR", short: "의" },
  { key: "NURSE", short: "간" },
  { key: "SOCIAL_WORKER", short: "사" },
];

/** 재택의료 월 요건 대비 직종별 방문 수: "의 1/1 간 1/2 사 0/1"(모자란 직종은 주황). */
export function HomeCareCounts({
  counts,
  className,
}: {
  counts: HomeCareVisitCounts;
  className?: string;
}) {
  return (
    <span
      className={cn("flex flex-wrap gap-x-1.5 text-xs tabular-nums", className)}
    >
      <span className="text-muted-foreground">재택</span>
      {HOME_CARE_PARTS.map(({ key, short }) => {
        const required = HOME_CARE_MONTHLY_VISITS[key];
        const lacking = counts[key] < required;
        return (
          <span
            key={key}
            title={`${PROFESSION_LABELS[key]} ${counts[key]}회 / 요건 ${required}회`}
            className={lacking ? "text-warning font-semibold" : "text-success"}
          >
            {short} {counts[key]}/{required}
          </span>
        );
      })}
    </span>
  );
}
