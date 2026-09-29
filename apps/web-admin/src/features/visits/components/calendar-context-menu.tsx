import {
  formatDateLabel,
  canDeleteVisit,
  canRescheduleVisit,
  type VisitCalendarItem,
} from "@repo/shared-types";
import {
  CalendarClockIcon,
  CalendarPlusIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  FilterIcon,
  FilterXIcon,
  ListIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuHint,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { VisitListLinkState } from "@/features/visits/hooks/use-visit-list-href";
import {
  CELL_SELECTOR,
  CHIP_SELECTOR,
} from "@/features/visits/lib/calendar-dom";
import { visitDate, visitTime } from "@/features/visits/lib/calendar-items";
import { ROUTES } from "@/lib/routes";

/** 우클릭한 곳: 방문 칩 또는 날짜 칸 */
type MenuTarget =
  { kind: "visit"; item: VisitCalendarItem } | { kind: "day"; date: string };

export interface CalendarMenuActions {
  openVisit: (item: VisitCalendarItem) => void;
  editVisit: (item: VisitCalendarItem) => void;
  deleteVisit: (item: VisitCalendarItem) => void;
  /** 다음 주 같은 요일·시각으로 복사해 등록 창을 연다. */
  copyVisit: (item: VisitCalendarItem) => void;
  /** 그 날짜(와 수급자)로 등록 창을 연다. */
  createVisit: (date: string, recipientId?: string) => void;
  /** 그날을 고르고 아래 방문 표로 간다. */
  showDay: (date: string) => void;
  filterRecipient: (recipientId: string | undefined) => void;
}

interface CalendarContextMenuProps {
  children: ReactNode;
  /** 칩의 방문을 id로 찾는다(칸과 "+N건 더" 창의 칩). */
  findVisit: (id: string) => VisitCalendarItem | undefined;
  /** 지금 수급자 한 명만 보는 중이면 그 수급자 */
  filteredRecipient: { id: string; name: string } | null;
  actions: CalendarMenuActions;
}

function resolveTarget(
  element: EventTarget,
  findVisit: CalendarContextMenuProps["findVisit"],
): MenuTarget | null {
  if (!(element instanceof Element)) return null;
  const chipId = element.closest<HTMLElement>(CHIP_SELECTOR)?.dataset.chip;
  const item = chipId ? findVisit(chipId) : undefined;
  if (item) return { kind: "visit", item };
  const date = element.closest<HTMLElement>(CELL_SELECTOR)?.dataset.date;
  return date ? { kind: "day", date } : null;
}

/**
 * 달력 우클릭 메뉴(터치는 길게 누르기). 칩이면 그 방문의 보기·변경·복사·삭제,
 * 빈 칸이면 그 날짜로 등록·그날 방문 보기. 메뉴 하나를 달력 전체에 두고 누른 곳으로 내용을 정한다.
 */
export function CalendarContextMenu({
  children,
  findVisit,
  filteredRecipient,
  actions,
}: CalendarContextMenuProps) {
  const [target, setTarget] = useState<MenuTarget | null>(null);
  // 메뉴를 연 칩·칸. 창을 열지 않고 닫으면 포커스를 돌려준다.
  const returnFocus = useRef<HTMLElement | null>(null);
  const openedDialog = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  /** 누른 곳을 기억한다. 칩·칸이 아니면 null(메뉴를 열지 않는다). */
  const capture = (event: SyntheticEvent) => {
    const next = resolveTarget(event.target, findVisit);
    setTarget(next);
    returnFocus.current =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            `${CHIP_SELECTOR}, ${CELL_SELECTOR}`,
          )
        : null;
    openedDialog.current = false;
    return next;
  };
  /** 창을 여는 동작: 닫을 때 포커스는 창이 맡는다. */
  const withDialog = (action: () => void) => () => {
    openedDialog.current = true;
    action();
  };

  const recipientFilterItem = (recipient: { id: string; name: string }) =>
    filteredRecipient?.id === recipient.id ? (
      <ContextMenuItem onSelect={() => actions.filterRecipient(undefined)}>
        <FilterXIcon />
        수급자 필터 풀기
      </ContextMenuItem>
    ) : (
      <ContextMenuItem onSelect={() => actions.filterRecipient(recipient.id)}>
        <FilterIcon />
        {recipient.name} 방문만 보기
      </ContextMenuItem>
    );

  const renderVisit = (item: VisitCalendarItem) => {
    const linkState: VisitListLinkState = { listSearch: location.search };
    const reschedulable = canRescheduleVisit(item.status);
    const deletable = canDeleteVisit(item.status);
    return (
      <>
        <ContextMenuLabel>
          {formatDateLabel(visitDate(item))} {visitTime(item)} ·{" "}
          {item.recipient.name} · {item.staff.name}
        </ContextMenuLabel>
        <ContextMenuItem onSelect={withDialog(() => actions.openVisit(item))}>
          <EyeIcon />
          빠른 보기
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!reschedulable}
          onSelect={withDialog(() => actions.editVisit(item))}
        >
          <CalendarClockIcon />
          일정·담당자 변경
          {!reschedulable && <ContextMenuHint>확정됨</ContextMenuHint>}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            navigate(ROUTES.visitDetail(item.id), { state: linkState })
          }
        >
          <ExternalLinkIcon />
          상세 기록 보기
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={withDialog(() => actions.copyVisit(item))}>
          <CopyIcon />
          다음 주로 복사해서 등록…
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={withDialog(() =>
            actions.createVisit(visitDate(item), item.recipient.id),
          )}
        >
          <CalendarPlusIcon />
          {item.recipient.name} 방문 새로 등록…
        </ContextMenuItem>
        {recipientFilterItem(item.recipient)}
        <ContextMenuSeparator />
        <ContextMenuItem
          destructive
          disabled={!deletable}
          onSelect={withDialog(() => actions.deleteVisit(item))}
        >
          <Trash2Icon />
          방문 삭제…
          {!deletable && <ContextMenuHint>예정만 삭제</ContextMenuHint>}
        </ContextMenuItem>
      </>
    );
  };

  const renderDay = (date: string) => (
    <>
      <ContextMenuLabel>{formatDateLabel(date)}</ContextMenuLabel>
      <ContextMenuItem
        onSelect={withDialog(() =>
          actions.createVisit(date, filteredRecipient?.id),
        )}
      >
        <CalendarPlusIcon />
        {filteredRecipient
          ? `이 날짜로 ${filteredRecipient.name} 방문 등록…`
          : "이 날짜로 방문 등록…"}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => actions.showDay(date)}>
        <ListIcon />이 날 방문 목록 보기
      </ContextMenuItem>
      {filteredRecipient && (
        <ContextMenuItem onSelect={() => actions.filterRecipient(undefined)}>
          <FilterXIcon />
          수급자 필터 풀기
        </ContextMenuItem>
      )}
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenu={(event) => {
          // 칩·칸 밖(요일 머리 등)에서는 열지 않는다.
          if (!capture(event)) event.preventDefault();
        }}
        onPointerDown={(event) => {
          // 터치는 길게 눌러 연다. 그 전에 누른 곳을 기억한다.
          if (event.pointerType !== "mouse" && !capture(event)) {
            event.preventDefault();
          }
        }}
      >
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const element = returnFocus.current;
          if (!openedDialog.current && element?.isConnected) element.focus();
        }}
      >
        {target?.kind === "visit"
          ? renderVisit(target.item)
          : target?.kind === "day"
            ? renderDay(target.date)
            : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
