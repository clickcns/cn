import {
  formatMonthLabel,
  type HomeCareFees,
  type HomeCareFeeSchedule,
  type HomeCareFeeScheduleList,
} from "@repo/shared-types";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeeValuesTable } from "@/features/fee-schedules/components/fee-values-table";
import { useRemoveFeeSchedule } from "@/features/fee-schedules/hooks/use-fee-schedules";
import { feesBefore } from "@/features/fee-schedules/lib/fee-format";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Status = "CURRENT" | "UPCOMING" | "PAST" | "DELETED" | "DEFAULT";

const STATUS: Record<Status, { label: string; variant: BadgeVariant }> = {
  CURRENT: { label: "지금 적용", variant: "success" },
  UPCOMING: { label: "예정", variant: "primary" },
  PAST: { label: "지난 수가", variant: "neutral" },
  DELETED: { label: "지움", variant: "destructive" },
  DEFAULT: { label: "코드 기본값", variant: "outline" },
};

/**
 * 수가 이력: 넣은 묶음(시행 월 늦은 순, 지운 것 포함)과 맨 아래 코드 기본값. 줄을 펴면 값과 전 수가
 * 대비 바뀐 칸을 보인다. 운영자는 지우지 않은 묶음을 지운다(이력에는 "지움"으로 남는다).
 */
export function FeeScheduleHistory({
  list,
  thisMonth,
  current,
  canEdit,
}: {
  list: HomeCareFeeScheduleList;
  thisMonth: string;
  /** 이번 달에 쓰는 묶음(없으면 코드 기본값) */
  current: HomeCareFeeSchedule | null;
  canEdit: boolean;
}) {
  const [removing, setRemoving] = useState<HomeCareFeeSchedule | null>(null);
  const remove = useRemoveFeeSchedule();
  const statusOf = (schedule: HomeCareFeeSchedule): Status => {
    if (schedule.deletedAt) return "DELETED";
    if (schedule.id === current?.id) return "CURRENT";
    return schedule.effectiveMonth > thisMonth ? "UPCOMING" : "PAST";
  };

  return (
    <>
      <ul className="divide-y">
        {list.schedules.map((schedule) => (
          <HistoryRow
            key={schedule.id}
            title={`${formatMonthLabel(schedule.effectiveMonth)}부터`}
            status={statusOf(schedule)}
            detail={[
              `${schedule.createdBy.name} · ${formatDateTime(schedule.createdAt)}`,
              schedule.deletedAt &&
                schedule.deletedBy &&
                `지움 ${schedule.deletedBy.name} · ${formatDateTime(schedule.deletedAt)}`,
            ]}
            source={schedule.source}
            note={schedule.note}
            fees={schedule.fees}
            previous={feesBefore(list, schedule.effectiveMonth)}
            onRemove={
              canEdit && !schedule.deletedAt
                ? () => setRemoving(schedule)
                : undefined
            }
          />
        ))}
        <HistoryRow
          title="처음부터(넣은 수가가 없는 달)"
          status={current ? "DEFAULT" : "CURRENT"}
          detail={[]}
          source={list.defaults.source}
          note={null}
          fees={list.defaults.fees}
        />
      </ul>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="이 수가를 지울까요?"
        description={
          removing &&
          `${formatMonthLabel(removing.effectiveMonth)}부터 쓰던 수가를 지웁니다. 그 달부터는 바로 앞 수가(없으면 코드 기본값)로 다시 계산합니다. 이력에는 "지움"으로 남습니다.`
        }
        confirmText="지우기"
        destructive
        isPending={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null);
              toast.success("수가를 지웠습니다");
            },
          })
        }
      />
    </>
  );
}

function HistoryRow({
  title,
  status,
  detail,
  source,
  note,
  fees,
  previous,
  onRemove,
}: {
  title: string;
  status: Status;
  detail: (string | false | null)[];
  source: string;
  note: string | null;
  fees: HomeCareFees;
  previous?: HomeCareFees;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { label, variant } = STATUS[status];
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="focus-visible:ring-ring/25 grid min-w-0 flex-1 gap-0.5 rounded text-left outline-none focus-visible:ring-3"
        >
          <span className="flex flex-wrap items-center gap-2">
            <ChevronDownIcon
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "font-semibold",
                status === "DELETED" && "text-muted-foreground line-through",
              )}
            >
              {title}
            </span>
            <Badge variant={variant}>{label}</Badge>
          </span>
          <span className="text-muted-foreground pl-6 text-xs">
            근거: {source}
          </span>
          {detail.filter(Boolean).map((line) => (
            <span
              key={line as string}
              className="text-muted-foreground pl-6 text-xs"
            >
              {line}
            </span>
          ))}
        </button>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} 수가 지우기`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 pl-6">
          {note && <p className="text-muted-foreground text-sm">{note}</p>}
          <FeeValuesTable fees={fees} previous={previous} />
        </div>
      )}
    </li>
  );
}
