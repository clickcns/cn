import type * as React from "react";
import { cn } from "@/lib/utils";

export interface DescriptionItem {
  label: string;
  value: React.ReactNode;
  /** 두 칸 폭을 모두 쓴다(주소·메모처럼 긴 값). */
  wide?: boolean;
}

/** 라벨-값 목록. 상세 화면의 읽기 전용 정보에 쓴다. */
export function DescriptionList({
  items,
  columns = 1,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3.5",
        columns === 2 && "grid-cols-2",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "grid gap-1",
            item.wide && columns === 2 && "col-span-2",
          )}
        >
          <dt className="text-muted-foreground text-[13px]">{item.label}</dt>
          <dd className="text-sm tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
