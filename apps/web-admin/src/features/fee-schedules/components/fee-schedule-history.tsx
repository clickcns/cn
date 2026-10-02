import {
  formatMonthLabel,
  HOME_CARE_FEE_FIELDS,
  type HomeCareFees,
  type HomeCareFeeSchedule,
  type HomeCareFeeScheduleList,
} from "@repo/shared-types";
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeeValuesTable } from "@/features/fee-schedules/components/fee-values-table";
import { useRemoveFeeSchedule } from "@/features/fee-schedules/hooks/use-fee-schedules";
import { feesBefore } from "@/features/fee-schedules/lib/fee-format";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Status =
  "CURRENT" | "UPCOMING" | "PAST" | "REPLACED" | "DELETED" | "DEFAULT";

const STATUS: Record<Status, { label: string; variant: BadgeVariant }> = {
  CURRENT: { label: "지금 적용", variant: "success" },
  UPCOMING: { label: "예정", variant: "primary" },
  PAST: { label: "지난 수가", variant: "neutral" },
  REPLACED: { label: "고침", variant: "neutral" },
  DELETED: { label: "지움", variant: "destructive" },
  DEFAULT: { label: "코드 기본값", variant: "outline" },
};

/**
 * 수가 이력: 넣은 묶음(시행 월 늦은 순)과 맨 아래 코드 기본값. 고치거나 지운 묶음은 [고치거나 지운
 * 이력 보기]를 체크했을 때만 보인다. 줄을 펴면 값과 견줄 값(고친 묶음은 고치기 전 값, 아니면 바로 전
 * 수가) 대비 바뀐 칸을 보인다. 운영자는 지우지 않은 묶음을 고치거나(이전 묶음은 "고침") 지운다("지움").
 */
export function FeeScheduleHistory({
  list,
  thisMonth,
  current,
  canEdit,
  onEdit,
}: {
  list: HomeCareFeeScheduleList;
  thisMonth: string;
  /** 이번 달에 쓰는 묶음(없으면 코드 기본값) */
  current: HomeCareFeeSchedule | null;
  canEdit: boolean;
  onEdit: (schedule: HomeCareFeeSchedule) => void;
}) {
  const [removing, setRemoving] = useState<HomeCareFeeSchedule | null>(null);
  // 기본은 지금 쓰는 묶음만. 고치거나 지운 묶음은 체크했을 때만 보인다.
  const [showPast, setShowPast] = useState(false);
  const remove = useRemoveFeeSchedule();
  const pastCount = list.schedules.filter(
    (schedule) => schedule.deletedAt,
  ).length;
  const shown = showPast
    ? list.schedules
    : list.schedules.filter((schedule) => !schedule.deletedAt);
  const byId = new Map(
    list.schedules.map((schedule) => [schedule.id, schedule]),
  );
  const replaced = new Set(
    list.schedules.map((schedule) => schedule.replacesId),
  );
  const statusOf = (schedule: HomeCareFeeSchedule): Status => {
    if (schedule.deletedAt) {
      return replaced.has(schedule.id) ? "REPLACED" : "DELETED";
    }
    if (schedule.id === current?.id) return "CURRENT";
    return schedule.effectiveMonth > thisMonth ? "UPCOMING" : "PAST";
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">이력</h2>
          <p className="text-muted-foreground text-xs">
            줄을 누르면 값과 전 수가에서 바뀐 칸을 봅니다.
          </p>
        </div>
        {pastCount > 0 && (
          <label
            data-tour="fee-show-past"
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={showPast}
              onCheckedChange={(checked) => setShowPast(checked === true)}
            />
            고치거나 지운 이력 보기
            <span className="text-muted-foreground tabular-nums">
              {pastCount}건
            </span>
          </label>
        )}
      </div>
      <ul className="divide-y">
        {shown.map((schedule) => {
          const status = statusOf(schedule);
          const before = schedule.replacesId
            ? byId.get(schedule.replacesId)
            : undefined;
          const active = canEdit && !schedule.deletedAt;
          return (
            <HistoryRow
              key={schedule.id}
              title={`${formatMonthLabel(schedule.effectiveMonth)}부터`}
              status={status}
              detail={[
                `${schedule.createdBy.name} · ${formatDateTime(schedule.createdAt)}${before ? ` · ${formatMonthLabel(before.effectiveMonth)} 수가를 고침` : ""}`,
                schedule.deletedAt &&
                  schedule.deletedBy &&
                  `${STATUS[status].label} ${schedule.deletedBy.name} · ${formatDateTime(schedule.deletedAt)}`,
              ]}
              source={schedule.source}
              note={schedule.note}
              fees={schedule.fees}
              previous={
                before?.fees ?? feesBefore(list, schedule.effectiveMonth)
              }
              compareNote={
                before
                  ? "줄 그은 값은 고치기 전 값입니다."
                  : "줄 그은 값은 바로 전 수가입니다."
              }
              onEdit={active ? () => onEdit(schedule) : undefined}
              onRemove={active ? () => setRemoving(schedule) : undefined}
            />
          );
        })}
        <HistoryRow
          tour="fee-default"
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
  tour,
  title,
  status,
  detail,
  source,
  note,
  fees,
  previous,
  compareNote,
  onEdit,
  onRemove,
}: {
  /** 둘러보기가 짚는 이름(data-tour) */
  tour?: string;
  title: string;
  status: Status;
  detail: (string | false | null)[];
  source: string;
  note: string | null;
  fees: HomeCareFees;
  previous?: HomeCareFees;
  /** 펼친 값 표에서 줄 그은 값이 무엇인지 */
  compareNote?: string;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { label, variant } = STATUS[status];
  return (
    <li data-tour={tour} className="px-5 py-3">
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
                (status === "DELETED" || status === "REPLACED") &&
                  "text-muted-foreground line-through",
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
        {(onEdit || onRemove) && (
          <div className="flex gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                data-tour="fee-edit"
                aria-label={`${title} 수가 고치기`}
                onClick={onEdit}
              >
                <PencilIcon />
                고치기
              </Button>
            )}
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
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 pl-6">
          {note && <p className="text-muted-foreground text-sm">{note}</p>}
          <FeeValuesTable fees={fees} previous={previous} />
          {compareNote &&
            previous &&
            HOME_CARE_FEE_FIELDS.some(
              ({ key }) => fees[key] !== previous[key],
            ) && <p className="text-muted-foreground text-xs">{compareNote}</p>}
        </div>
      )}
    </li>
  );
}
