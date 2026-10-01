import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOME_CARE_BASE_FEE,
  HOME_CARE_CONTINUITY_FEE,
  HOME_CARE_DOCTOR_MONTHLY_LIMIT,
  HOME_CARE_EXTRA_NURSING_FEE,
  HOME_CARE_REVENUE_FIELDS,
  HOME_CARE_VISIT_FEE,
  HomeCareMonthQuerySchema,
  homeCareFeeStatuses,
  homeCareMonthRevenue,
  homeCarePriorStreaks,
  homeCareRevenue,
  homeCareVisitFacts,
  FORMS,
  formFields,
  type FormId,
  type HomeCareMonthVisit,
  type HomeCareVisitFacts,
  type Profession,
  type VisitForms,
} from "@repo/shared-types";

const NO_FACTS: HomeCareVisitFacts = {
  visitFeeRate: null,
  nurseVisitType: null,
  withDoctor: false,
  minutes: null,
  scheduleOnly: false,
};

/** 2026년 10월 day일 재택의료 방문 한 건(사실은 overrides로). */
function visit(
  recipientId: string,
  profession: Profession,
  day: number,
  facts: Partial<HomeCareVisitFacts> = {},
  staff = { id: "s", name: "직원" },
): HomeCareMonthVisit {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  return {
    id: crypto.randomUUID(),
    organizationId: "org",
    program: "HOME_CARE_CENTER",
    status: "CONFIRMED",
    scheduledAt: new Date(`${date}T10:00:00+09:00`).toISOString(),
    profession,
    formIds: [],
    recipient: { id: recipientId, name: recipientId, careGrade: "1" },
    staff: { ...staff, profession, isActive: true },
    facts: { ...NO_FACTS, ...facts },
  };
}

const nurse = (
  type: HomeCareVisitFacts["nurseVisitType"],
  facts: Partial<HomeCareVisitFacts> = {},
) => visit("r", "NURSE", 1, { nurseVisitType: type, minutes: 40, ...facts });

const SECURED = "SECURED";
const SHORT = "SHORT";

describe("HOME_CARE_REVENUE_FIELDS", () => {
  it("금액 셈이 읽는 칸·선택지가 서식 정의에 있다", () => {
    for (const { formId, key, values } of Object.values(
      HOME_CARE_REVENUE_FIELDS,
    )) {
      const field = formFields(FORMS[formId]).find(
        (candidate) => candidate.key === key,
      );
      assert.ok(
        field && (field.type === "single" || field.type === "multi"),
        `${formId}.${key}`,
      );
      for (const value of values) {
        assert.ok(
          field.options.some((option) => option.value === value),
          `${formId}.${key}.${value}`,
        );
      }
    }
  });
});

