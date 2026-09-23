import type { FormData, FormDef } from "./engine.js";
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

/** 서식별 값. 방문 한 건에 서식이 여러 개일 수 있다(재택의료 의사: 별지 4·6호). */
export type VisitForms = Partial<Record<FormId, FormData>>;
