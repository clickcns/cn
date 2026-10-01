import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOME_CARE_BASE_FEE,
  homeCareClaimDeadline,
  homeCareFeeStatuses,
  homeCareFeeTotals,
  homeCarePlannedCounts,
  type Profession,
  type VisitCalendarItem,
  type VisitStatus,
} from "@repo/shared-types";

const MONTH = "2026-10";
const TODAY = "2026-10-15";

/** 2026년 10월 day일 10:00(한국 시간) 재택의료 방문 한 건. */
function visit(
  recipientId: string,
  profession: Profession,
  day: number,
  status: VisitStatus = "SCHEDULED",
  overrides: Partial<VisitCalendarItem> = {},
): VisitCalendarItem {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  return {
    id: crypto.randomUUID(),
    organizationId: "org",
    program: "HOME_CARE_CENTER",
    status,
    scheduledAt: new Date(`${date}T10:00:00+09:00`).toISOString(),
    profession,
    formIds: [],
    recipient: { id: recipientId, name: recipientId, careGrade: "1" },
    staff: { id: "s", name: "직원", profession, isActive: true },
    ...overrides,
  };
}

const homeCare = (id: string) => ({
  id,
  programs: ["HOME_CARE_CENTER"] as const,
});

describe("homeCareFeeStatuses", () => {
  it("재택의료센터 수급자만, 위험한 판정부터(같으면 모자란 방문이 많은 수급자부터) 둔다", () => {
    const statuses = homeCareFeeStatuses(
      [
        homeCare("secured"),
        homeCare("pending"),
        homeCare("none"),
        homeCare("short"),
        { id: "ltc", programs: ["LTC_NURSING"] as const },
      ],
      [
        visit("secured", "DOCTOR", 2, "CONFIRMED"),
        visit("secured", "NURSE", 3, "CONFIRMED"),
        visit("secured", "NURSE", 9, "CONFIRMED"),
        visit("secured", "SOCIAL_WORKER", 4, "CONFIRMED"),
        visit("pending", "DOCTOR", 2, "CONFIRMED"),
        visit("pending", "NURSE", 3, "CONFIRMED"),
        visit("pending", "NURSE", 10, "DRAFT"),
        visit("pending", "SOCIAL_WORKER", 20),
        visit("short", "NURSE", 5, "CONFIRMED"),
        visit("short", "DOCTOR", 25),
      ],
      MONTH,
      TODAY,
    );
    assert.deepEqual(
      statuses.map((status) => [status.recipient.id, status.verdict]),
      [
        ["none", "SHORT"],
        ["short", "SHORT"],
        ["pending", "PENDING"],
        ["secured", "SECURED"],
      ],
    );
    const [none, short, pending] = statuses;
    assert.deepEqual(none.missing, {
      DOCTOR: 1,
      NURSE: 2,
      SOCIAL_WORKER: 1,
    });
    // 의사는 예정으로 채워지고, 간호사 1회·사회복지사 1회가 모자란다.
    assert.deepEqual(short.missing, {
      DOCTOR: 0,
      NURSE: 1,
      SOCIAL_WORKER: 1,
    });
    assert.equal(short.toVisit, 1);
    // 지난 날짜의 작성 중 간호 방문은 확정할 것, 20일 상담은 마칠 것
    assert.equal(pending.toConfirm, 1);
    assert.equal(pending.toVisit, 1);
    assert.deepEqual(pending.tallies.NURSE, {
      confirmed: 1,
      unconfirmedPast: 1,
      upcoming: 0,
    });
  });

  it("그달 밖·재택의료 밖 방문은 세지 않고, 오늘 방문은 예정으로, 요건을 넘는 방문은 판정에 쓰지 않는다", () => {
    const [status] = homeCareFeeStatuses(
      [homeCare("r")],
      [
        // 10월 1일 00:30(한국 시간)은 10월이다.
        visit("r", "DOCTOR", 1, "CONFIRMED", {
          scheduledAt: "2026-09-30T15:30:00.000Z",
        }),
        // 9월 30일 23:30(한국 시간)은 9월이라 세지 않는다.
        visit("r", "NURSE", 1, "CONFIRMED", {
          scheduledAt: "2026-09-30T14:30:00.000Z",
        }),
        visit("r", "NURSE", 15, "SCHEDULED"),
        visit("r", "NURSE", 3, "SCHEDULED", { program: "LTC_NURSING" }),
        visit("r", "NURSE", 8, "CONFIRMED"),
        visit("r", "SOCIAL_WORKER", 6, "CONFIRMED"),
        visit("r", "SOCIAL_WORKER", 7, "SCHEDULED"),
      ],
      MONTH,
      TODAY,
    );
    assert.deepEqual(status.tallies, {
      DOCTOR: { confirmed: 1, unconfirmedPast: 0, upcoming: 0 },
      NURSE: { confirmed: 1, unconfirmedPast: 0, upcoming: 1 },
      SOCIAL_WORKER: { confirmed: 1, unconfirmedPast: 1, upcoming: 0 },
    });
    // 사회복지사는 확정 1회로 이미 채워서 7일 미확정은 확정할 것에 넣지 않는다.
    assert.equal(status.verdict, "PENDING");
    assert.equal(status.toConfirm, 0);
    assert.equal(status.toVisit, 1);
  });

  it("지난달은 확정하지 않은 방문이 모두 지난 미확정이다", () => {
    const [status] = homeCareFeeStatuses(
      [homeCare("r")],
      [
        visit("r", "DOCTOR", 2, "CONFIRMED"),
        visit("r", "NURSE", 3, "CONFIRMED"),
        visit("r", "NURSE", 28, "DRAFT"),
        visit("r", "SOCIAL_WORKER", 30, "SCHEDULED"),
      ],
      MONTH,
      "2026-11-03",
    );
    assert.equal(status.verdict, "PENDING");
    assert.equal(status.toConfirm, 2);
    assert.equal(status.toVisit, 0);
  });
});

describe("homeCareFeeTotals · homeCarePlannedCounts · homeCareClaimDeadline", () => {
  it("판정별 수급자 수와 기본료 합계, 직종별 전체 방문 수, 다음 달 10일 마감", () => {
    const statuses = homeCareFeeStatuses(
      [homeCare("a"), homeCare("b"), homeCare("c")],
      [
        visit("a", "DOCTOR", 2, "CONFIRMED"),
        visit("a", "NURSE", 3, "CONFIRMED"),
        visit("a", "NURSE", 4, "CONFIRMED"),
        visit("a", "SOCIAL_WORKER", 5, "CONFIRMED"),
        visit("b", "NURSE", 6, "DRAFT"),
        visit("b", "NURSE", 20),
      ],
      MONTH,
      TODAY,
    );
    assert.deepEqual(homeCareFeeTotals(statuses), {
      SHORT: { count: 2, amount: 2 * HOME_CARE_BASE_FEE },
      PENDING: { count: 0, amount: 0 },
      SECURED: { count: 1, amount: HOME_CARE_BASE_FEE },
    });
    const b = statuses.find((status) => status.recipient.id === "b")!;
    assert.deepEqual(homeCarePlannedCounts(b.tallies), {
      DOCTOR: 0,
      NURSE: 2,
      SOCIAL_WORKER: 0,
    });
    assert.equal(homeCareClaimDeadline("2026-10"), "2026-11-10");
    assert.equal(homeCareClaimDeadline("2026-12"), "2027-01-10");
  });
});
