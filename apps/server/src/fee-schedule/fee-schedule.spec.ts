import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CreateHomeCareFeeScheduleSchema,
  DEFAULT_HOME_CARE_FEE_SET,
  HOME_CARE_FEE_FIELDS,
  HomeCareFeesSchema,
  parseStoredFees,
  scheduleForMonth,
  visitFeeFor,
  type HomeCareFees,
} from "@repo/shared-types";

const FEES = DEFAULT_HOME_CARE_FEE_SET.fees;

describe("수가 묶음", () => {
  it("코드 기본값은 검사를 통과하고, 화면 칸은 모든 값을 한 번씩 다룬다", () => {
    assert.equal(HomeCareFeesSchema.safeParse(FEES).success, true);
    assert.deepEqual(
      HOME_CARE_FEE_FIELDS.map((field) => field.key).sort(),
      Object.keys(FEES).sort(),
    );
  });

  it("저장한 묶음에 없는 칸은 기본값으로 채우고, 형식이 틀리면 null", () => {
    const withoutBase: Partial<HomeCareFees> = { ...FEES };
    delete withoutBase.baseFee;
    assert.equal(parseStoredFees(withoutBase)?.baseFee, FEES.baseFee);
    assert.equal(
      parseStoredFees({ ...FEES, baseFee: 150_000 })?.baseFee,
      150_000,
    );
    assert.equal(parseStoredFees({ ...FEES, baseFee: "많이" }), null);
    assert.equal(parseStoredFees(null), null);
  });

  it("입력 검사: 비율은 0~1, 금액은 정수, 근거는 꼭", () => {
    const valid = {
      effectiveMonth: "2027-01",
      fees: FEES,
      source: "재택의료센터 지침 2027.1판 19쪽",
    };
    assert.equal(
      CreateHomeCareFeeScheduleSchema.safeParse(valid).success,
      true,
    );
    for (const broken of [
      { ...valid, fees: { ...FEES, deathFeePercent: 150 } },
      { ...valid, fees: { ...FEES, baseFee: 140_000.5 } },
      { ...valid, fees: { ...FEES, extraNursingMax: 0 } },
      { ...valid, source: "  " },
      { ...valid, effectiveMonth: "2027-13" },
    ]) {
      assert.equal(
        CreateHomeCareFeeScheduleSchema.safeParse(broken).success,
        false,
        JSON.stringify(broken).slice(0, 80),
      );
    }
  });

  it("그달 묶음: 지우지 않은 것 중 시행 월이 그달 이하인 가장 늦은 것", () => {
    const schedules = [
      { id: "a", effectiveMonth: "2026-02", deletedAt: null },
      { id: "b", effectiveMonth: "2027-01", deletedAt: null },
      { id: "c", effectiveMonth: "2026-10", deletedAt: "2026-10-02T00:00:00Z" },
    ];
    assert.equal(scheduleForMonth(schedules, "2026-01"), null);
    assert.equal(scheduleForMonth(schedules, "2026-02")?.id, "a");
    assert.equal(scheduleForMonth(schedules, "2026-12")?.id, "a");
    assert.equal(scheduleForMonth(schedules, "2027-03")?.id, "b");
  });

  it("방문진료료 단가는 기관 종별로", () => {
    assert.equal(visitFeeFor(FEES, "CLINIC"), FEES.visitFeeClinic);
    assert.equal(visitFeeFor(FEES, "PUBLIC_HEALTH"), FEES.visitFeeClinic);
    assert.equal(visitFeeFor(FEES, "HOSPITAL"), FEES.visitFeeHospital);
  });
});
