import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DictationSentence } from "@repo/shared-types";
import type { LlmDraft } from "./draft-prompt.js";
import { followUpQuestions, validateDraft } from "./validate-draft.js";

const sentences: DictationSentence[] = [
  "최말순 어르신 정기 방문했습니다.",
  "혈압 130에 85, 체온 36.8도입니다.",
  "천골 욕창 드레싱 교체했고 15분 걸렸습니다.",
  "맥박은 칠십이 회였어요.",
  "체중은 지난달보다 1킬로 줄었어요.",
  "섬망은 없었고 관리 지속하겠습니다.",
].map((text, index) => ({
  id: `S${index + 1}`,
  text,
  take: 1,
  start: index,
  end: index + 1,
}));

const none = { value: null, quote: null, evidence: [] };
const num = (value: number, quote: string, evidence: string[]) => ({
  value,
  quote,
  evidence,
});
const pick = (
  value: string,
  evidence: string[],
  detail: string | null = null,
) => ({
  value,
  detail,
  evidence,
});

/** 재택의료 간호사 서식(별지 제7호) LLM 응답. overrides로 칸을 바꾼다. */
function nurseDraft(overrides: Record<string, unknown> = {}): LlmDraft {
  return {
    HOME_CARE_NURSE: {
      visitType: pick("REGULAR", ["S1"]),
      companion: { items: [] },
      care: { items: [pick("PRESSURE_ULCER", ["S3"], "천골")] },
      systolic: num(130, "130", ["S2"]),
      diastolic: num(85, "85", ["S2"]),
      pulse: num(72, "칠십이", ["S4"]),
      temperature: num(36.8, "36.8", ["S2"]),
      glucose: none,
      weightChange: num(-1, "1", ["S5"]),
      delirium: pick("NO", ["S6"]),
      fall: { value: null, evidence: [] },
      incontinence: { value: null, evidence: [] },
      notes: { text: "", evidence: [] },
      plan: pick("CONTINUE", ["S6"]),
      summary: { text: "욕창 드레싱 교체함", evidence: ["S3"] },
      ...overrides,
    },
  };
}

const NURSE = ["HOME_CARE_NURSE"] as const;
const nurseValues = (raw: LlmDraft) =>
  validateDraft(NURSE, raw, sentences).draft.HOME_CARE_NURSE?.values ?? {};

