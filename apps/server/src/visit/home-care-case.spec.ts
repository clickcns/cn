import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_HOME_CARE_FEE_SET,
  assessmentOrderError,
  ExternalServiceSchema,
  externalConflicts,
  externalServiceOn,
  homeCareFeeStatuses,
  homeCareMonthPeriod,
  homeCareMonthRevenue,
  homeCarePriorStreaks,
  reassessmentWindow,
  SetHomeCareEndSchema,
  type ExternalServiceSchedule,
  type HomeCareAssessmentFact,
  type HomeCareCaseFacts,
  type HomeCareMonthVisit,
  type Profession,
  type VisitStatus,
} from "@repo/shared-types";

const FEES = DEFAULT_HOME_CARE_FEE_SET.fees;

const MONTH = "2026-10";
const TODAY = "2026-10-20";

const initial = (assessedOn: string): HomeCareAssessmentFact => ({
  assessedOn,
  kind: "INITIAL",
});
const reassess = (assessedOn: string): HomeCareAssessmentFact => ({
  assessedOn,
  kind: "REASSESS",
});

/** 10월 day일 time(한국 시간) 재택의료 방문 한 건. */
function visit(
  recipientId: string,
  profession: Profession,
  day: number,
  status: VisitStatus = "CONFIRMED",
  { time = "10:00", until }: { time?: string; until?: string } = {},
): HomeCareMonthVisit {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  const scheduledAt = new Date(`${date}T${time}:00+09:00`).toISOString();
  return {
    id: crypto.randomUUID(),
    organizationId: "org",
    program: "HOME_CARE_CENTER",
    status,
    scheduledAt,
    profession,
    formIds: [],
    recipient: { id: recipientId, name: recipientId, careGrade: "1" },
    staff: { id: "s", name: "직원", profession, isActive: true },
    startedAt: until ? scheduledAt : null,
    endedAt: until ? new Date(`${date}T${until}:00+09:00`).toISOString() : null,
    facts: {
      visitFeeBasis: null,
      nurseVisitType: null,
      withDoctor: false,
      minutes: null,
      scheduleOnly: false,
    },
  };
}

/** 요건을 채우는 한 달 방문(의사 1·간호사 2·사회복지사 1). */
const fullMonth = (recipientId: string, firstDay = 10) => [
  visit(recipientId, "DOCTOR", firstDay),
  visit(recipientId, "NURSE", firstDay + 1),
  visit(recipientId, "NURSE", firstDay + 2),
  visit(recipientId, "SOCIAL_WORKER", firstDay + 3),
];

/** 사례 정보(빈 곳은 기록 없음). */
const caseFacts = (
  facts: Partial<HomeCareCaseFacts> = {},
): HomeCareCaseFacts => ({
  assessments: [],
  homeCareEndedOn: null,
  homeCareEndReason: null,
  externalServices: [],
  ...facts,
});

const recipient = (id: string, facts: Partial<HomeCareCaseFacts> = {}) => ({
  id,
  programs: ["HOME_CARE_CENTER"] as const,
  institutionType: "CLINIC" as const,
  ...caseFacts(facts),
});

const service = (
  fields: Partial<ExternalServiceSchedule> &
    Pick<ExternalServiceSchedule, "kind">,
): ExternalServiceSchedule => ({
  provider: null,
  weekdays: [],
  startsOn: null,
  endsOn: null,
  startTime: null,
  endTime: null,
  ...fields,
});

describe("포괄평가", () => {
  it("재평가 기간: 평가한 달의 12개월 뒤 1일 ~ 13개월 뒤 말일(지침 예시)", () => {
    assert.deepEqual(reassessmentWindow("2026-01-11"), {
      from: "2027-01-01",
      deadline: "2027-02-28",
    });
    assert.deepEqual(reassessmentWindow("2026-07-10"), {
      from: "2027-07-01",
      deadline: "2027-08-31",
    });
  });

  it("재평가는 처음 최초 평가보다 뒤, 다시 등록하면 최초 평가를 또 적는다", () => {
    assert.equal(assessmentOrderError([], initial("2026-01-11")), null);
    assert.equal(
      assessmentOrderError([initial("2026-01-11")], initial("2027-03-01")),
      null,
    );
    assert.equal(
      assessmentOrderError([reassess("2026-01-11")], reassess("2025-12-01")),
      null,
    );
    assert.match(
      assessmentOrderError([initial("2026-03-01")], reassess("2026-01-01"))!,
      /뒤의 날/,
    );
    assert.equal(
      assessmentOrderError([initial("2026-01-11")], reassess("2026-07-10")),
      null,
    );
  });
});

