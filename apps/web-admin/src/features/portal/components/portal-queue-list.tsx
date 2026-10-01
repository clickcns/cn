import {
  CARE_GRADE_LABELS,
  FORMS,
  formatDateLabel,
  formatKstDate,
  PORTAL_INFO,
  PORTALS,
  type FormId,
  type PortalQueueItem,
} from "@repo/shared-types";
import { cn } from "@/lib/utils";

/**
 * 포털 미입력 목록: 옮겨 적을 곳(심평원·공단·앱)별로 묶고, 묶음 안은 방문 일시순(오래된 것부터).
 * 누르면 그 서식의 입력 도우미를 연다.
 */
export function PortalQueueList({
  items,
  selected,
  onSelect,
  organizationNames,
}: {
  items: readonly PortalQueueItem[];
  selected: { visitId: string; formId: FormId } | null;
  onSelect: (item: PortalQueueItem) => void;
  organizationNames: Map<string, string> | undefined;
}) {
  return (
    <div>
      {PORTALS.map((portal) => {
        const group = items.filter(
          (item) => FORMS[item.formId].portal === portal,
        );
        if (group.length === 0) return null;
        return (
          <section key={portal} className="border-t first:border-t-0">
            <h3 className="text-muted-foreground flex items-baseline gap-2 px-4 pt-3 pb-1.5 text-xs font-semibold">
              {PORTAL_INFO[portal].label}
              <span className="font-normal tabular-nums">{group.length}건</span>
            </h3>
            <ul>
              {group.map((item) => (
                <QueueRow
                  key={`${item.visitId}:${item.formId}`}
                  item={item}
                  current={
                    selected?.visitId === item.visitId &&
                    selected.formId === item.formId
                  }
                  organizationName={organizationNames?.get(item.organizationId)}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** 목록 한 줄. 고른 줄이 바뀌면 바뀐 두 줄만 다시 그린다(current만 다름). */
function QueueRow({
  item,
  current,
  organizationName,
  onSelect,
}: {
  item: PortalQueueItem;
  current: boolean;
  organizationName: string | undefined;
  onSelect: (item: PortalQueueItem) => void;
}) {
  const detail = [
    formatDateLabel(formatKstDate(new Date(item.scheduledAt))),
    item.staff.name,
    organizationName,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        aria-current={current || undefined}
        onClick={() => onSelect(item)}
        className={cn(
          "hover:bg-muted focus-visible:ring-ring/25 grid w-full gap-0.5 px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset",
          current && "bg-primary-soft hover:bg-primary-soft",
        )}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{item.recipient.name}</span>
          <span className="text-muted-foreground text-xs">
            {[
              item.recipient.careGrade &&
                CARE_GRADE_LABELS[item.recipient.careGrade],
              FORMS[item.formId].code,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="text-muted-foreground text-xs">{detail}</span>
      </button>
    </li>
  );
}
