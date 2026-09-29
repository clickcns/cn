import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMonths,
  addMonthsToDate,
  countVisitsByDay,
  daysBetween,
  formatDateLabel,
  formatMonthLabel,
  isIsoMonth,
  monthGridDates,
  shiftCalendarDate,
  summarizeCalendarMonth,
  summarizeMonthRecipients,
  VisitCalendarQuerySchema,
  withKstDate,
  type VisitCalendarItem,
} from "@repo/shared-types";

describe("countVisitsByDay", () => {
  it("한국 날짜로 묶어 상태별로 센다(자정 직후 방문은 그날로)", () => {
    const days = countVisitsByDay([
      // 2026-09-24 00:30 KST = 2026-09-23 15:30 UTC
      { scheduledAt: new Date("2026-09-23T15:30:00Z"), status: "SCHEDULED" },
      // 2026-09-23 23:50 KST
      { scheduledAt: new Date("2026-09-23T14:50:00Z"), status: "CONFIRMED" },
      { scheduledAt: new Date("2026-09-24T01:00:00Z"), status: "DRAFT" },
    ]);
    assert.deepEqual(days, [
      {
        date: "2026-09-23",
        counts: { SCHEDULED: 0, DRAFT: 0, CONFIRMED: 1 },
        total: 1,
      },
      {
        date: "2026-09-24",
        counts: { SCHEDULED: 1, DRAFT: 1, CONFIRMED: 0 },
        total: 2,
      },
    ]);
  });

  it("방문이 없으면 빈 목록이다", () => {
    assert.deepEqual(countVisitsByDay([]), []);
  });
});

describe("summarizeCalendarMonth", () => {
  const days = countVisitsByDay([
    // 앞 달 칸(8월 31일) 미확정 1건: 이달 건수에는 빼고 지난 미확정에는 센다
    { scheduledAt: "2026-08-31T01:00:00Z", status: "SCHEDULED" },
    { scheduledAt: "2026-09-02T01:00:00Z", status: "DRAFT" },
    { scheduledAt: "2026-09-02T02:00:00Z", status: "CONFIRMED" },
    // 오늘(9월 10일) 이후 미확정은 지난 미확정이 아니다
    { scheduledAt: "2026-09-10T01:00:00Z", status: "SCHEDULED" },
  ]);

  it("이달 건수와 달력 칸의 지난 미확정·가장 이른 날을 센다", () => {
    assert.deepEqual(summarizeCalendarMonth(days, "2026-09", "2026-09-10"), {
      counts: { SCHEDULED: 1, DRAFT: 1, CONFIRMED: 1 },
      total: 3,
      overdue: 2,
      firstOverdue: "2026-08-31",
    });
  });

  it("방문이 없으면 0이다", () => {
    assert.deepEqual(summarizeCalendarMonth([], "2026-09", "2026-09-10"), {
      counts: { SCHEDULED: 0, DRAFT: 0, CONFIRMED: 0 },
      total: 0,
      overdue: 0,
      firstOverdue: null,
    });
  });
});

describe("날짜 이름표", () => {
  it("날짜와 달을 한국어로 적는다", () => {
    assert.equal(formatDateLabel("2026-09-22"), "9월 22일 (화)");
    assert.equal(formatMonthLabel("2026-09"), "2026년 9월");
  });
});

describe("달력 날짜", () => {
  it("일요일에 시작해 토요일에 끝나는 주 단위로 채운다", () => {
    // 2026년 9월 1일은 화요일, 30일은 수요일
    const dates = monthGridDates("2026-09");
    assert.equal(dates[0], "2026-08-30");
    assert.equal(dates.at(-1), "2026-10-03");
    assert.equal(dates.length, 35);
  });

  it("일요일에 시작하는 28일 달은 4주다", () => {
    // 2026년 2월 1일은 일요일
    const dates = monthGridDates("2026-02");
    assert.equal(dates[0], "2026-02-01");
    assert.equal(dates.length, 28);
  });

  it("달을 넘기고 해를 넘긴다", () => {
    assert.equal(addMonths("2026-12", 1), "2027-01");
    assert.equal(addMonths("2026-01", -1), "2025-12");
    assert.equal(addMonths("2026-09", 0), "2026-09");
    assert.equal(daysBetween("2026-09-30", "2026-10-02"), 2);
    assert.ok(isIsoMonth("2026-09"));
    assert.ok(!isIsoMonth("2026-13"));
  });
});