describe("validateDraft", () => {
  it("근거와 맞는 값은 남기고 근거를 붙인다", () => {
    const { draft, issues } = validateDraft(NURSE, nurseDraft(), sentences);
    const form = draft.HOME_CARE_NURSE!;
    assert.deepEqual(issues, []);
    assert.equal(form.values.systolic, 130);
    assert.equal(form.values.pulse, 72);
    assert.equal(form.values.temperature, 36.8);
    assert.deepEqual(form.values.care, [
      { value: "PRESSURE_ULCER", detail: "천골" },
    ]);
    assert.deepEqual(form.evidence.pulse, { ids: ["S4"], quotes: ["칠십이"] });
    assert.deepEqual(form.evidence["care.PRESSURE_ULCER"]?.ids, ["S3"]);
  });

  it("증감 칸은 크기만 대조한다(감 1kg)", () => {
    assert.equal(nurseValues(nurseDraft()).weightChange, -1);
  });

  it("근거 문장에 없는 숫자는 비운다", () => {
    const { draft, issues } = validateDraft(
      NURSE,
      nurseDraft({ pulse: num(80, "80", ["S4"]) }),
      sentences,
    );
    assert.equal(draft.HOME_CARE_NURSE?.values.pulse, undefined);
    assert.equal(issues[0]?.field, "HOME_CARE_NURSE.pulse");
    assert.equal(issues[0]?.severity, "removed");
  });

  it("quote는 맞아도 값을 고쳤으면 비운다", () => {
    const { issues } = validateDraft(
      NURSE,
      nurseDraft({ systolic: num(135, "130", ["S2"]) }),
      sentences,
    );
    assert.match(issues[0]?.message ?? "", /달라/);
  });

  it("근거 문장 ID가 없거나 틀리면 비운다", () => {
    const values = nurseValues(
      nurseDraft({
        systolic: num(130, "130", []),
        temperature: num(36.8, "36.8", ["S99"]),
        delirium: pick("NO", []),
      }),
    );
    assert.equal(values.systolic, undefined);
    assert.equal(values.temperature, undefined);
    assert.equal(values.delirium, undefined);
  });

  it("소수 첫째 자리를 넘는 값은 비운다(체온 36.55)", () => {
    const precise: DictationSentence[] = [
      { id: "S1", text: "체온 36.55도", take: 1, start: 0, end: 1 },
    ];
    const { draft, issues } = validateDraft(
      NURSE,
      nurseDraft({ temperature: num(36.55, "36.55", ["S1"]) }),
      precise,
    );
    assert.equal(draft.HOME_CARE_NURSE?.values.temperature, undefined);
    assert.ok(
      issues.some(
        (issue) =>
          issue.field === "HOME_CARE_NURSE.temperature" &&
          issue.message.includes("소수 첫째 자리까지"),
      ),
    );
  });

  it("범위를 벗어난 값은 비운다", () => {
    const outOfRange: DictationSentence[] = [
      { id: "S1", text: "체온 368도", take: 1, start: 0, end: 1 },
    ];
    const { draft, issues } = validateDraft(
      NURSE,
      nurseDraft({ temperature: num(368, "368", ["S1"]) }),
      outOfRange,
    );
    assert.equal(draft.HOME_CARE_NURSE?.values.temperature, undefined);
    assert.ok(
      issues.some((issue) => issue.field === "HOME_CARE_NURSE.temperature"),
    );
  });

  it("수축기가 이완기보다 높지 않으면 혈압을 둘 다 비운다", () => {
    const { draft, issues } = validateDraft(
      NURSE,
      nurseDraft({
        systolic: num(85, "85", ["S2"]),
        diastolic: num(130, "130", ["S2"]),
      }),
      sentences,
    );
    assert.equal(draft.HOME_CARE_NURSE?.values.systolic, undefined);
    assert.equal(draft.HOME_CARE_NURSE?.values.diastolic, undefined);
    assert.ok(
      issues.some(
        (issue) =>
          issue.field === "HOME_CARE_NURSE.systolic" &&
          issue.message ===
            "혈압 85/130: 수축기 혈압이 이완기 혈압보다 높지 않아 둘 다 비웠습니다",
      ),
    );
  });

  it("근거 없는 항목은 빼고, 같은 항목은 하나만, 괄호 없는 항목의 detail은 버린다", () => {
    const values = nurseValues(
      nurseDraft({
        care: {
          items: [
            pick("PRESSURE_ULCER", ["S3"], "천골"),
            pick("PRESSURE_ULCER", ["S3"], "발뒤꿈치"),
            pick("PAIN", []),
            pick("MEDICATION", ["S3"], "엉뚱한 괄호"),
          ],
        },
      }),
    );
    assert.deepEqual(values.care, [
      { value: "PRESSURE_ULCER", detail: "천골" },
      { value: "MEDICATION", detail: null },
    ]);
  });

  it("선택형 괄호(choice)는 선택지 값만 받는다", () => {
    const social = (detail: string) =>
      validateDraft(
        ["HOME_CARE_SOCIAL"],
        {
          HOME_CARE_SOCIAL: {
            content: { items: [pick("LINK_PROVIDED", ["S1"], detail)] },
          },
        },
        sentences,
      ).draft.HOME_CARE_SOCIAL?.values.content;
    assert.deepEqual(social("REFERRAL"), [
      { value: "LINK_PROVIDED", detail: "REFERRAL" },
    ]);
    assert.deepEqual(social("아무거나"), [
      { value: "LINK_PROVIDED", detail: null },
    ]);
  });

  it("글의 숫자가 구술에 없으면 확인 요청만 남긴다", () => {
    const { draft, issues } = validateDraft(
      NURSE,
      nurseDraft({ summary: { text: "욕창 4×3cm", evidence: ["S3"] } }),
      sentences,
    );
    assert.equal(draft.HOME_CARE_NURSE?.values.summary, "욕창 4×3cm");
    assert.ok(
      issues.some(
        (issue) =>
          issue.severity === "check" &&
          issue.field === "HOME_CARE_NURSE.summary",
      ),
    );
  });

  it("항목별 제공 시간(분)도 근거 문장과 대조한다(별지 제14호)", () => {
    const ltc = (minutes: ReturnType<typeof num>) =>
      validateDraft(
        ["LTC_NURSING"],
        {
          LTC_NURSING: {
            nursingCare: {
              items: [
                {
                  ...pick("PRESSURE_ULCER", ["S3"]),
                  minutes,
                  note: "폼 드레싱 교체",
                },
              ],
            },
          },
        },
        sentences,
      ).draft.LTC_NURSING?.values.nursingCare;
    assert.deepEqual(ltc(num(15, "15", ["S3"])), [
      {
        value: "PRESSURE_ULCER",
        detail: null,
        minutes: 15,
        note: "폼 드레싱 교체",
      },
    ]);
    assert.deepEqual(ltc(num(20, "20", ["S3"])), [
      {
        value: "PRESSURE_ULCER",
        detail: null,
        minutes: null,
        note: "폼 드레싱 교체",
      },
    ]);
  });

  it("두 서식에 같은 문제가 나와도 서식마다 남긴다(한 번만 보여 주는 것은 화면)", () => {
    const answer = { visitReason: pick("REGULAR", []) };
    const { issues } = validateDraft(
      ["HOME_CARE_DOCTOR", "HOME_CARE_DOCTOR"],
      { HOME_CARE_DOCTOR: answer },
      sentences,
    );
    assert.equal(issues.length, 2);
    assert.equal(issues[0]?.message, issues[1]?.message);
  });
});

