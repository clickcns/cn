import type * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ListCountProps {
  count: number;
  /** 숫자 뒤에 붙는 단위. 예: "명", "건", "개 기관" */
  unit: string;
  /** 다시 불러오는 중이면 작은 스피너를 보인다. */
  isFetching?: boolean;
  /** 총계 뒤에 덧붙일 내용(상태별 건수 등). */
  children?: React.ReactNode;
  className?: string;
}

/** 목록 위의 "총 N명" 표시. */
export function ListCount({
  count,
  unit,
  isFetching = false,
  children,
  className,
}: ListCountProps) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-[13px] tabular-nums",
        className,
      )}
    >
      {isFetching && <Spinner className="size-3.5" />}
      <span>
        총 <strong className="text-foreground font-semibold">{count}</strong>
        {unit}
      </span>
      {children}
    </p>
  );
}
