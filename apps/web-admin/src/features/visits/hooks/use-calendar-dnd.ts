import type { VisitCalendarItem } from "@repo/shared-types";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { visitDate } from "@/features/visits/lib/calendar-items";
import { useLatestRef } from "@/hooks/use-latest-ref";

const DRAG_TYPE = "application/x-carenote-visit";

/**
 * 달력 칩을 다른 날 칸으로 끌어다 놓기(HTML5 drag 이벤트). 끄는 동안 dragover에서는
 * 데이터를 읽을 수 없으므로 끄는 방문을 ref에 둔다. 같은 날 칸에는 놓을 수 없다.
 *
 * handlers는 늘 같은 객체라, 끄는 동안 강조 칸(dropDate)이 바뀌어도 칸에는 강조 여부만 달라져
 * 그 두 칸만 다시 그린다.
 */
export function useCalendarDnd(
  onMove: (item: VisitCalendarItem, date: string) => void,
) {
  const dragging = useRef<VisitCalendarItem | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const onMoveRef = useLatestRef(onMove);

  const handlers = useMemo(() => {
    const reset = () => {
      dragging.current = null;
      setDropDate(null);
    };
    return {
      /** 칩에 펼칠 속성. 끌 수 없는 칩(확정·요청 중)은 draggable만 끈다. */
      chipProps: (item: VisitCalendarItem, enabled: boolean) =>
        enabled
          ? {
              draggable: true,
              onDragStart: (event: DragEvent<HTMLElement>) => {
                dragging.current = item;
                // Firefox는 setData가 있어야 끌기를 시작한다.
                event.dataTransfer.setData(DRAG_TYPE, item.id);
                event.dataTransfer.effectAllowed = "move";
              },
              onDragEnd: reset,
            }
          : { draggable: false },
      /** 날짜 칸에 펼칠 속성. */
      cellProps: (date: string) => ({
        onDragOver: (event: DragEvent<HTMLElement>) => {
          const item = dragging.current;
          if (!item || visitDate(item) === date) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropDate((current) => (current === date ? current : date));
        },
        onDragLeave: (event: DragEvent<HTMLElement>) => {
          // 칸 안의 칩 사이를 오갈 때 강조가 깜박이지 않게 한다.
          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }
          setDropDate((current) => (current === date ? null : current));
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          event.preventDefault();
          const item = dragging.current;
          reset();
          if (item && visitDate(item) !== date) onMoveRef.current(item, date);
        },
      }),
    };
  }, [onMoveRef]);

  return { dropDate, handlers };
}

export type CalendarDnd = ReturnType<typeof useCalendarDnd>;
export type CalendarDndHandlers = CalendarDnd["handlers"];
