import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_VISIT_MINUTES,
  guardianLateNoticeText,
  guardianNoticesAvailable,
  lateMinuteChoices,
  minutesFromNowText,
  planDay,
  activeVisitText,
  readyAfterText,
  slackText,
  usualMinutesText,
  usualVisitDurations,
  usualVisitMinutes,
  type PlanVisit,
  type VisitStatus,
} from "@repo/shared-types";

const DATE = "2026-10-05";
/** 그날 한국 시각 → ISO */
const at = (time: string, date = DATE) =>
  new Date(`${date}T${time}:00+09:00`).toISOString();
const sample = (start: string, end: string) => ({
  startedAt: at(start),
  endedAt: at(end),
});

type TestVisit = PlanVisit & { recipient: { name: string } };

function visit(
  id: string,
  scheduled: string,
  status: VisitStatus = "SCHEDULED",
  times: { startedAt?: string | null; endedAt?: string | null } = {},
): TestVisit {
  return {
    id,
    status,
    scheduledAt: at(scheduled),
    startedAt: times.startedAt ?? null,
    endedAt: times.endedAt ?? null,
    recipient: { name: `수급자${id}` },
  };
}

function plan(visits: TestVisit[], usual: Record<string, number>, now: string) {
  const durations = new Map(
    Object.entries(usual).map(([id, minutes]) => [
      id,
      { minutes, basis: "RECIPIENT" as const },
    ]),
  );
  return planDay(visits, durations, new Date(at(now)));
}

describe("usualVisitMinutes", () => {
  it("최근 5회의 중앙값, 5~240분 밖은 잘못 적은 시각으로 빼고 짝수면 가운데 둘 평균", () => {
    assert.equal(
      usualVisitMinutes([
        sample("09:00", "09:50"), // 50
        sample("09:00", "09:02"), // 2분: 뺌
        sample("09:00", "09:40"), // 40
        sample("09:00", "14:00"), // 300분: 뺌
        { startedAt: at("09:00"), endedAt: null }, // 끝 없음: 뺌
        sample("09:00", "10:00"), // 60
        sample("09:00", "09:30"), // 30
        sample("09:00", "09:45"), // 45
        sample("09:00", "09:10"), // 여섯째라 안 봄
      ]),
      45,
    );
    assert.equal(
      usualVisitMinutes([sample("09:00", "09:40"), sample("09:00", "09:51")]),
      46,
    );
    assert.equal(usualVisitMinutes([]), null);
  });

  it("자정을 넘긴 방문도 실제 길이로 센다", () => {
    assert.equal(
      usualVisitMinutes([
        { startedAt: at("23:40"), endedAt: at("00:20", "2026-10-06") },
      ]),
      40,
    );
  });
});

describe("usualVisitDurations", () => {
  it("그 수급자의 같은 직종 기록 → 본인의 같은 직종 기록 → 기본값", () => {
    const result = usualVisitDurations(
      [
        { id: "a", recipientId: "r1", profession: "NURSE" },
        { id: "b", recipientId: "r2", profession: "NURSE" },
        { id: "c", recipientId: "r3", profession: "DOCTOR" },
      ],
      [
        { recipientId: "r1", profession: "NURSE", ...sample("09:00", "09:50") },
        // 같은 수급자라도 다른 직종 기록은 쓰지 않는다
        {
          recipientId: "r2",
          profession: "DOCTOR",
          ...sample("09:00", "09:15"),
        },
      ],
      [{ profession: "NURSE", ...sample("09:00", "09:35") }],
    );
    assert.deepEqual(
      result.map(({ visitId, minutes, basis }) => [visitId, minutes, basis]),
      [
        ["a", 50, "RECIPIENT"],
        ["b", 35, "STAFF"],
        ["c", DEFAULT_VISIT_MINUTES, "DEFAULT"],
      ],
    );
  });
});

