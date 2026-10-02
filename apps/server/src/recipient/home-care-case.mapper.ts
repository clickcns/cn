import type {
  ExternalService,
  ExternalServiceSchedule,
  HomeCareAssessment,
  HomeCareAssessmentFact,
  HomeCareCase,
  HomeCareRecipient,
} from "@repo/shared-types";
import { fromDbDate } from "../core/utils/db-date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { toCareGrade } from "./recipient.mapper.js";

/** 판정에 쓰는 다른 기관 서비스 일정. */
export const externalServiceScheduleSelect = {
  kind: true,
  provider: true,
  weekdays: true,
  startsOn: true,
  endsOn: true,
  startTime: true,
  endTime: true,
} as const satisfies Prisma.RecipientExternalServiceSelect;

type ScheduleRow = Prisma.RecipientExternalServiceGetPayload<{
  select: typeof externalServiceScheduleSelect;
}>;

export function toExternalServiceSchedule(
  row: ScheduleRow,
): ExternalServiceSchedule {
  return {
    kind: row.kind,
    provider: row.provider,
    weekdays: row.weekdays,
    startsOn: fromDbDate(row.startsOn),
    endsOn: fromDbDate(row.endsOn),
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

/** 판정에 쓰는 포괄평가(평가한 날 순서로 받는다). */
export const assessmentFactArgs = {
  select: { assessedOn: true, kind: true },
  orderBy: { assessedOn: "asc" },
} as const satisfies Prisma.HomeCareAssessmentFindManyArgs;

export function toAssessmentFact(row: {
  assessedOn: Date;
  kind: HomeCareAssessmentFact["kind"];
}): HomeCareAssessmentFact {
  return { assessedOn: fromDbDate(row.assessedOn), kind: row.kind };
}

/** 사례 정보 화면(GET /recipients/:id/home-care-case). */
export const homeCareCaseSelect = {
  homeCareEndedOn: true,
  homeCareEndReason: true,
  assessments: {
    select: {
      id: true,
      assessedOn: true,
      kind: true,
      note: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { assessedOn: "asc" },
  },
  externalServices: {
    select: { id: true, note: true, ...externalServiceScheduleSelect },
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.RecipientSelect;

type CaseRow = Prisma.RecipientGetPayload<{
  select: typeof homeCareCaseSelect;
}>;

export function toHomeCareCase(row: CaseRow): HomeCareCase {
  return {
    assessments: row.assessments.map((assessment): HomeCareAssessment => ({
      ...toAssessmentFact(assessment),
      id: assessment.id,
      note: assessment.note,
      createdBy: assessment.createdBy,
      createdAt: assessment.createdAt.toISOString(),
    })),
    externalServices: row.externalServices.map((service): ExternalService => ({
      ...toExternalServiceSchedule(service),
      id: service.id,
      note: service.note,
    })),
    homeCareEndedOn: fromDbDate(row.homeCareEndedOn),
    homeCareEndReason: row.homeCareEndReason,
  };
}

/** 재택의료 수입의 수급자(판정에 쓰는 사례 정보 포함). */
export const homeCareRecipientSelect = {
  id: true,
  organizationId: true,
  name: true,
  careGrade: true,
  programs: true,
  isActive: true,
  homeCareEndedOn: true,
  homeCareEndReason: true,
  organization: { select: { institutionType: true } },
  assessments: assessmentFactArgs,
  externalServices: { select: externalServiceScheduleSelect },
} as const satisfies Prisma.RecipientSelect;

type HomeCareRecipientRow = Prisma.RecipientGetPayload<{
  select: typeof homeCareRecipientSelect;
}>;

/** extraServices: 기록한 다른 기관 서비스에 더할 일정(같은 기관의 그달 장기요양 방문간호 날). */
export function toHomeCareRecipient(
  row: HomeCareRecipientRow,
  extraServices: readonly ExternalServiceSchedule[] = [],
): HomeCareRecipient {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    careGrade: toCareGrade(row.careGrade),
    programs: row.programs,
    isActive: row.isActive,
    institutionType: row.organization.institutionType,
    homeCareEndedOn: fromDbDate(row.homeCareEndedOn),
    homeCareEndReason: row.homeCareEndReason,
    assessments: row.assessments.map(toAssessmentFact),
    externalServices: [
      ...row.externalServices.map(toExternalServiceSchedule),
      ...extraServices,
    ],
  };
}