describe("homeCareVisitFacts", () => {
  const facts = (
    profession: Profession,
    formIds: FormId[],
    forms: VisitForms,
    times: { startedAt: string | null; endedAt: string | null } = {
      startedAt: null,
      endedAt: null,
    },
  ) => homeCareVisitFacts({ profession, formIds, forms, ...times });

  it("제4호를 쓴 의사 방문만 방문진료료, 동일 건물 75%·동일 세대 50%", () => {
    assert.equal(facts("DOCTOR", ["HOME_CARE_DOCTOR"], {}).visitFeeRate, null);
    assert.equal(
      facts("DOCTOR", ["HOME_CARE_DOCTOR", "PRIMARY_CARE_CHECK"], {})
        .visitFeeRate,
      1,
    );
    const rate = (value: string) =>
      facts("DOCTOR", ["PRIMARY_CARE_CHECK"], {
        PRIMARY_CARE_CHECK: { sameBuilding: { value } },
      }).visitFeeRate;
    assert.equal(rate("NONE"), 1);
    assert.equal(rate("SAME_BUILDING"), 0.75);
    assert.equal(rate("SAME_HOUSEHOLD"), 0.5);
    // 간호사 방문에 제4호가 있을 수는 없지만 있어도 셈하지 않는다
    assert.equal(facts("NURSE", ["PRIMARY_CARE_CHECK"], {}).visitFeeRate, null);
  });

  it("제7호 방문사유·의사 동행, 방문 시간(분)", () => {
    const result = facts(
      "NURSE",
      ["HOME_CARE_NURSE"],
      {
        HOME_CARE_NURSE: {
          visitType: { value: "ADDITIONAL" },
          companion: [{ value: "SOCIAL_WORKER" }, { value: "DOCTOR" }],
        },
      },
      {
        startedAt: "2026-10-01T01:00:00.000Z",
        endedAt: "2026-10-01T01:25:00.000Z",
      },
    );
    // 종료가 시작보다 앞서면(잘못 적음) 시간을 모르는 것으로 본다
    assert.equal(
      facts(
        "NURSE",
        [],
        {},
        {
          startedAt: "2026-10-01T02:00:00.000Z",
          endedAt: "2026-10-01T01:00:00.000Z",
        },
      ).minutes,
      null,
    );
    assert.equal(result.nurseVisitType, "ADDITIONAL");
    assert.equal(result.withDoctor, true);
    assert.equal(result.minutes, 25);
    const empty = facts("NURSE", ["HOME_CARE_NURSE"], {});
    assert.equal(empty.nurseVisitType, null);
    assert.equal(empty.withDoctor, false);
    assert.equal(empty.minutes, null);
  });

  it("제8호 상담 내용이 방문일정 조율뿐이면 scheduleOnly(비었으면 아님)", () => {
    const social = (content: string[]) =>
      facts("SOCIAL_WORKER", ["HOME_CARE_SOCIAL"], {
        HOME_CARE_SOCIAL: { content: content.map((value) => ({ value })) },
      }).scheduleOnly;
    assert.equal(social(["SCHEDULE"]), true);
    assert.equal(social(["SCHEDULE", "ENVIRONMENT"]), false);
    assert.equal(social([]), false);
  });
});

