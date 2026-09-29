/**
 * 서식 PDF 미리보기(좌표 확인용). 모든 선택지·괄호·글 칸을 채운 표본으로 PDF를 만든다.
 * 하나 고르기 칸은 장마다 다음 선택지를 골라, 여러 장을 넘기면 모든 ○ 자리를 볼 수 있다.
 *
 *   pnpm --filter @repo/server exec tsx scripts/form-pdf-preview.ts <출력 폴더>
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FORM_IDS,
  FORMS,
  formFields,
  hasOriginalPdf,
  type FormData,
  type FormId,
} from "@repo/shared-types";
import { buildNurseMonthPdf, buildVisitPdf } from "../src/form-pdf/build.js";
import {
  fullFormData,
  sampleRecord,
} from "../src/form-pdf/sample-records.js";

/** 하나 고르기 칸마다 i번째 선택지(개수보다 크면 마지막)를 고른 값. */
function sweep(formId: FormId, i: number): FormData {
  const data = fullFormData(formId);
  for (const field of formFields(FORMS[formId])) {
    if (field.type !== "single") continue;
    const option = field.options[Math.min(i, field.options.length - 1)]!;
    data[field.key] = {
      value: option.value,
      detail: option.detail ? "괄호" : null,
    };
  }
  return data;
}

async function main(): Promise<void> {
  const out = process.argv[2] ?? "form-pdf-preview";
  await mkdir(out, { recursive: true });
  for (const formId of FORM_IDS) {
    const rounds = Math.max(
      1,
      ...formFields(FORMS[formId]).map((f) =>
        f.type === "single" ? f.options.length : 1,
      ),
    );
    const records = Array.from({ length: rounds }, (_, i) =>
      sampleRecord(formId, { data: sweep(formId, i) }),
    );
    if (hasOriginalPdf(formId)) {
      await writeFile(
        join(out, `${formId}-original.pdf`),
        await buildVisitPdf(records, "original", formId),
      );
    }
    await writeFile(
      join(out, `${formId}-standard.pdf`),
      await buildVisitPdf([records[0]!], "standard", formId),
    );
  }
  // 제7호 월간: 7건 → 두 장(5 + 2)
  const month = Array.from({ length: 7 }, (_, i) => {
    const date = `2026-09-${String(3 + i * 4).padStart(2, "0")}`;
    return sampleRecord("HOME_CARE_NURSE", {
      data: sweep("HOME_CARE_NURSE", i % 2),
      visitDate: date,
      startedAt: `${date}T0${i}:05:00.000Z`,
      endedAt: `${date}T0${i}:45:00.000Z`,
    });
  });
  await writeFile(
    join(out, "HOME_CARE_NURSE-month.pdf"),
    await buildNurseMonthPdf(
      month,
      "month",
      "케어노트 출력 · 2026년 9월 확정 방문 7건",
    ),
  );
  console.log(`미리보기를 만들었습니다: ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
