import { withParticle } from "../text.js";
import {
  missingRequiredFields,
  type FieldDef,
  type FormData,
  type FormDef,
} from "./engine.js";
import { HOME_CARE_DOCTOR_FORM } from "./home-care-doctor.js";
import { HOME_CARE_NURSE_FORM } from "./home-care-nurse.js";
import { HOME_CARE_SOCIAL_FORM } from "./home-care-social.js";
import { LTC_NURSING_FORM } from "./ltc-nursing.js";
import { PRIMARY_CARE_CHECK_FORM } from "./primary-care-check.js";

export * from "./engine.js";

export const FORM_IDS = [
  "PRIMARY_CARE_CHECK",
  "HOME_CARE_DOCTOR",
  "HOME_CARE_NURSE",
  "HOME_CARE_SOCIAL",
  "LTC_NURSING",
] as const;
export type FormId = (typeof FORM_IDS)[number];

export const FORMS: Record<FormId, FormDef> = {
  PRIMARY_CARE_CHECK: PRIMARY_CARE_CHECK_FORM,
  HOME_CARE_DOCTOR: HOME_CARE_DOCTOR_FORM,
  HOME_CARE_NURSE: HOME_CARE_NURSE_FORM,
  HOME_CARE_SOCIAL: HOME_CARE_SOCIAL_FORM,
  LTC_NURSING: LTC_NURSING_FORM,
};

/** 서식을 이름으로 가리킬 때: "별지 제4호 방문진료 점검서식". */
export function formLabel(formId: FormId): string {
  return `${FORMS[formId].code} ${FORMS[formId].shortTitle}`;
}

/** 서식별 값. 방문 한 건에 서식이 여러 개일 수 있다(재택의료 의사: 별지 4·6호). */
export type VisitForms = Partial<Record<FormId, FormData>>;

/** 방문의 서식마다 비어 있는 필수 칸. 빈 칸이 없는 서식은 뺀다(서식 순서대로). */
export function findMissingRequired(
  formIds: readonly FormId[],
  forms: Partial<Record<FormId, Readonly<Record<string, unknown>>>>,
): { formId: FormId; fields: FieldDef[] }[] {
  return formIds
    .map((formId) => ({
      formId,
      fields: missingRequiredFields(FORMS[formId], forms[formId]),
    }))
    .filter(({ fields }) => fields.length > 0);
}

/**
 * 확정하지 못하는 까닭: "방문진료 점검서식의 방문진료유형, 진료 및 조치 내용을 채워 주세요".
 * 서식이 여럿이면 첫 서식을 말하고 다른 서식도 있다고 덧붙인다.
 */
export function missingRequiredMessage(
  missing: readonly { formId: FormId; fields: readonly FieldDef[] }[],
): string {
  const [first, ...rest] = missing;
  if (!first) return "";
  const labels = first.fields.map((field) => field.label);
  const last = labels.pop()!;
  const list = [...labels, withParticle(last, "을/를")].join(", ");
  const others =
    rest.length > 0
      ? ` 다른 서식 ${rest.length}개에도 빈 필수 칸이 있습니다.`
      : "";
  return `${FORMS[first.formId].shortTitle}의 ${list} 채워 주세요.${others}`;
}