describe("followUpQuestions", () => {
  it("빈 필수 칸을 묻고, 같은 질문은 한 번만 묻는다", () => {
    const { draft } = validateDraft(
      NURSE,
      nurseDraft({
        systolic: none,
        diastolic: none,
        plan: { value: null, evidence: [] },
      }),
      sentences,
    );
    const questions = followUpQuestions(NURSE, draft);
    const bp = questions.find((q) => q.question === "혈압은 얼마였나요?");
    assert.deepEqual(bp?.fields, [
      "HOME_CARE_NURSE.systolic",
      "HOME_CARE_NURSE.diastolic",
    ]);
    // 섬망은 답했지만 낙상·실금이 비어 한 질문으로 묻는다.
    assert.equal(
      questions.filter((q) => q.question === "섬망·낙상·실금이 있었나요?")
        .length,
      1,
    );
    assert.ok(questions.some((q) => q.fields.includes("HOME_CARE_NURSE.plan")));
  });

  it("여러 서식에 같은 질문이 있으면 한 번만 묻는다(의사: 별지 제4·6호)", () => {
    const formIds = ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"] as const;
    const questions = followUpQuestions(formIds, {});
    const plan = questions.filter(
      (q) => q.question === "향후 계획은 어떻게 되나요?",
    );
    assert.equal(plan.length, 1);
    assert.deepEqual(plan[0]?.fields, [
      "PRIMARY_CARE_CHECK.plan",
      "HOME_CARE_DOCTOR.plan",
    ]);
  });

  it("시간 없는 처치와, 처치가 하나도 없을 때를 묻는다(별지 제14호)", () => {
    const empty = followUpQuestions(["LTC_NURSING"], {});
    assert.ok(empty.some((q) => q.question.startsWith("오늘 제공한 처치")));

    const { draft } = validateDraft(
      ["LTC_NURSING"],
      {
        LTC_NURSING: {
          healthCare: {
            items: [
              { ...pick("MEDICATION", ["S1"]), minutes: none, note: null },
            ],
          },
          nursingCare: {
            items: [{ ...pick("PAIN", ["S1"]), minutes: none, note: null }],
          },
        },
      },
      sentences,
    );
    const questions = followUpQuestions(["LTC_NURSING"], draft).map(
      (q) => q.question,
    );
    assert.ok(questions.includes("투약 관리는 몇 분 동안 하셨나요?"));
    assert.ok(questions.includes("통증 관리는 몇 분 동안 하셨나요?"));
    assert.ok(!questions.some((q) => q.startsWith("오늘 제공한 처치")));
  });
});