describe("planDay", () => {
  it("앞 방문 예상 끝에서 다음 예정까지 여유: 넉넉함·빠듯함(15분 미만)", () => {
    const result = plan(
      [
        visit("a", "09:30"),
        visit("b", "10:40"),
        visit("c", "11:40"),
        visit("d", "12:30"),
      ],
      { a: 40, b: 50, c: 40, d: 40 },
      "08:40",
    );
    assert.deepEqual(
      result.map((p) => [
        p.visit.id,
        p.slack,
        p.status,
        p.readyAfter?.visit.id ?? null,
        p.minutesFromNow,
      ]),
      [
        ["a", 50, "OK", null, 50], // 지금(08:40)부터
        ["b", 30, "OK", "a", 120], // a 10:10 끝
        ["c", 10, "TIGHT", "b", 180], // b 11:30 끝
        ["d", 10, "TIGHT", "c", 230], // c 12:20 끝
      ],
    );
    assert.equal(
      readyAfterText(result[1]),
      "앞 방문(수급자a 님) 예상 끝 10:10 · 평소 40분",
    );
    assert.equal(readyAfterText(result[0]), null);
  });

  it("지금 시각을 반영: 앞 방문이 끝났어도 지금이 더 늦으면 지금부터 센다", () => {
    const result = plan(
      [
        visit("a", "09:30", "CONFIRMED", {
          startedAt: at("09:30"),
          endedAt: at("10:00"),
        }),
        visit("b", "11:00"),
      ],
      { a: 40, b: 40 },
      "10:50",
    );
    assert.equal(result[0].phase, "DONE");
    assert.deepEqual(
      [result[1].slack, result[1].status, result[1].readyAfter],
      [10, "TIGHT", null],
    );
  });

  it("끝난 앞 방문이 정하면 끝난 시각을 적는다", () => {
    const result = plan(
      [
        visit("a", "09:30", "DRAFT", {
          startedAt: at("09:30"),
          endedAt: at("10:05"),
        }),
        visit("b", "10:40"),
      ],
      { a: 40, b: 40 },
      "10:00",
    );
    assert.equal(readyAfterText(result[1]), "앞 방문(수급자a 님) 10:05에 끝남");
  });

  it("진행 중 방문이 평소보다 길어지면 지금까지 막고, 뒤 방문은 늦을 수 있음", () => {
    const result = plan(
      [
        visit("a", "10:40", "DRAFT", { startedAt: at("10:41") }),
        visit("b", "12:00"),
      ],
      { a: 50, b: 40 },
      "12:05",
    );
    assert.deepEqual(
      [result[0].phase, result[0].overrun, result[0].expectedEnd],
      ["ACTIVE", true, at("12:05")],
    );
    assert.deepEqual([result[1].slack, result[1].status], [-5, "LATE"]);
    assert.equal(
      readyAfterText(result[1]),
      "앞 방문(수급자a 님)이 평소(50분)보다 길어지고 있어요",
    );
  });

  it("진행 중인 이 방문의 문구: 예상 끝 · 평소 / 넘기면 길어짐", () => {
    const [running] = plan(
      [visit("a", "10:40", "DRAFT", { startedAt: at("10:41") })],
      { a: 50 },
      "11:00",
    );
    assert.equal(activeVisitText(running), "이 방문 예상 끝 11:31 · 평소 50분");
    const [over] = plan(
      [visit("a", "10:40", "DRAFT", { startedAt: at("10:41") })],
      { a: 50 },
      "12:05",
    );
    assert.equal(
      activeVisitText(over),
      "이 방문이 평소(50분)보다 길어지고 있어요",
    );
  });

  it("예정 시각이 지났는데 시작하지 않은 방문은 늦음, 그 뒤는 지금부터 이어 센다", () => {
    const result = plan(
      [visit("a", "09:30"), visit("b", "10:30")],
      { a: 40, b: 40 },
      "09:50",
    );
    assert.deepEqual([result[0].slack, result[0].status], [-20, "LATE"]);
    // a를 지금(09:50) 시작하면 10:30 끝 → b 여유 0
    assert.deepEqual([result[1].slack, result[1].status], [0, "TIGHT"]);
  });

  it("순서가 바뀐 날: 예정 b를 건너뛰고 c를 진행 중이면 b는 c가 끝난 뒤로 센다", () => {
    const result = plan(
      [
        visit("a", "09:30", "CONFIRMED", {
          startedAt: at("09:30"),
          endedAt: at("10:10"),
        }),
        visit("b", "10:40"),
        visit("c", "11:40", "DRAFT", { startedAt: at("10:30") }),
      ],
      { a: 40, b: 40, c: 40 },
      "10:50",
    );
    // c는 10:30 + 40분 = 11:10에 끝날 것으로 본다
    assert.deepEqual(
      [result[1].slack, result[1].status, result[1].readyAfter?.visit.id],
      [-30, "LATE", "c"],
    );
    assert.deepEqual([result[2].phase, result[2].overrun], ["ACTIVE", false]);
  });

  it("시각 없는 작성 중 방문은 예정 + 평소 시간으로만 막고 지금 시각으로 밀지 않는다(시각 없는 확정은 DONE)", () => {
    const result = plan(
      [
        visit("a", "09:00", "DRAFT"), // 미리 임시 저장한 방문
        visit("b", "09:40"),
      ],
      { a: 30, b: 40 },
      "08:00",
    );
    assert.equal(result[0].phase, "UNTIMED");
    assert.equal(result[0].expectedEnd, at("09:30"));
    assert.deepEqual([result[1].slack, result[1].status], [10, "TIGHT"]);

    const confirmed = plan(
      [visit("a", "09:00", "CONFIRMED")],
      { a: 30 },
      "15:00",
    );
    assert.equal(confirmed[0].phase, "DONE");
  });

  it("종료 시각 없이 확정한 방문은 이미 끝났다: 추정 끝이 지금보다 늦어도 뒤 일정을 막지 않는다", () => {
    // 순서를 바꿔 14:00 방문을 먼저 하고 시각 없이 확정 → 10:00 방문은 지금(09:30)부터
    const reordered = plan(
      [visit("a", "10:00"), visit("b", "14:00", "CONFIRMED")],
      { a: 40, b: 40 },
      "09:30",
    );
    assert.deepEqual(
      [reordered[0].slack, reordered[0].status, reordered[0].readyAfter],
      [30, "OK", null],
    );
    assert.equal(readyAfterText(reordered[0]), null);
    // 시작만 저장하고 확정 → 확정한 지금까지만
    const startedOnly = plan(
      [
        visit("a", "10:00", "CONFIRMED", { startedAt: at("10:00") }),
        visit("b", "11:00"),
      ],
      { a: 50, b: 40 },
      "10:25",
    );
    assert.deepEqual(
      [startedOnly[0].phase, startedOnly[0].expectedEnd],
      ["DONE", at("10:25")],
    );
    assert.deepEqual(
      [startedOnly[1].slack, startedOnly[1].readyAfter],
      [35, null],
    );
  });

  it("시작하고 240분이 지나도 종료가 없으면 종료를 빠뜨린 것으로 보고 막지 않는다", () => {
    const result = plan(
      [
        visit("a", "09:00", "DRAFT", { startedAt: at("09:00") }),
        visit("b", "13:30"),
      ],
      { a: 40, b: 40 },
      "13:10",
    );
    assert.deepEqual(
      [result[0].phase, result[0].overrun, result[0].expectedEnd],
      ["ACTIVE", false, at("09:40")],
    );
    assert.deepEqual([result[1].slack, result[1].readyAfter], [20, null]);
  });

  it("다른 날 적은 시각은 그날 동선에 쓰지 않는다", () => {
    const result = plan(
      [
        visit("a", "09:00", "DRAFT", { startedAt: at("16:00", "2026-10-04") }),
        visit("b", "09:30"),
      ],
      { a: 40, b: 40 },
      "09:00",
    );
    assert.deepEqual(
      [result[0].phase, result[0].expectedEnd],
      ["ELSEWHERE", null],
    );
    assert.deepEqual([result[1].slack, result[1].readyAfter], [30, null]);
  });

  it("평소 시간을 모르면 기본값", () => {
    const result = planDay(
      [visit("a", "09:00"), visit("b", "09:50")],
      new Map(),
      new Date(at("08:00")),
    );
    assert.deepEqual(
      [result[0].minutes, result[0].basis],
      [DEFAULT_VISIT_MINUTES, "DEFAULT"],
    );
    assert.equal(result[1].slack, 50 - DEFAULT_VISIT_MINUTES);
  });
});

