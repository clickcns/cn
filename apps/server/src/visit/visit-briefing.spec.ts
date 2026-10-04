import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRIEFING_FIELDS,
  briefingForViewer,
  buildVisitBriefing,
  FORMS,
  formFields,
  type FormId,
  type Profession,
  type Program,
  type RecipientRecord,
  type VisitForms,
} from "@repo/shared-types";

let seq = 0;
/** 지난 기록 한 건(최신순 목록에 넣는다). */
function record(
  profession: Profession,
  program: Program,
  date: string,
  forms: VisitForms,
  status: "CONFIRMED" | "DRAFT" = "CONFIRMED",
): RecipientRecord {
  seq += 1;
  const formIds = Object.keys(forms) as FormId[];
  return {
    id: `r${seq}`,
    organizationId: "org",
    program,
    status,
    scheduledAt: `${date}T01:00:00.000Z`,
    startedAt: null,
    endedAt: null,
    confirmedAt: null,
    staff: { id: `s-${profession}`, name: `${profession} 직원`, profession },
    profession,
    formIds,
    forms,
  };
}

describe("BRIEFING_FIELDS", () => {
  it("칸·선택지가 서식 정의에 있다", () => {
    for (const ref of BRIEFING_FIELDS) {
      const field = formFields(FORMS[ref.formId]).find(
        (candidate) => candidate.key === ref.key,
      );
      assert.ok(field, `${ref.formId}.${ref.key}`);
      const values = ref.presence ? ["YES"] : ref.values;
      if (values) {
        assert.ok(field.type === "single" || field.type === "multi");
        for (const value of values) {
          assert.ok(
            field.options.some((option) => option.value === value),
            `${ref.formId}.${ref.key}.${value}`,
          );
        }
      }
    }
  });
});

describe("buildVisitBriefing", () => {
  const doctor = record("DOCTOR", "HOME_CARE_CENTER", "2026-10-02", {
    HOME_CARE_DOCTOR: {
      nursingOrders: [{ value: "TUBE" }, { value: "PRESSURE_ULCER" }],
      plan: { value: "CONTINUE" },
      physicalTrend: { value: "MAINTAINED" },
      cognitiveTrend: { value: "WORSENED" },
      summary: "  식사량 줄어 영양 관찰  ",
    },
  });
  const olderNurse = record("NURSE", "HOME_CARE_CENTER", "2026-09-20", {
    HOME_CARE_NURSE: { summary: "오래된 총평" },
  });
  const nurse = record(
    "NURSE",
    "HOME_CARE_CENTER",
    "2026-09-28",
    {
      HOME_CARE_NURSE: {
        fall: { value: "YES" },
        delirium: { value: "NO" },
        plan: { value: "REASSESS" },
        systolic: 130,
      },
    },
    "DRAFT",
  );
  const emptyNurseLtc = record("NURSE", "LTC_NURSING", "2026-10-01", {
    LTC_NURSING: { systolic: 120, diastolic: 80 },
  });
  const ltcNurse = record("NURSE", "LTC_NURSING", "2026-09-25", {
    LTC_NURSING: {
      nursingCare: [
        { value: "PRESSURE_ULCER", minutes: 15, note: "천골 부위" },
      ],
      nextPlan: "드레싱 계속",
      unknownField: "버림",
    },
  });
  const records = [doctor, emptyNurseLtc, nurse, ltcNurse, olderNurse];

  it("직종 × 사업마다 보일 칸이 있는 가장 최근 기록 하나, 직종 순서로", () => {
    const sources = buildVisitBriefing(records);
    assert.deepEqual(
      sources.map((source) => [
        source.profession,
        source.program,
        source.recordId,
      ]),
      [
        ["DOCTOR", "HOME_CARE_CENTER", doctor.id],
        ["NURSE", "HOME_CARE_CENTER", nurse.id],
        ["NURSE", "LTC_NURSING", ltcNurse.id],
      ],
    );
    assert.equal(sources[1].draft, true);
    assert.equal(sources[0].date, "2026-10-02");
  });

  it("정한 선택지만(유지·없음은 숨김), 있음 칸은 '있었음', 종류 순서로", () => {
    const [doctorSource, nurseSource] = buildVisitBriefing(records);
    assert.deepEqual(
      doctorSource.items.map((item) => [item.kind, item.key, item.text]),
      [
        ["order", "nursingOrders", "튜브관리, 욕창관리"],
        ["plan", "plan", "관리지속"],
        ["issue", "cognitiveTrend", "악화"],
        ["note", "summary", "식사량 줄어 영양 관찰"],
      ],
    );
    assert.deepEqual(
      nurseSource.items.map((item) => [item.key, item.text]),
      [
        ["plan", "재평가"],
        ["fall", "있었음"],
      ],
    );
  });

  it("제공 시간은 빼고 메모는 남긴다", () => {
    const ltc = buildVisitBriefing(records)[2];
    assert.deepEqual(
      ltc.items.map((item) => [item.key, item.text]),
      [
        ["nextPlan", "드레싱 계속"],
        ["nursingCare", "욕창 관리 — 천골 부위"],
      ],
    );
  });
});

describe("briefingForViewer", () => {
  const sources = buildVisitBriefing([
    record("DOCTOR", "HOME_CARE_CENTER", "2026-10-02", {
      HOME_CARE_DOCTOR: {
        nursingOrders: [{ value: "TUBE" }],
        plan: { value: "CONTINUE" },
      },
      PRIMARY_CARE_CHECK: { plan: { value: "REVISIT" } },
    }),
    record("NURSE", "HOME_CARE_CENTER", "2026-09-28", {
      HOME_CARE_NURSE: { plan: { value: "REASSESS" } },
    }),
    record("SOCIAL_WORKER", "HOME_CARE_CENTER", "2026-09-27", {
      HOME_CARE_SOCIAL: { notes: "보호자 상담 예정" },
    }),
  ]);

  it("간호사에게는 의사 간호지시와 본인 직종 계획을 맨 위로, 본인 직종 묶음을 먼저", () => {
    const view = briefingForViewer(sources, "NURSE");
    assert.deepEqual(
      view.highlights.map(({ source, item }) => [source.profession, item.key]),
      [
        ["DOCTOR", "nursingOrders"],
        ["NURSE", "plan"],
      ],
    );
    assert.deepEqual(
      view.sources.map((source) => source.profession),
      ["NURSE", "DOCTOR", "SOCIAL_WORKER"],
    );
  });

  it("의사에게는 간호지시를 강조하지 않고 본인 계획만(기록마다 첫 계획 칸 하나)", () => {
    const view = briefingForViewer(sources, "DOCTOR");
    assert.deepEqual(
      view.highlights.map(({ item }) => [item.formId, item.key]),
      [["HOME_CARE_DOCTOR", "plan"]],
    );
    assert.equal(
      view.sources[0].items.filter((item) => item.kind === "plan").length,
      2,
    );
  });
});
