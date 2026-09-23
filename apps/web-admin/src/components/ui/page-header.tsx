import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** 제목 위에 붙는 요소(뒤로 가기 링크 등). */
  eyebrow?: React.ReactNode;
  /** 제목 옆에 붙는 요소(상태 배지 등). */
  titleAccessory?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  titleAccessory,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      {/* React 19는 <title>을 문서 head로 옮겨 준다. */}
      <title>{`${title} · 케어노트 관리`}</title>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">
            {title}
          </h1>
          {titleAccessory}
        </div>
        {description && (
          <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