describe("homeCareMonthPeriod", () => {
  it("기록이 없으면 달 전체를 세고 막지 않는다", () => {
    const period = homeCareMonthPeriod(caseFacts(), MONTH);
    assert.equal(period.assessment, null);
    assert.equal(period.block, null);
    assert.deepEqual([period.from, period.to], ["2026-10-01", "2026-10-31"]);
  });

  it("달 중간 최초 평가는 평가일부터(지침 Q2-2), 그 전 달은 막힘", () => {
    const facts = caseFacts({ assessments: [initial("2026-10-15")] });
    assert.equal(homeCareMonthPeriod(facts, MONTH).from, "2026-10-15");
    assert.equal(homeCareMonthPeriod(facts, "2026-11").from, "2026-11-01");
    assert.equal(
      homeCareMonthPeriod(facts, "2026-09").block,
      "BEFORE_ASSESSMENT",
    );
  });

  it("재평가 기한이 지나면 막고, 다시 평가한 달은 평가일부터 센다", () => {
    const lapsed = caseFacts({ assessments: [initial("2025-07-10")] });
    // 재평가 기간 2026-07-01 ~ 08-31
    assert.equal(homeCareMonthPeriod(lapsed, "2026-08").block, null);
    assert.equal(homeCareMonthPeriod(lapsed, "2026-09").block, "LAPSED");
    const reassessed = caseFacts({
      assessments: [initial("2025-07-10"), reassess("2026-10-05")],
    });
    const period = homeCareMonthPeriod(reassessed, MONTH);
    assert.equal(period.block, null);
    assert.equal(period.from, "2026-10-05");
    // 기한 안의 재평가는 달 전체
    const onTime = caseFacts({
      assessments: [initial("2025-10-01"), reassess("2026-10-05")],
    });
    assert.equal(homeCareMonthPeriod(onTime, MONTH).from, "2026-10-01");
  });

  it("종결한 달은 종결일까지, 사유와 함께", () => {
    const period = homeCareMonthPeriod(
      caseFacts({ homeCareEndedOn: "2026-10-12", homeCareEndReason: "DEATH" }),
      MONTH,
    );
    assert.equal(period.to, "2026-10-12");
    assert.deepEqual(period.ended, { on: "2026-10-12", reason: "DEATH" });
  });
});

describe("다른 기관 서비스", () => {
  it("기간·요일로 그날 이용하는지", () => {
    const tueFri = service({
      kind: "LTC_NURSING",
      weekdays: [2, 5],
      startsOn: "2026-10-01",
      endsOn: "2026-10-31",
    });
    assert.equal(externalServiceOn(tueFri, "2026-10-13"), true); // 화
    assert.equal(externalServiceOn(tueFri, "2026-10-14"), false); // 수
    assert.equal(externalServiceOn(tueFri, "2026-11-03"), false); // 기간 밖
    assert.equal(
      externalServiceOn(service({ kind: "SHORT_STAY" }), "2026-10-14"),
      true,
    );
  });

  it("직종이 맞을 때만, 시간이 겹칠 때만 해당하는 서비스는 시각으로 가린다", () => {
    const nursing = service({ kind: "LTC_NURSING" });
    assert.equal(
      externalConflicts(visit("r", "DOCTOR", 13), [nursing]).length,
      0,
    );
    assert.deepEqual(
      externalConflicts(visit("r", "NURSE", 13), [nursing]).map(
        (conflict) => conflict.certain,
      ),
      [true],
    );
    const dayCare = service({
      kind: "DAY_CARE",
      startTime: "09:00",
      endTime: "17:00",
    });
    // 예정 시각 하나: 이용 시간 안이면 겹침
    assert.equal(
      externalConflicts(visit("r", "DOCTOR", 13, "SCHEDULED"), [dayCare])
        .length,
      1,
    );
    assert.equal(
      externalConflicts(
        visit("r", "DOCTOR", 13, "SCHEDULED", { time: "17:30" }),
        [dayCare],
      ).length,
      0,
    );
    // 기록한 시작~종료가 이용 시간에 걸치면 겹침
    assert.equal(
      externalConflicts(
        visit("r", "DOCTOR", 13, "CONFIRMED", {
          time: "08:30",
          until: "09:10",
        }),
        [dayCare],
      ).length,
      1,
    );
    // 이용 시간을 모르면 "겹칠 수도"
    assert.deepEqual(
      externalConflicts(visit("r", "NURSE", 13), [
        service({ kind: "BATH" }),
      ]).map((conflict) => conflict.certain),
      [false],
    );
  });

  it("입력 검사: 기간·시간 순서, 시간은 함께, 요일은 정리", () => {
    const parsed = ExternalServiceSchema.parse({
      kind: "DAY_CARE",
      weekdays: [5, 1, 1],
      startTime: "09:00",
      endTime: "17:00",
      provider: " ",
    });
    assert.deepEqual(parsed.weekdays, [1, 5]);
    assert.equal(parsed.provider, null);
    assert.equal(
      ExternalServiceSchema.safeParse({
        kind: "DAY_CARE",
        startsOn: "2026-10-10",
        endsOn: "2026-10-01",
      }).success,
      false,
    );
    assert.equal(
      ExternalServiceSchema.safeParse({ kind: "BATH", startTime: "09:00" })
        .success,
      false,
    );
    assert.equal(
      ExternalServiceSchema.safeParse({
        kind: "BATH",
        startTime: "10:00",
        endTime: "09:00",
      }).success,
      false,
    );
  });

  it("종결은 날짜·사유를 함께", () => {
    assert.equal(
      SetHomeCareEndSchema.safeParse({ endedOn: null, reason: null }).success,
      true,
    );
    assert.equal(
      SetHomeCareEndSchema.safeParse({ endedOn: "2026-10-12", reason: null })
        .success,
      false,
    );
  });
});