describe("달력 키보드·날짜 옮기기", () => {
  it("방향키는 하루·일주일, Home/End는 그 주의 일·토요일로 간다", () => {
    // 2026-09-24는 목요일
    assert.equal(shiftCalendarDate("2026-09-24", "ArrowLeft"), "2026-09-23");
    assert.equal(shiftCalendarDate("2026-09-30", "ArrowRight"), "2026-10-01");
    assert.equal(shiftCalendarDate("2026-09-24", "ArrowUp"), "2026-09-17");
    assert.equal(shiftCalendarDate("2026-09-24", "ArrowDown"), "2026-10-01");
    assert.equal(shiftCalendarDate("2026-09-24", "Home"), "2026-09-20");
    assert.equal(shiftCalendarDate("2026-09-24", "End"), "2026-09-26");
    assert.equal(shiftCalendarDate("2026-09-24", "Enter"), null);
  });

  it("PageUp/Down은 같은 날, 없으면 말일로 간다", () => {
    assert.equal(shiftCalendarDate("2026-03-31", "PageUp"), "2026-02-28");
    assert.equal(shiftCalendarDate("2026-12-15", "PageDown"), "2027-01-15");
    assert.equal(addMonthsToDate("2026-01-31", 1), "2026-02-28");
  });

  it("날짜만 바꾸고 한국 시각은 그대로 둔다", () => {
    // 2026-09-24 00:30 KST = 2026-09-23T15:30Z
    assert.equal(
      withKstDate("2026-09-23T15:30:00.000Z", "2026-10-03"),
      "2026-10-03T00:30:00+09:00",
    );
    assert.equal(
      withKstDate("2026-09-24T05:00:00+09:00", "2026-09-25"),
      "2026-09-25T05:00:00+09:00",
    );
  });
});

function calendarItem(
  overrides: Partial<VisitCalendarItem> & {
    recipient: VisitCalendarItem["recipient"];
  },
): VisitCalendarItem {
  return {
    id: crypto.randomUUID(),
    organizationId: "org",
    program: "HOME_CARE_CENTER",
    status: "SCHEDULED",
    scheduledAt: "2026-09-10T01:00:00.000Z",
    formIds: ["HOME_CARE_NURSE"],
    staff: { id: "s", name: "직원", profession: "NURSE", isActive: true },
    ...overrides,
  };
}

describe("summarizeMonthRecipients", () => {
  const kim = { id: "r1", name: "김영자", careGrade: "2" as const };
  const lee = { id: "r2", name: "이순자", careGrade: null };

  it("이달 방문만 수급자별로 세고, 재택의료는 방문의 서식으로 직종을 센다", () => {
    const summaries = summarizeMonthRecipients(
      [
        calendarItem({
          recipient: kim,
          formIds: ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
          // 담당자의 지금 직종이 바뀌어도 방문의 서식(의사)으로 센다
          staff: { id: "d", name: "의사", profession: "NURSE", isActive: true },
          status: "CONFIRMED",
          scheduledAt: "2026-09-03T01:00:00.000Z",
        }),
        calendarItem({ recipient: kim, formIds: ["HOME_CARE_NURSE"] }),
        // 다음 달 방문은 세지 않는다
        calendarItem({
          recipient: kim,
          scheduledAt: "2026-10-01T01:00:00.000Z",
        }),
        calendarItem({
          recipient: lee,
          program: "LTC_NURSING",
          formIds: ["LTC_NURSING"],
        }),
      ],
      "2026-09",
    );
    assert.equal(summaries.length, 2);
    const [first, second] = summaries;
    assert.equal(first.recipient.name, "김영자");
    assert.equal(first.total, 2);
    assert.equal(first.confirmed, 1);
    assert.equal(first.firstDate, "2026-09-03");
    assert.deepEqual(first.homeCare, {
      DOCTOR: 1,
      NURSE: 1,
      SOCIAL_WORKER: 0,
    });
    // 간호사 1회·사회복지사 1회가 모자란다
    assert.equal(first.homeCareShortfall, 2);
    assert.equal(second.homeCare, null);
    assert.equal(second.homeCareShortfall, 0);
  });

  it("달력 항목도 한국 날짜로 센다", () => {
    const days = countVisitsByDay([
      { scheduledAt: "2026-09-23T15:30:00.000Z", status: "DRAFT" },
    ]);
    assert.equal(days[0].date, "2026-09-24");
  });
});

describe("VisitCalendarQuerySchema", () => {
  it("달력 한 장(42일)까지 받는다", () => {
    assert.ok(
      VisitCalendarQuerySchema.safeParse({
        from: "2026-08-30",
        to: "2026-10-10",
      }).success,
    );
    assert.ok(
      !VisitCalendarQuerySchema.safeParse({
        from: "2026-08-30",
        to: "2026-10-11",
      }).success,
    );
  });

  it("시작일이 종료일보다 늦으면 거절한다", () => {
    assert.ok(
      !VisitCalendarQuerySchema.safeParse({
        from: "2026-09-10",
        to: "2026-09-01",
      }).success,
    );
  });
});
