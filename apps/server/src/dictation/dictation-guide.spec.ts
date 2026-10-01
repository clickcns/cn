import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DICTATION_POINTS,
  dictationFields,
  dictationPoints,
  filledDraftFields,
  filledItemCount,
  FORMS,
  missingDictationItems,
  PROGRAM_FORMS,
  type FormId,
  type Profession,
  type Program,
  type VisitDictation,
} from "@repo/shared-types";

describe("구술 내용", () => {
  it("규칙이 있는 사업 × 직종마다 있고, 칸은 그 규칙 서식의 구술 칸이며 필수 칸과 되묻는 칸을 모두 다룬다", () => {
    for (const [program, byProfession] of Object.entries(PROGRAM_FORMS)) {
      for (const [profession, rules] of Object.entries(byProfession)) {
        const points =
          DICTATION_POINTS[program as Program][profession as Profession];
        assert.ok(points && points.length > 0, `${program} ${profession}`);
        const refs = new Set(
          rules.flatMap((rule) =>
            dictationFields(FORMS[rule.formId]).map(
              (field) => `${rule.formId}.${field.key}`,
            ),
          ),
        );
        const used = new Set<string>(points.flatMap((point) => point.fields));
        for (const ref of used) assert.ok(refs.has(ref), `${program} ${ref}`);
        for (const rule of rules) {
          for (const field of dictationFields(FORMS[rule.formId])) {
            if (!field.required && !field.question) continue;
            const ref = `${rule.formId}.${field.key}`;
            assert.ok(used.has(ref), `구술 내용에 없는 칸 ${ref}`);
          }
        }
      }
    }
  });

  it("방문에 없는 서식의 칸만 채우는 항목은 빼고, 필수 칸이 있으면 필수로 표시한다", () => {
    const both = dictationPoints("HOME_CARE_CENTER", "DOCTOR", [
      "PRIMARY_CARE_CHECK",
      "HOME_CARE_DOCTOR",
    ]);
    const only6 = dictationPoints("HOME_CARE_CENTER", "DOCTOR", [
      "HOME_CARE_DOCTOR",
    ]);
    assert.equal(both.length, only6.length + 1);
    assert.ok(!only6.some((point) => point.topic === "방문진료 정보"));
    assert.deepEqual(
      only6.filter((point) => point.required).map((point) => point.topic),
      ["방문 사유", "진찰·처치"],
    );
    // 별지 제14호에는 확정 전에 채울 칸이 없다.
    assert.ok(
      dictationPoints("LTC_NURSING", "NURSE", ["LTC_NURSING"]).every(
        (point) => !point.required,
      ),
    );
  });
});

function dictationOf(
  formId: FormId,
  values: Record<string, unknown>,
  questions: VisitDictation["questions"] = [],
): Pick<VisitDictation, "draft" | "questions"> {
  return {
    draft: { [formId]: { values, evidence: {} } },
    questions,
  };
}

describe("초안에서 빠진 항목", () => {
  it("서버 질문을 먼저 쓰고, 질문 없는 빈 구술 칸을 부가 항목으로 더하며, 필수를 앞에 둔다", () => {
    const items = missingDictationItems(
      dictationOf("HOME_CARE_NURSE", { visitType: { value: "REGULAR" } }, [
        {
          question: "혈압은 얼마였나요?",
          fields: ["HOME_CARE_NURSE.systolic", "HOME_CARE_NURSE.diastolic"],
        },
        {
          question: "오늘 제공한 간호 내용을 말씀해 주세요",
          fields: ["HOME_CARE_NURSE.care"],
        },
      ]),
      ["HOME_CARE_NURSE"],
    );
    assert.deepEqual(items[0], {
      fields: ["HOME_CARE_NURSE.care"],
      labels: ["방문내용"],
      required: true,
      question: "오늘 제공한 간호 내용을 말씀해 주세요",
      options: [
        "기초건강관리",
        "투약관리",
        "운동관리",
        "영양관리",
        "정신심리상담",
        "통증관리",
        "튜브관리",
        "욕창관리",
      ],
      unit: null,
    });
    assert.deepEqual(items[1].labels, ["혈압"]);
    assert.equal(items[1].unit, "mmHg");
    const optional = items.slice(2);
    assert.ok(optional.every((item) => !item.required && !item.question));
    const labels = optional.map((item) => item.labels[0]);
    assert.equal(labels[0], "동행자");
    assert.ok(!labels.includes("혈압") && !labels.includes("방문사유"));
  });

  it("기록에 이미 있는 값(저장·이월)은 빠진 것으로 보지 않는다", () => {
    const items = missingDictationItems(
      dictationOf("HOME_CARE_NURSE", {}, [
        {
          question: "오늘 제공한 간호 내용을 말씀해 주세요",
          fields: ["HOME_CARE_NURSE.care"],
        },
      ]),
      ["HOME_CARE_NURSE"],
      {
        HOME_CARE_NURSE: {
          care: [{ value: "MEDICATION" }],
          companion: [{ value: "DOCTOR" }],
        },
      },
    );
    const labels = items.flatMap((item) => item.labels);
    assert.ok(!labels.includes("방문내용") && !labels.includes("동행자"));
  });

  it("followUps 의 '이 중 하나' 묶음은 한 칸이라도 차 있으면 나머지를 묻지 않는다", () => {
    const labels = missingDictationItems(
      dictationOf("LTC_NURSING", {
        healthCare: [{ value: "MEDICATION", minutes: 10 }],
      }),
      ["LTC_NURSING"],
    ).flatMap((item) => item.labels);
    assert.ok(!labels.includes("간호관리"));
    assert.ok(labels.includes("특이사항"));
  });

  it("초안을 만든 뒤 더한 서식(초안 키 없음)의 칸은 넣지 않는다", () => {
    const items = missingDictationItems(dictationOf("HOME_CARE_DOCTOR", {}), [
      "PRIMARY_CARE_CHECK",
      "HOME_CARE_DOCTOR",
    ]);
    assert.ok(
      items.every((item) =>
        item.fields.every((ref) => ref.startsWith("HOME_CARE_DOCTOR.")),
      ),
    );
  });
});

describe("초안에서 채운 항목", () => {
  it("채운 칸만 서식 순서로 모으고, 숫자 짝(혈압)은 한 항목으로 센다", () => {
    const filled = filledDraftFields(
      dictationOf("HOME_CARE_NURSE", {
        systolic: 130,
        diastolic: 80,
        pulse: 76,
        notes: "",
      }),
      ["PRIMARY_CARE_CHECK", "HOME_CARE_NURSE"],
    );
    assert.deepEqual(
      filled.map(({ formId, fields }) => [
        formId,
        fields.map((field) => field.key),
      ]),
      [["HOME_CARE_NURSE", ["systolic", "diastolic", "pulse"]]],
    );
    assert.equal(filledItemCount(filled), 2);
  });
});