describe("판정과 예상 수입에 반영", () => {
  it("포괄평가 전 방문과 다른 기관 서비스와 같은 날 방문은 기본료 횟수에서 뺀다", () => {
    const visits = [
      visit("a", "NURSE", 3), // 평가 전
      ...fullMonth("a"),
      visit("a", "NURSE", 13), // 같은 날 다른 기관 방문간호
    ];
    const [status] = homeCareFeeStatuses(
      [
        recipient("a", {
          assessments: [initial("2026-10-05")],
          externalServices: [
            service({
              kind: "LTC_NURSING",
              provider: "○○방문간호",
              startsOn: "2026-10-13",
              endsOn: "2026-10-13",
            }),
          ],
        }),
      ],
      visits,
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(status.verdict, "SECURED");
    assert.equal(status.tallies.NURSE.confirmed, 2);
    assert.equal(status.countedVisitIds.size, 4);
    assert.ok(status.notes.some((note) => note.includes("○○방문간호")));
    assert.ok(status.notes.some((note) => note.includes("전 방문 1건")));
  });

  it("방문을 빼서 모자라면 방문 부족", () => {
    const [status] = homeCareFeeStatuses(
      [
        recipient("a", {
          externalServices: [service({ kind: "LTC_NURSING", weekdays: [1] })],
        }),
      ],
      // 10/12(월)·10/19(월) 간호사 방문은 모두 월요일 방문간호와 겹친다
      [
        visit("a", "DOCTOR", 10),
        visit("a", "NURSE", 12),
        visit("a", "NURSE", 19),
        visit("a", "SOCIAL_WORKER", 13),
      ],
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(status.verdict, "SHORT");
    assert.equal(status.missing.NURSE, 2);
  });

  it("재평가 기한이 지나면 포괄평가 필요: 장기요양 급여 없이 방문진료료만", () => {
    const visits = [...fullMonth("a"), visit("a", "NURSE", 15)];
    visits[0].facts.visitFeeBasis = "FULL";
    const statuses = homeCareFeeStatuses(
      [recipient("a", { assessments: [initial("2025-07-10")] })],
      visits,
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(statuses[0].verdict, "BLOCKED");
    const { totals, byRecipient } = homeCareMonthRevenue(
      statuses,
      visits,
      {
        a: 5,
      },
      FEES,
    );
    assert.equal(totals.total, FEES.visitFeeClinic);
    assert.equal(totals.parts.extraNursing.amount, 0);
    assert.match(byRecipient.get("a")!.issues.at(-1)!, /연속이 끊깁니다/);
  });

  it("방문한 뒤 사망해 요건을 못 채우면 기본료 50%, 지속관리료는 없다", () => {
    const facts = {
      homeCareEndedOn: "2026-10-12",
      homeCareEndReason: "DEATH" as const,
    };
    const visits = [visit("a", "DOCTOR", 5), visit("a", "NURSE", 20)];
    const [status] = homeCareFeeStatuses(
      [recipient("a", facts)],
      visits,
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(status.verdict, "SECURED");
    assert.equal(status.fee, (FEES.baseFee * FEES.deathFeePercent) / 100);
    assert.equal(status.missing.NURSE, 0);
    assert.ok(status.notes.some((note) => note.includes("뒤 방문 1건")));
    const { totals } = homeCareMonthRevenue([status], visits, { a: 5 }, FEES);
    assert.equal(totals.parts.base.amount, status.fee);
    assert.equal(totals.parts.continuity.amount, 0);
    // 방문 없이 사망하면 0원(방문 부족)
    const [none] = homeCareFeeStatuses(
      [recipient("a", facts)],
      [],
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(none.verdict, "SHORT");
    // 사망 전에 요건을 채웠으면 그대로 받는다
    const [full] = homeCareFeeStatuses(
      [recipient("a", { ...facts, homeCareEndedOn: "2026-10-25" })],
      fullMonth("a"),
      MONTH,
      TODAY,
      FEES,
    );
    assert.equal(full.fee, FEES.baseFee);
  });

  it("재평가 기간이면 알린다", () => {
    const [status] = homeCareFeeStatuses(
      [recipient("a", { assessments: [initial("2025-09-20")] })],
      fullMonth("a"),
      MONTH,
      TODAY,
      FEES,
    );
    // 재평가 기간 2026-09-01 ~ 10-31
    assert.ok(status.notes.some((note) => note.includes("재평가 기간")));
  });
});

describe("homeCarePriorStreaks + 사례 정보", () => {
  const counts = (recipientId: string, month: string, day = 10) =>
    (["DOCTOR", "NURSE", "NURSE", "SOCIAL_WORKER"] as const).map(
      (profession, index) => ({
        recipientId,
        date: `${month}-${String(day + index).padStart(2, "0")}`,
        profession,
        count: 1,
      }),
    );

  it("최초 평가 전 달·기한이 지난 달은 채우지 못한 달이다", () => {
    const rows = [
      ...counts("a", "2026-09"),
      ...counts("a", "2026-08"),
      ...counts("a", "2026-07"),
    ];
    assert.deepEqual(
      homeCarePriorStreaks(rows, MONTH, new Map([["a", caseFacts()]])),
      { a: 3 },
    );
    assert.deepEqual(
      homeCarePriorStreaks(
        rows,
        MONTH,
        new Map([["a", caseFacts({ assessments: [initial("2026-08-01")] })]]),
      ),
      { a: 2 },
    );
    // 9월 15일 최초 평가: 9월 10~13일 방문은 평가 전이라 9월은 못 채움
    assert.deepEqual(
      homeCarePriorStreaks(
        rows,
        MONTH,
        new Map([["a", caseFacts({ assessments: [initial("2026-09-15")] })]]),
      ),
      {},
    );
  });

  it("같은 날 다른 기관 방문간호가 있던 간호사 방문은 지난 달에서도 세지 않는다", () => {
    const rows = counts("a", "2026-09"); // 간호사 9/11·9/12
    const nursing = service({
      kind: "LTC_NURSING",
      startsOn: "2026-09-12",
      endsOn: "2026-09-12",
    });
    assert.deepEqual(
      homeCarePriorStreaks(
        rows,
        MONTH,
        new Map([["a", caseFacts({ externalServices: [nursing] })]]),
      ),
      {},
    );
    // 이용 시간이 겹칠 때만 해당하는 서비스는 날짜만으로 빼지 않는다
    const dayCare = service({
      kind: "DAY_CARE",
      startTime: "09:00",
      endTime: "17:00",
    });
    assert.deepEqual(
      homeCarePriorStreaks(
        rows,
        MONTH,
        new Map([["a", caseFacts({ externalServices: [dayCare] })]]),
      ),
      { a: 1 },
    );
  });

  it("연속 6개월째 달에 지속관리료", () => {
    const visits = fullMonth("a");
    const statuses = homeCareFeeStatuses(
      [recipient("a", { assessments: [initial("2026-04-01")] })],
      visits,
      MONTH,
      TODAY,
      FEES,
    );
    const { totals } = homeCareMonthRevenue(statuses, visits, { a: 5 }, FEES);
    assert.equal(totals.parts.continuity.amount, FEES.continuityFee);
  });
});
