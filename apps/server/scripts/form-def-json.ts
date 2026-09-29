/**
 * 서식 정의를 JSON으로 내보낸다(원본 PDF 좌표 초안 도구 form-pdf-coords.py 의 입력).
 *
 *   pnpm --filter @repo/server exec tsx scripts/form-def-json.ts HOME_CARE_DOCTOR > def.json
 */
import { FORM_IDS, FORMS, formFields, type FormId } from "@repo/shared-types";

const formId = process.argv[2] as FormId;
if (!FORM_IDS.includes(formId)) {
  console.error(`서식 ID: ${FORM_IDS.join(", ")}`);
  process.exit(1);
}
const fields = formFields(FORMS[formId]).map((field) => ({
  key: field.key,
  label: field.label,
  type: field.type,
  options:
    field.type === "single" || field.type === "multi"
      ? field.options.map((option) => ({
          value: option.value,
          label: option.label,
          detail: option.detail?.kind ?? null,
        }))
      : [],
}));
console.log(JSON.stringify({ formId, fields }, null, 2));