describe("homeCareRevenue", () => {
  it("기본료는 방문 부족이면 0, 방문진료료는 비율대로", () => {
    const visits = [
      visit("r", "DOCTOR", 1, { visitFeeRate: 1 }),
      visit("r", "DOCTOR", 8, { visitFeeRate: 0.75 }),
      visit("r", "DOCTOR", 9),
    ];
    const secured = homeCareRevenue(SECURED, visits, 0);
    assert.deepEqual(secured.parts.base, {
      count: 1,
      amount: HOME_CARE_BASE_FEE,
    });
    assert.deepEqual(secured.parts.visitFee, {
      count: 2,
      amount: HOME_CARE_VISIT_FEE + Math.round(HOME_CARE_VISIT_FEE * 0.75),
    });
    assert.equal(
      secured.total,
      HOME_CARE_BASE_FEE + secured.parts.visitFee.amount,
    );
    const short = homeCareRevenue(SHORT, visits, 0);
    assert.deepEqual(short.parts.base, { count: 0, amount: 0 });
    assert.equal(short.total, secured.parts.visitFee.amount);
  });

  it("추가간호료: 기본 2회를 넘는 방문 중 정기가 아니고 30분 이상·의사 동행 아닌 방문, 월 3회까지", () => {
    const extra = (visits: HomeCareMonthVisit[]) =>
      homeCareRevenue(SECURED, visits, 0).parts.extraNursing;
    // 2회뿐이면 추가 방문으로 적어도 기본 방문이다
    assert.equal(extra([nurse("REGULAR"), nurse("ADDITIONAL")]).count, 0);
    assert.deepEqual(
      extra([nurse("REGULAR"), nurse("REGULAR"), nurse("ADDITIONAL")]),
      { count: 1, amount: HOME_CARE_EXTRA_NURSING_FEE },
    );
    // 아직 적지 않은 방문(예정)은 추가로 적을 수 있는 방문으로 본다
    assert.equal(
      extra([nurse("REGULAR"), nurse("REGULAR"), nurse(null)]).count,
      1,
    );
    // 월 3회까지
    assert.equal(
      extra([
        nurse("REGULAR"),
        nurse("REGULAR"),
        ...Array.from({ length: 5 }, () => nurse("ADDITIONAL")),
      ]).count,
      3,
    );
    // 의사 동행·30분 미만은 빼고, 시각을 적지 않은 방문은 뺄 근거가 없어 넣는다
    assert.equal(
      extra([
        nurse("REGULAR"),
        nurse("REGULAR"),
        nurse("ADDITIONAL", { withDoctor: true }),
        nurse("ADDITIONAL", { minutes: 29 }),
        nurse("ADDITIONAL", { minutes: null }),
      ]).count,
      1,
    );
  });

  it("추가간호료를 놓치는 까닭을 알린다", () => {
    const { issues } = homeCareRevenue(
      SECURED,
      [
        nurse("REGULAR"),
        nurse("REGULAR"),
        nurse("REGULAR"),
        nurse("ADDITIONAL", { withDoctor: true }),
        nurse("ADDITIONAL", { minutes: 20 }),
      ],
      0,
    );
    assert.equal(issues.length, 3);
    assert.match(issues[0], /정기 방문이 3회/);
    assert.match(issues[1], /의사와 동행한 추가 방문 1건/);
    assert.match(issues[2], /30분이 안 된 추가 방문 1건/);
    const over = homeCareRevenue(
      SECURED,
      [
        nurse("REGULAR"),
        nurse("REGULAR"),
        ...Array.from({ length: 4 }, () => nurse("ADDITIONAL")),
      ],
      0,
    ).issues;
    assert.deepEqual(over.length, 1);
    assert.match(over[0], /월 3회까지라 1건/);
  });

  it("사회복지사 상담이 모두 방문일정 조율뿐일 때만 알린다", () => {
    const social = (...scheduleOnly: boolean[]) =>
      homeCareRevenue(
        SECURED,
        scheduleOnly.map((only, index) =>
          visit("r", "SOCIAL_WORKER", index + 1, { scheduleOnly: only }),
        ),
        0,
      ).issues;
    assert.equal(social(true).length, 1);
    assert.equal(social(true, false).length, 0);
    assert.equal(social().length, 0);
  });

  it("지속관리료: 연속 6의 배수 달에 받고, 방문 부족이면 연속이 끊긴다고 알린다", () => {
    const five = homeCareRevenue(SECURED, [], 5);
    assert.equal(five.streak, 6);
    assert.deepEqual(five.parts.continuity, {
      count: 1,
      amount: HOME_CARE_CONTINUITY_FEE,
    });
    assert.equal(homeCareRevenue(SECURED, [], 6).parts.continuity.count, 0);
    assert.equal(homeCareRevenue(SECURED, [], 11).parts.continuity.count, 1);
    const broken = homeCareRevenue(SHORT, [], 5);
    assert.equal(broken.streak, 0);
    assert.equal(broken.parts.continuity.count, 0);
    assert.match(broken.issues[0], /5개월 이어 온 연속이 끊깁니다/);
    assert.equal(homeCareRevenue(SHORT, [], 0).issues.length, 0);
  });
});

