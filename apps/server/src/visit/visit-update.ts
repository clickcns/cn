import {
  canBeAssignedVisits,
  canReassignVisit,
  canRescheduleVisit,
  formIdsForNewStaff,
  selectForms,
  type FormId,
  type Profession,
  type Program,
  type Role,
  type UpdateVisitSchema,
  type VisitStatus,
} from "@repo/shared-types";
import type { z } from "zod";

/** 잠근 뒤 다시 읽은 바꿀 방문. */
export interface VisitUpdateTarget {
  status: VisitStatus;
  program: Program;
  organizationId: string;
  staffId: string;
  scheduledAt: Date;
  formIds: FormId[];
  /** 담당자가 녹음한 구술이 있는지(예정 방문에도 있을 수 있다) */
  hasDictation: boolean;
  /** 방문한 직종(Visit.profession) */
  profession: Profession;
}

/** 새 담당자(담당자를 바꿀 때만). */
export interface VisitUpdateStaff {
  role: Role;
  profession: Profession | null;
  isActive: boolean;
  organizationId: string | null;
}

/** 바꿀 값. 비어 있으면 바뀐 것이 없다. */
export interface VisitUpdateData {
  scheduledAt?: Date;
  staffId?: string;
  /** 담당자를 바꾸면 새 담당자의 직종 */
  profession?: Profession;
  formIds?: FormId[];
}

export type VisitUpdatePlan =
  | { ok: true; data: VisitUpdateData }
  | { ok: false; kind: "conflict" | "invalid"; message: string };

/** 방문을 맡길 수 있는 사용자인지: 활성·직종 있음·그 기관 소속(방문 등록과 담당자 변경이 함께 쓴다). */
export function isAssignableStaff(
  staff: VisitUpdateStaff | null,
  organizationId: string,
): staff is VisitUpdateStaff & { profession: Profession } {
  return (
    !!staff?.isActive &&
    canBeAssignedVisits(staff) &&
    staff.organizationId === organizationId
  );
}

/**
 * 방문 일정·담당자 바꾸기 규칙. DB 없이 판단하므로 규칙을 단위 테스트한다.
 * - 화면이 본 일시(expectedScheduledAt)와 지금 일시가 다르면 409(그사이 다른 사람이 옮김).
 * - 일정은 확정 전만(409), 담당자는 예정·구술 없음만(409).
 * - 새 담당자는 활성·직종 있음·방문과 같은 기관(400), 새 직종이 이 사업을 맡을 수 있어야 한다(400).
 */
export function planVisitUpdate(
  visit: VisitUpdateTarget,
  dto: z.output<typeof UpdateVisitSchema>,
  newStaff: VisitUpdateStaff | null,
): VisitUpdatePlan {
  if (
    dto.expectedScheduledAt &&
    new Date(dto.expectedScheduledAt).getTime() !== visit.scheduledAt.getTime()
  ) {
    return conflict(
      "그사이 방문 일정이 바뀌었습니다. 달력을 새로 불러와 주세요",
    );
  }

  const data: VisitUpdateData = {};

  if (dto.scheduledAt) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() !== visit.scheduledAt.getTime()) {
      if (!canRescheduleVisit(visit.status)) {
        return conflict(
          "확정된 방문은 일정을 바꿀 수 없습니다. 담당자가 [수정]으로 되돌린 뒤 바꿔 주세요",
        );
      }
      data.scheduledAt = scheduledAt;
    }
  }

  if (dto.staffId && dto.staffId !== visit.staffId) {
    if (!canReassignVisit(visit.status)) {
      return conflict("기록을 쓰기 시작한 방문은 담당자를 바꿀 수 없습니다");
    }
    if (visit.hasDictation) {
      return conflict("담당자가 녹음한 구술이 있어 담당자를 바꿀 수 없습니다");
    }
    if (!isAssignableStaff(newStaff, visit.organizationId)) {
      return invalid(
        "담당자를 선택해 주세요(방문과 같은 기관의, 직종이 있는 사용자만 배정할 수 있습니다)",
      );
    }
    const selection = selectForms(
      visit.program,
      newStaff.profession,
      dto.formIds ??
        formIdsForNewStaff(
          visit.program,
          visit.formIds,
          visit.profession,
          newStaff.profession,
        ),
    );
    if (!selection.ok) return invalid(selection.message);
    data.staffId = dto.staffId;
    data.profession = newStaff.profession;
    data.formIds = selection.formIds;
  }

  return { ok: true, data };
}

function conflict(message: string): VisitUpdatePlan {
  return { ok: false, kind: "conflict", message };
}

function invalid(message: string): VisitUpdatePlan {
  return { ok: false, kind: "invalid", message };
}