describe("동선 문구", () => {
  it("남은 시간·여유·평소 시간", () => {
    assert.equal(minutesFromNowText(65), "1시간 5분 후");
    assert.equal(minutesFromNowText(0), "지금");
    assert.equal(minutesFromNowText(-20), "예정 시각 20분 지남");
    assert.equal(slackText({ status: "OK", slack: 30 }), "여유 30분");
    assert.equal(slackText({ status: "TIGHT", slack: 9 }), "빠듯함 · 여유 9분");
    assert.equal(
      slackText({ status: "LATE", slack: -5 }),
      "늦을 수 있음 · 5분",
    );
    assert.equal(slackText({ status: null, slack: null }), null);
    assert.equal(
      usualMinutesText({ minutes: 50, basis: "RECIPIENT" }),
      "평소 50분",
    );
    assert.equal(
      usualMinutesText({ minutes: 35, basis: "STAFF" }),
      "내 평소 35분",
    );
    assert.equal(
      usualMinutesText({ minutes: 40, basis: "DEFAULT" }),
      "기본 40분",
    );
  });
});

describe("늦음 안내", () => {
  it("고를 늦음: 늦는 만큼 + 이동 10분을 10분 단위로 올린 값(10~90)을 10·20·30분과 함께", () => {
    assert.deepEqual(lateMinuteChoices(null), {
      choices: [10, 20, 30],
      suggested: 10,
    });
    assert.deepEqual(lateMinuteChoices(8), {
      choices: [10, 20, 30],
      suggested: 10,
    });
    assert.deepEqual(lateMinuteChoices(-5), {
      choices: [10, 20, 30],
      suggested: 20,
    });
    assert.deepEqual(lateMinuteChoices(-23), {
      choices: [10, 20, 30, 40],
      suggested: 40,
    });
    assert.equal(lateMinuteChoices(-200).suggested, 90);
  });

  it("예정 시각과 도착 예정 시각을 오전·오후로, 앞 방문 이야기는 넣지 않는다", () => {
    const text = guardianLateNoticeText(
      {
        scheduledAt: at("12:00"),
        recipientName: "이만수",
        profession: "NURSE",
        staffName: "이간호",
        organizationName: "데모 방문간호센터",
      },
      20,
    );
    assert.equal(
      text,
      "[데모 방문간호센터] 이만수 님 방문 안내\n간호사 이간호가 예정(오후 12시)보다 20분쯤 늦은 오후 12시 20분쯤 도착할 예정입니다.\n늦어져 죄송합니다. 문의는 이 번호로 연락 주세요.",
    );
  });

  it("보호자 안내 모아 보기는 오늘 이후이고 예정 방문이 있을 때만", () => {
    assert.equal(guardianNoticesAvailable("2026-10-05", 2, "2026-10-05"), true);
    assert.equal(
      guardianNoticesAvailable("2026-10-04", 2, "2026-10-05"),
      false,
    );
    assert.equal(
      guardianNoticesAvailable("2026-10-06", 0, "2026-10-05"),
      false,
    );
  });
});
