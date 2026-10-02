import { XIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import type * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TourStep {
  /** 짚을 요소의 CSS 선택자(보통 [data-tour="…"]). 여럿이면 처음 보이는 것, 없으면 화면 가운데에 말풍선만 */
  target: string | readonly string[];
  title: string;
  body: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

/** 짚을 곳 둘레 여백(px) */
const SPOT_PADDING = 6;

/** 짚을 요소가 없을 때 말풍선을 붙이는 화면 위쪽 가운데 점. */
const SCREEN_CENTER = {
  getBoundingClientRect: () =>
    DOMRect.fromRect({
      x: window.innerWidth / 2,
      y: window.innerHeight / 3,
      width: 0,
      height: 0,
    }),
};

function findTarget(target: TourStep["target"]): HTMLElement | null {
  for (const selector of typeof target === "string" ? [target] : target) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

/**
 * 화면 위 둘러보기: 실제 화면의 요소를 차례로 짚고(나머지는 어둡게) 옆에 설명 말풍선을 띄운다.
 * 말풍선은 Radix Popover의 가상 기준점(virtualRef)으로 짚은 요소에 붙어 자리를 잡고 넘치면
 * 뒤집는다. ←·→로 넘기고 Esc·바깥 누르기로 닫으며, 닫으면 연 버튼으로 포커스를 돌려준다.
 * 화면마다 단계 목록만 넘기면 된다(짚을 요소에 data-tour를 단다).
 */
export function Tour({
  steps,
  open,
  onClose,
}: {
  steps: readonly TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open || steps.length === 0) return null;
  return <TourRun steps={steps} onClose={onClose} />;
}

function TourRun({
  steps,
  onClose,
}: {
  steps: readonly TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState(() => findTarget(steps[0].target));
  const spotRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  const goTo = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setIndex(next);
    setTarget(findTarget(steps[next].target));
  };

  // 닫으면 둘러보기를 연 버튼으로 포커스를 돌려준다.
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    target?.scrollIntoView({
      block: "center",
      behavior: reduce.matches ? "auto" : "smooth",
    });
  }, [target]);

  // 짚은 자리는 스크롤·크기 변화를 따라가도록 그릴 때마다 다시 잰다(둘러보기 동안만).
  useEffect(() => {
    const spot = spotRef.current;
    if (!spot) return;
    let frame = 0;
    const follow = () => {
      const rect = target?.getBoundingClientRect();
      if (rect) {
        spot.style.transform = `translate(${rect.left - SPOT_PADDING}px, ${rect.top - SPOT_PADDING}px)`;
        spot.style.width = `${rect.width + SPOT_PADDING * 2}px`;
        spot.style.height = `${rect.height + SPOT_PADDING * 2}px`;
      } else {
        spot.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight / 3}px)`;
        spot.style.width = "0px";
        spot.style.height = "0px";
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      {createPortal(
        <div
          ref={spotRef}
          aria-hidden
          className={cn(
            "pointer-events-none fixed top-0 left-0 z-40 rounded-lg shadow-[0_0_0_9999px_rgb(21_32_42/0.45)]",
            target && "outline-primary outline-2",
          )}
        />,
        document.body,
      )}
      <Popover
        open
        modal
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <PopoverAnchor virtualRef={{ current: target ?? SCREEN_CENTER }} />
        <PopoverContent
          side={step.side ?? "bottom"}
          align="start"
          sideOffset={SPOT_PADDING + 10}
          collisionPadding={16}
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className="w-80 p-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            nextRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") goTo(index + 1);
            if (event.key === "ArrowLeft") goTo(index - 1);
          }}
        >
          <PopoverPrimitive.Arrow
            width={14}
            height={7}
            className="fill-popover stroke-border"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <p className="text-primary text-xs font-semibold tabular-nums">
                {index + 1} / {steps.length}
              </p>
              <h2 id={titleId} className="text-[15px] font-semibold">
                {step.title}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-1"
              aria-label="안내 닫기"
              onClick={onClose}
            >
              <XIcon />
            </Button>
          </div>
          <div id={bodyId} className="text-muted-foreground mt-1.5 text-sm">
            {step.body}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1" aria-hidden>
              {steps.map((item, dot) => (
                <span
                  key={item.title}
                  className={cn(
                    "size-1.5 rounded-full",
                    dot === index ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
              >
                이전
              </Button>
              <Button
                ref={nextRef}
                size="sm"
                onClick={() => (last ? onClose() : goTo(index + 1))}
              >
                {last ? "마치기" : "다음"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
