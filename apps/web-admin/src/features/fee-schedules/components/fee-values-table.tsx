import { HOME_CARE_FEE_GROUPS, type HomeCareFees } from "@repo/shared-types";
import { formatFee } from "@/features/fee-schedules/lib/fee-format";
import { cn } from "@/lib/utils";

/**
 * 수가 묶음 보기. previous를 주면 바뀐 칸에 이전 값(줄 그음)과 새 값을 함께 보인다.
 */
export function FeeValuesTable({
  fees,
  previous,
}: {
  fees: HomeCareFees;
  previous?: HomeCareFees;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {HOME_CARE_FEE_GROUPS.map(({ group, fields }) => (
        <section key={group} className="grid content-start gap-1.5">
          <h3 className="text-muted-foreground text-xs font-semibold">
            {group}
          </h3>
          <dl className="divide-y rounded-md border">
            {fields.map((field) => {
              const before = previous?.[field.key];
              const changed =
                before !== undefined && before !== fees[field.key];
              return (
                <div
                  key={field.key}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                >
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-right font-medium whitespace-nowrap tabular-nums">
                    {changed && (
                      <span className="text-muted-foreground mr-1.5 text-xs font-normal line-through">
                        {formatFee(field, before)}
                      </span>
                    )}
                    <span className={cn(changed && "text-primary")}>
                      {formatFee(field, fees[field.key])}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
