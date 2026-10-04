import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORM_IDS,
  FORMS,
  formatVitalChange,
  formatVitalValue,
  formFields,
  VITAL_SIGNS,
  vitalChangeLabel,
  vitalSummary,
  vitalTrends,
  type VisitForms,
  type VitalRecord,
} from "@repo/shared-types";

let seq = 0;
function record(
  date: string,
  forms: VisitForms,
  status: "CONFIRMED" | "DRAFT" = "CONFIRMED",
): VitalRecord {
  seq += 1;
  return {
    id: `v${seq}`,
    status,
    scheduledAt: `${date}T01:00:00.000Z`,
    startedAt: null,
    forms,
  };
}

describe("VITAL_SIGNS", () => {
  it("칸은 서식에 있고, 같은 키의 칸은 어느 서식에서나 같은 정의다", () => {
    for (const sign of VITAL_SIGNS) {
      for (const field of sign.fields) {
        const inForms = FORM_IDS.flatMap((formId) =>
          formFields(FORMS[formId]).filter(
            (candidate) => candidate.key === field.key,
          ),
        );
        assert.ok(inForms.length > 0, field.key);
        for (const candidate of inForms) {
          assert.deepEqual(candidate, field, field.key);
        }
      }
    }
    const pressure = VITAL_SIGNS.find((sign) => sign.id === "bloodPressure")!;
    for (const form of [FORMS.HOME_CARE_NURSE, FORMS.LTC_NURSING]) {
      assert.deepEqual(
        pressure.fields.map((field) => field.key),
        [...form.numberPairs![0].keys],
      );
    }
  });
});

describe("vitalTrends", () => {
  // 지난 기록은 최신순으로 온다.
  const records = [
    record(
      "2026-09-28",
      { HOME_CARE_NURSE: { systolic: 134, diastolic: 82, temperature: 36.6 } },
      "DRAFT",
    ),
    record("2026-09-21", {
      HOME_CARE_NURSE: { systolic: 130, temperature: 36.2, weightChange: -0.5 },
    }),
    record("2026-09-14", {
      LTC_NURSING: { systolic: 128, diastolic: 84, respiration: 18 },
    }),
    record("2026-09-07", { HOME_CARE_DOCTOR: { notes: "활력징후 없음" } }),
  ];

  it("오래된 → 최근, 혈압은 두 값이 다 있을 때만, 차이는 소수 자리 맞춤", () => {
    const trends = vitalTrends(records);
    assert.deepEqual(
      trends.map((trend) => trend.sign.id),
      ["bloodPressure", "temperature", "respiration", "weightChange"],
    );
    const pressure = trends[0];
    assert.deepEqual(
      pressure.points.map((point) => [point.date, point.values, point.change]),
      [
        ["2026-09-14", [128, 84], null],
        ["2026-09-28", [134, 82], [6, -2]],
      ],
    );
    assert.equal(pressure.points[1].draft, true);
    assert.deepEqual(trends[1].points.at(-1)!.change, [0.4]);
  });

  it("체중 변화는 그 자체가 변화량이라 차이를 셈하지 않는다", () => {
    const weight = vitalTrends(records).find(
      (trend) => trend.sign.id === "weightChange",
    )!;
    assert.deepEqual(
      weight.points.map((point) => point.change),
      [null],
    );
    assert.equal(formatVitalValue(weight.sign, [-0.5]), "감 0.5 kg");
    assert.equal(formatVitalValue(weight.sign, [0]), "변화 없음");
  });

  it("확정한 이번 방문은 마지막 점(current)으로 더한다", () => {
    const current = record("2026-10-03", {
      HOME_CARE_NURSE: { systolic: 120, diastolic: 80 },
    });
    const pressure = vitalTrends(records, current)[0];
    const last = pressure.points.at(-1)!;
    assert.equal(last.current, true);
    assert.deepEqual(last.change, [-14, -2]);
  });

  it("요약: 가장 최근에 잰 날의 값과 이번 방문을 뺀 측정 기록 수", () => {
    const summary = vitalSummary(vitalTrends(records))!;
    assert.equal(summary.date, "2026-09-28");
    assert.equal(summary.current, false);
    assert.deepEqual(
      summary.latest.map(({ sign }) => sign.id),
      ["bloodPressure", "temperature"],
    );
    assert.equal(summary.measured, 3);

    const current = record("2026-10-03", { LTC_NURSING: { pulse: 80 } });
    const withCurrent = vitalSummary(vitalTrends(records, current))!;
    assert.equal(withCurrent.current, true);
    assert.deepEqual(
      withCurrent.latest.map(({ sign }) => sign.id),
      ["pulse"],
    );
    assert.equal(withCurrent.measured, 3);
    assert.equal(vitalSummary([]), null);
  });

  it("표시 글", () => {
    const pressure = vitalTrends(records)[0];
    assert.equal(formatVitalValue(pressure.sign, [134, 82]), "134/82 mmHg");
    assert.equal(formatVitalChange([6, -2]), "↑6 / ↓2");
    assert.equal(formatVitalChange([0, 0]), "변화 없음");
    assert.equal(formatVitalChange(null), null);
    assert.equal(
      vitalChangeLabel(pressure.sign, [6, 0]),
      "지난번보다 수축기 혈압 6 mmHg 높음, 이완기 혈압 같음",
    );
  });
});
