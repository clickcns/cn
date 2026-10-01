import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultPortalQueueFrom,
  MarkPortalEntrySchema,
  portalGuide,
  type FormData,
  type FormId,
  type PortalRow,
} from "@repo/shared-types";

const visit = {
  scheduledAt: "2026-10-01T00:30:00.000Z", // 09:30(한국 시간)
  startedAt: "2026-10-01T00:35:00.000Z",
  endedAt: "2026-10-01T01:05:00.000Z",
  confirmedAt: "2026-10-01T02:02:00.000Z",
  staff: {
    id: "s",
    name: "정의사",
    profession: "DOCTOR" as const,
    licenseNumber: "12345",
  },
  recipient: {
    id: "r",
    name: "강옥자",
    chartNumber: "2001",
    birthDate: "1939-03-02",
    gender: "FEMALE" as const,
    careGrade: "1" as const,
    phone: null,
    address: null,
    guardianName: null,
    guardianPhone: null,
    notes: null,
    ltcCertNumber: "L0000001101",
  },
  forms: {},
};

/** 서식 하나의 도우미 칸을 키로(머리 칸 포함). */
function rowsOf(formId: FormId, data: FormData) {
  const guide = portalGuide(
    { ...visit, forms: { [formId]: data } },
    formId,
    undefined,
  );
  return new Map<string, PortalRow>(
    guide.sections
      .flatMap((section) => section.rows)
      .map((row) => [row.key, row]),
  );
}

describe("포털 입력 도우미", () => {
  it("고른 항목은 체크할 이름으로, 괄호 글·숫자·글 칸은 붙여 넣을 값으로 늘어놓는다", () => {
    const rows = rowsOf("PRIMARY_CARE_CHECK", {
      ltcGrade: { value: "GRADE_1" },
      homeCareSupport: [],
      mobility: [{ value: "PRESSURE_ULCER" }, { value: "TERMINAL" }],
      distanceKm: 3,
      visitReason: [
        { value: "DEVICE", detail: "유치도뇨관" },
        { value: "PRESSURE_ULCER" },
      ],
    });
    assert.deepEqual(rows.get("ltcGrade")?.checks, ["1등급"]);
    // 고르지 않은 칸은 체크도 값도 없다(화면에는 "비워 둠").
    assert.deepEqual(rows.get("homeCareSupport"), {
      key: "homeCareSupport",
      label: "요양비",
      checks: [],
      values: [],
    });
    assert.deepEqual(rows.get("mobility")?.checks, [
      "욕창 및 궤양",
      "말기질환(암, 사망선고 등)",
    ]);
    assert.deepEqual(rows.get("distanceKm")?.values, [
      { text: "3", suffix: "km" },
    ]);
    const reason = rows.get("visitReason");
    assert.deepEqual(reason?.checks, ["의료기기 등 교체·관리", "욕창 관리"]);
    assert.deepEqual(reason?.values, [
      { text: "유치도뇨관", label: "의료기기 등 교체·관리 · 종류" },
    ]);
  });

  it("방문간호는 제공 시간을 체크 이름에, 메모는 붙여 넣을 값으로 둔다", () => {
    const rows = rowsOf("LTC_NURSING", {
      nursingCare: [
        { value: "PRESSURE_ULCER", minutes: 15, note: "드레싱 교체" },
      ],
      specialNote: "삼출물 소량",
    });
    assert.deepEqual(rows.get("nursingCare")?.checks, ["욕창 관리 · 15분"]);
    assert.deepEqual(rows.get("nursingCare")?.values, [
      { text: "드레싱 교체", label: "욕창 관리 메모" },
    ]);
    assert.deepEqual(rows.get("specialNote")?.values, [
      { text: "삼출물 소량" },
    ]);
  });

  it("포털 머리 칸은 방문 정보에서 온다(심평원은 작성의사·실시일·수진자)", () => {
    const guide = portalGuide(visit, "PRIMARY_CARE_CHECK", undefined);
    assert.equal(guide.info.short, "심평원");
    assert.deepEqual(
      guide.sections[0]?.rows.map((row) => [row.label, row.values[0]?.text]),
      [
        ["작성의사 성명", "정의사"],
        ["면허번호", "12345"],
        ["방문진료실시일", "2026-10-01"],
        ["수진자 찾기", "강옥자 1939-03-02"],
      ],
    );
    assert.equal(
      rowsOf("HOME_CARE_DOCTOR", {}).get("visitTime")?.values[0]?.text,
      "09:35~10:05",
    );
  });

  it("면허번호·시작 시각이 없거나 포털에 넣은 뒤 다시 확정했으면 알리고, 늘 보이는 주의를 붙인다", () => {
    assert.deepEqual(
      portalGuide(visit, "PRIMARY_CARE_CHECK", undefined).checks.map(
        (check) => check.ok,
      ),
      [true, true, false, false],
    );
    const warned = portalGuide(
      {
        ...visit,
        startedAt: null,
        staff: { ...visit.staff, licenseNumber: null },
      },
      "PRIMARY_CARE_CHECK",
      { enteredAt: "2026-10-01T01:00:00.000Z" },
    ).checks;
    assert.deepEqual(
      warned.slice(0, 3).map((check) => check.ok),
      [false, false, false],
    );
    // 공단은 면허번호를 보지 않는다(시작 시각 + 늘 보이는 주의 2개).
    assert.equal(
      portalGuide(visit, "HOME_CARE_DOCTOR", undefined).checks.length,
      3,
    );
  });

  it("미입력 목록 기간은 지난달 1일부터, 메모는 200자까지", () => {
    assert.equal(defaultPortalQueueFrom("2026-10-01"), "2026-09-01");
    assert.equal(defaultPortalQueueFrom("2026-01-15"), "2025-12-01");
    assert.equal(MarkPortalEntrySchema.parse({ note: "  " }).note, null);
    assert.equal(
      MarkPortalEntrySchema.safeParse({ note: "가".repeat(201) }).success,
      false,
    );
  });
});
