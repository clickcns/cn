import type { VisitStatus } from "@repo/shared-types";
import {
  CircleCheckIcon,
  ClockIcon,
  PencilLineIcon,
  type LucideIcon,
} from "lucide-react";
import type { BadgeVariant } from "@/components/ui/badge";

/**
 * 방문 상태별 색·아이콘(예정 파랑·작성 중 주황·확정 초록). 상태 배지, 달력 칩(tone),
 * 건수만 보여 주는 달력 칸의 점(dot)이 함께 쓴다.
 */
export const VISIT_STATUS_STYLES: Record<
  VisitStatus,
  { variant: BadgeVariant; icon: LucideIcon; tone: string; dot: string }
> = {
  SCHEDULED: {
    variant: "primary",
    icon: ClockIcon,
    tone: "bg-primary-soft text-primary",
    dot: "bg-primary",
  },
  DRAFT: {
    variant: "warning",
    icon: PencilLineIcon,
    tone: "bg-warning-soft text-warning",
    dot: "bg-warning",
  },
  CONFIRMED: {
    variant: "success",
    icon: CircleCheckIcon,
    tone: "bg-success-soft text-success",
    dot: "bg-success",
  },
};