describe("homeCarePriorStreaks", () => {
  /** 그달(YYYY-MM) day일에 의사 1·간호사 nurses·사회복지사 1회 */
  const counts = (recipientId: string, month: string, nurses = 2, day = 5) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return [
      { recipientId, date, profession: "DOCTOR" as const, count: 1 },
      { recipientId, date, profession: "NURSE" as const, count: nurses },
      { recipientId, date, profession: "SOCIAL_WORKER" as const, count: 1 },
    ];
  };

  it("직전 달부터 요건을 채운 달이 이어지는 만큼, 0이면 뺀다", () => {
    assert.deepEqual(
      homeCarePriorStreaks(
        [
          ...counts("a", "2026-09"),
          ...counts("a", "2026-08"),
          ...counts("a", "2026-06"), // 7월이 비어 끊긴다
          ...counts("b", "2026-09", 1), // 간호사 1회라 요건 못 채움
          ...counts("b", "2026-08"),
          ...counts("c", "2026-08"), // 직전 달(9월)이 없다
          ...counts("d", "2025-12"),
          ...counts("d", "2026-01"),
        ],
        "2026-10",
      ),
      { a: 2 },
    );
    // 해를 넘어 센다
    assert.deepEqual(
      homeCarePriorStreaks(
        [...counts("d", "2025-12"), ...counts("d", "2025-11")],
        "2026-01",
      ),
      { d: 2 },
    );
  });

  it("같은 달의 여러 날을 달로 묶어 더한다", () => {
    assert.deepEqual(
      homeCarePriorStreaks(
        [
          ...counts("a", "2026-09", 1, 3),
          {
            recipientId: "a",
            date: "2026-09-30",
            profession: "NURSE",
            count: 1,
          },
        ],
        "2026-10",
      ),
      { a: 1 },
    );
  });
});

describe("homeCareMonthRevenue", () => {
  const homeCare = (id: string) => ({
    id,
    programs: ["HOME_CARE_CENTER"] as const,
  });

  it("수급자마다 셈하고 항목별 건수·금액과 총액을 합한다", () => {
    const visits = [
      visit("a", "DOCTOR", 1, { visitFeeRate: 1 }),
      visit("a", "NURSE", 2),
      visit("a", "NURSE", 3),
      visit("a", "SOCIAL_WORKER", 4),
      visit("b", "DOCTOR", 5, { visitFeeRate: 0.5 }),
    ];
    const statuses = homeCareFeeStatuses(
      [homeCare("a"), homeCare("b")],
      visits,
      "2026-10",
      "2026-10-01",
    );
    const { byRecipient, totals, warnings } = homeCareMonthRevenue(
      statuses,
      visits,
      { a: 5 },
    );
    assert.equal(byRecipient.get("a")?.parts.continuity.count, 1);
    assert.equal(byRecipient.get("b")?.parts.base.count, 0);
    assert.deepEqual(totals.parts.base, {
      count: 1,
      amount: HOME_CARE_BASE_FEE,
    });
    assert.deepEqual(totals.parts.visitFee, {
      count: 2,
      amount: HOME_CARE_VISIT_FEE + Math.round(HOME_CARE_VISIT_FEE * 0.5),
    });
    assert.equal(
      totals.total,
      HOME_CARE_BASE_FEE +
        totals.parts.visitFee.amount +
        HOME_CARE_CONTINUITY_FEE,
    );
    assert.deepEqual(warnings, []);
  });

  it("의사 1인당 수급자 140명·방문진료료 140회를 넘으면 알린다", () => {
    const doctor = { id: "d", name: "김의사" };
    const visits = Array.from(
      { length: HOME_CARE_DOCTOR_MONTHLY_LIMIT + 1 },
      (_, index) =>
        visit(`r${index}`, "DOCTOR", 1, { visitFeeRate: 1 }, doctor),
    );
    const { warnings } = homeCareMonthRevenue([], visits, {});
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /김의사 의사의 이달 수급자가 141명/);
    assert.match(warnings[1], /방문진료료 청구가 141회/);
  });
});

describe("HomeCareMonthQuerySchema", () => {
  it("달은 YYYY-MM", () => {
    assert.equal(
      HomeCareMonthQuerySchema.safeParse({ month: "2026-10" }).success,
      true,
    );
    assert.equal(
      HomeCareMonthQuerySchema.safeParse({ month: "2026-13" }).success,
      false,
    );
    assert.equal(HomeCareMonthQuerySchema.safeParse({}).success, false);
  });
});
