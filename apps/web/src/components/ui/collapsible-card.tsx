import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { cn } from "@/lib/utils";

/**
 * 요약 줄은 늘 보이고 내용은 펼칠 때만 보이는 카드. 넓은 화면(기록 화면의 옆 칸이 생기는 너비)은 늘
 * 펼치고, 좁은 화면은 접어 두며 마지막 선택을 기억한다(storageKey). 기록 화면에서 서식이 너무 아래로
 * 밀리지 않게 쓴다.
 */
export function CollapsibleCard({
  title,
  summary,
  storageKey,
  children,
}: {
  title: string;
  summary: ReactNode;
  storageKey: string;
  children: ReactNode;
}) {
  const isWide = useMediaQuery("(min-width: 48rem)");
  const [openChoice, toggle] = useStoredFlag(storageKey, false);
  const open = isWide || openChoice;
  const bodyId = useId();

  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {!isWide && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-my-2 -mr-2 px-3"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={toggle}
          >
            {open ? "접기" : "펼치기"}
            <ChevronDown
              className={cn("transition-transform", open && "rotate-180")}
            />
          </Button>
        )}
      </div>
      {summary}
      {open && (
        <div id={bodyId} className="flex flex-col gap-4">
          {children}
        </div>
      )}
    </Card>
  );
}
