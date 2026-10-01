import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTICE_TONES = {
  primary: "border-primary/20 bg-primary-soft/60 text-primary",
  warning: "border-warning/20 bg-warning-soft text-warning",
  destructive: "border-destructive/20 bg-destructive-soft text-destructive",
};

/**
 * 색 있는 안내 상자: 아이콘과 한 줄 안내, 그 아래 버튼 등. 안내(primary)는 status, 경고·오류는 alert 로
 * 읽힌다.
 */
export function Notice({
  tone,
  icon: Icon,
  message,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  icon: LucideIcon;
  message: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "primary" ? "status" : "alert"}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        NOTICE_TONES[tone],
      )}
    >
      <p className="flex items-start gap-2 font-semibold">
        <Icon className="mt-0.5 size-5 shrink-0" />
        {message}
      </p>
      {children}
    </div>
  );
}
