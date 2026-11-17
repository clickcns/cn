import { z } from "zod";
import {
  formatKstDate,
  formatKstTime,
  formatMinutes,
  minutesBetween,
} from "./date.js";
import type { Profession } from "./roles.js";
import type { VisitBase } from "./visit.js";

/*
 * 하루 동선 1단계: 이동 시간을 모르므로 수급자별 평소 방문 시간으로 "앞 일정이 언제 끝날지"를 추정해
 * 다음 예정 방문까지의 여유(이동 시간 포함)를 센다. 지도 회사에 아무것도 보내지 않고 휴대폰 위치도 쓰지
 * 않는다. 화면(현장 웹, 나중 모바일 앱)은 이 결과와 문구 함수만 쓴다.
 */

/** 평소 방문 시간을 모를 때(확정 기록이 없을 때) 쓰는 길이(분) */
export const DEFAULT_VISIT_MINUTES = 40;
/** 여유가 이보다 적으면 빠듯함(분) — 이동 시간이 여기에 들어 있다 */
export const TIGHT_SLACK_MINUTES = 15;
/** 평소 방문 시간 표본: 최근 확정 기록 몇 회의 중앙값, 길이 범위(분, 밖은 잘못 적은 시각) */
const SAMPLE_COUNT = 5;
const SAMPLE_MIN_MINUTES = 5;
const SAMPLE_MAX_MINUTES = 240;
/** 서버가 읽는 표본 수: 수급자 × 직종마다(범위 밖 기록을 빼고도 5회가 남게), 본인 기록 */
export const RECIPIENT_SAMPLE_LIMIT = 10;
export const STAFF_SAMPLE_LIMIT = 50;
const MINUTE = 60_000;

/** 평소 방문 시간의 근거: 그 수급자의 같은 직종 확정 기록 · 본인의 같은 직종 확정 기록 · 기본값 */
export type UsualDurationBasis = "RECIPIENT" | "STAFF" | "DEFAULT";

export interface VisitUsualDuration {
  visitId: string;
  recipientId: string;
  minutes: number;
  basis: UsualDurationBasis;
}

export interface UsualDurationsResponse {
  items: VisitUsualDuration[];
}

/** `GET /visits/usual-durations?date=` — 그날 본인 방문의 평소 방문 시간 */
export const UsualDurationsQuerySchema = z.object({ date: z.iso.date() });
export type UsualDurationsQuery = z.infer<typeof UsualDurationsQuerySchema>;

export interface DurationSample {
  startedAt: string | null;
  endedAt: string | null;
}

/** 확정 기록(최신순)의 방문 길이 중 최근 5개의 중앙값. 쓸 기록이 없으면 null. */
export function usualVisitMinutes(
  samples: readonly DurationSample[],
): number | null {
  const lengths: number[] = [];
  for (const { startedAt, endedAt } of samples) {
    const minutes =
      startedAt && endedAt ? minutesBetween(startedAt, endedAt) : null;
    if (
      minutes === null ||
      minutes < SAMPLE_MIN_MINUTES ||
      minutes > SAMPLE_MAX_MINUTES
    ) {
      continue;
    }
    lengths.push(minutes);
    if (lengths.length === SAMPLE_COUNT) break;
  }
  if (lengths.length === 0) return null;
  lengths.sort((a, b) => a - b);
  const middle = Math.floor(lengths.length / 2);
  return lengths.length % 2
    ? lengths[middle]!
    : Math.round((lengths[middle - 1]! + lengths[middle]!) / 2);
}

/**
 * 방문마다 평소 방문 시간: 그 수급자의 같은 직종 확정 기록 → 본인의 같은 직종 확정 기록 → 기본값 순.
 * 표본은 최신순으로 받는다.
 */
export function usualVisitDurations(
  visits: readonly {
    id: string;
    recipientId: string;
    profession: Profession;
  }[],
  recipientSamples: readonly (DurationSample & {
    recipientId: string;
    profession: Profession;
  })[],
  staffSamples: readonly (DurationSample & { profession: Profession })[],
): VisitUsualDuration[] {
  return visits.map(({ id, recipientId, profession }) => {
    const base = { visitId: id, recipientId };
    const own = usualVisitMinutes(
      recipientSamples.filter(
        (sample) =>
          sample.recipientId === recipientId &&
          sample.profession === profession,
      ),
    );
    if (own !== null) return { ...base, minutes: own, basis: "RECIPIENT" };
    const staff = usualVisitMinutes(
      staffSamples.filter((sample) => sample.profession === profession),
    );
    if (staff !== null) return { ...base, minutes: staff, basis: "STAFF" };
    return { ...base, minutes: DEFAULT_VISIT_MINUTES, basis: "DEFAULT" };
  });
}

export type PlanVisit = Pick<
  VisitBase,
  "id" | "status" | "scheduledAt" | "startedAt" | "endedAt"
>;

/**
 * 동선에서 이 방문의 처지: 예정(UPCOMING), 시작했고 아직 끝나지 않음(ACTIVE), 끝남(DONE: 종료 시각이
 * 있거나 확정), 시각 없는 작성 중(UNTIMED), 다른 날 적힌 시각(ELSEWHERE — 그날 동선에 쓰지 않음)
 */
export type PlanPhase =
  "UPCOMING" | "ACTIVE" | "DONE" | "UNTIMED" | "ELSEWHERE";
export type PlanStatus = "OK" | "TIGHT" | "LATE";

export interface PlannedVisit<T> {
  visit: T;
  phase: PlanPhase;
  /** 평소 방문 시간(분)과 그 근거 */
  minutes: number;
  basis: UsualDurationBasis;
  /** 지금부터 예정 시각까지(분, 반올림). 지났으면 음수 */
  minutesFromNow: number;
  /** 예상 끝(ISO). 다른 날 적힌 방문은 null */
  expectedEnd: string | null;
  /** 진행 중인데 평소 시간을 넘김(예상 끝을 지금으로 민 경우) */
  overrun: boolean;
  /** 예정 방문만: 갈 수 있는 때를 정한 앞 방문(지금 시각이 정했으면 null) */
  readyAfter: PlannedVisit<T> | null;
  /** 예정 방문만: 예정 시각까지의 여유(분, 이동 시간 포함). 음수면 늦을 수 있음 */
  slack: number | null;
  status: PlanStatus | null;
}

/** 예정이 아닌 방문의 처지와 예상 끝(ms). 다른 날 적힌 시각이면 끝은 null. */
function settledVisit(
  visit: PlanVisit,
  minutes: number,
  nowMs: number,
  date: string,
): { phase: PlanPhase; end: number | null; overrun: boolean } {
  const timed = visit.startedAt ?? visit.endedAt;
  if (timed !== null && formatKstDate(new Date(timed)) !== date) {
    return { phase: "ELSEWHERE", end: null, overrun: false };
  }
  if (visit.endedAt) {
    return { phase: "DONE", end: Date.parse(visit.endedAt), overrun: false };
  }
  const end =
    Date.parse(visit.startedAt ?? visit.scheduledAt) + minutes * MINUTE;
  // 종료 시각 없이 확정한 방문은 이미 끝났다: 추정한 끝이 지금보다 늦으면 지금(뒤 일정을 막지 않는다)
  if (visit.status === "CONFIRMED") {
    return { phase: "DONE", end: Math.min(end, nowMs), overrun: false };
  }
  if (visit.startedAt) {
    // 시작하고 평소 방문의 상한(240분)을 넘게 지났으면 종료 시각을 빠뜨린 것으로 보고 막지 않는다
    if (nowMs - Date.parse(visit.startedAt) > SAMPLE_MAX_MINUTES * MINUTE) {
      return { phase: "ACTIVE", end, overrun: false };
    }
    return { phase: "ACTIVE", end: Math.max(end, nowMs), overrun: end < nowMs };
  }
  return { phase: "UNTIMED", end, overrun: false };
}

/**
 * 오늘 동선: 다음 일정에 갈 수 있는 가장 이른 때(freeAt)를 이어 붙인다. 처음 freeAt은 지금과, 시작했거나
 * 끝난 방문의 끝(진행 중이면 시작 + 평소 시간, 넘겼으면 지금) 중 가장 늦은 때다 — 순서를 바꿔 뒤 방문을
 * 먼저 하고 있어도 그 방문이 끝나야 갈 수 있으므로. 그다음 시각순으로 훑으며 예정 방문은 여유를 매기고
 * max(예정, freeAt) + 평소 시간까지 막는다. 시각 없는 작성 중 방문은 예정 + 평소 시간으로만 막고 지금
 * 시각으로 밀지 않는다(미리 임시 저장한 방문이 뒤를 모두 늦음으로 만들지 않게). 종료 시각 없이 확정한 방문은
 * 끝을 지금 넘게 두지 않고, 시작 뒤 240분이 지나도 종료가 없는 방문은 막지 않는다(settledVisit). 날짜는 지금의
 * 한국 날짜.
 */
export function planDay<T extends PlanVisit>(
  visits: readonly T[],
  durations: ReadonlyMap<
    string,
    { minutes: number; basis: UsualDurationBasis }
  >,
  now: Date,
): PlannedVisit<T>[] {
  const nowMs = now.getTime();
  const date = formatKstDate(now);
  const usual = (visit: T) =>
    durations.get(visit.id) ?? {
      minutes: DEFAULT_VISIT_MINUTES,
      basis: "DEFAULT" as const,
    };
  const settled = new Map(
    visits
      .filter((visit) => visit.status !== "SCHEDULED")
      .map((visit) => [
        visit.id,
        settledVisit(visit, usual(visit).minutes, nowMs, date),
      ]),
  );

  let freeAt = nowMs;
  let freeAfter: string | null = null;
  /** 이 방문이 끝날 때까지 다음 일정을 막는다. 평소 시간을 넘긴 진행 중 방문은 지금과 같아도 까닭이 된다. */
  const block = (id: string, end: number, overrun = false) => {
    if (end > freeAt || (overrun && end >= freeAt)) {
      freeAt = end;
      freeAfter = id;
    }
  };
  for (const [id, { phase, end, overrun }] of settled) {
    if ((phase === "ACTIVE" || phase === "DONE") && end !== null) {
      block(id, end, overrun);
    }
  }

  const readyAfterIds = new Map<string, string | null>();
  const entries = visits.map((visit): PlannedVisit<T> => {
    const { minutes, basis } = usual(visit);
    const scheduled = Date.parse(visit.scheduledAt);
    const base = {
      visit,
      minutes,
      basis,
      minutesFromNow: Math.round((scheduled - nowMs) / MINUTE),
      readyAfter: null,
    };
    const done = settled.get(visit.id);
    if (done) {
      if (done.phase === "UNTIMED" && done.end !== null) {
        block(visit.id, done.end);
      }
      return {
        ...base,
        phase: done.phase,
        expectedEnd:
          done.end === null ? null : new Date(done.end).toISOString(),
        overrun: done.overrun,
        slack: null,
        status: null,
      };
    }
    const slack = Math.round((scheduled - freeAt) / MINUTE);
    readyAfterIds.set(visit.id, freeAfter);
    const end = Math.max(scheduled, freeAt) + minutes * MINUTE;
    block(visit.id, end);
    return {
      ...base,
      phase: "UPCOMING",
      expectedEnd: new Date(end).toISOString(),
      overrun: false,
      slack,
      status: slack < 0 ? "LATE" : slack < TIGHT_SLACK_MINUTES ? "TIGHT" : "OK",
    };
  });
  // 앞 방문은 뒤에 적힌 방문(순서를 바꿔 진행 중)일 수 있어 다 만든 뒤 잇는다.
  const byId = new Map(entries.map((entry) => [entry.visit.id, entry]));
  for (const entry of entries) {
    const id = readyAfterIds.get(entry.visit.id);
    if (id) entry.readyAfter = byId.get(id) ?? null;
  }
  return entries;
}

/* ---------- 문구(현장 웹·모바일 앱 공용) ---------- */

/** "40분 후", "지금" / 지났으면 "예정 시각 20분 지남" */
export function minutesFromNowText(minutes: number): string {
  if (minutes > 0) return `${formatMinutes(minutes)} 후`;
  if (minutes === 0) return "지금";
  return `예정 시각 ${formatMinutes(-minutes)} 지남`;
}

/** 여유 표시: "여유 30분" / "빠듯함 · 여유 9분" / "늦을 수 있음 · 5분" */
export function slackText({
  status,
  slack,
}: Pick<PlannedVisit<unknown>, "status" | "slack">): string | null {
  if (status === null || slack === null) return null;
  if (status === "LATE") return `늦을 수 있음 · ${formatMinutes(-slack)}`;
  if (status === "TIGHT") return `빠듯함 · 여유 ${formatMinutes(slack)}`;
  return `여유 ${formatMinutes(slack)}`;
}

/** "평소 50분" · 본인 기록이면 "내 평소 35분" · 모르면 "기본 40분" */
export function usualMinutesText({
  minutes,
  basis,
}: {
  minutes: number;
  basis: UsualDurationBasis;
}): string {
  const length = formatMinutes(minutes);
  if (basis === "RECIPIENT") return `평소 ${length}`;
  if (basis === "STAFF") return `내 평소 ${length}`;
  return `기본 ${length}`;
}

/**
 * 이 방문에 언제 갈 수 있는지의 까닭(앞 방문): "앞 방문(김영자 님) 10:05에 끝남", "… 예상 끝 11:30 · 평소
 * 50분", "앞 방문(박순례 님)이 평소(50분)보다 길어지고 있어요". 지금 시각이 정했으면 null.
 */
export function readyAfterText(
  entry: Pick<
    PlannedVisit<PlanVisit & { recipient: { name: string } }>,
    "readyAfter"
  >,
): string | null {
  const before = entry.readyAfter;
  if (!before?.expectedEnd) return null;
  const subject = `앞 방문(${before.visit.recipient.name} 님)`;
  if (before.phase === "DONE") {
    return `${subject} ${formatKstTime(new Date(before.expectedEnd))}에 끝남`;
  }
  return runningVisitText(subject, before);
}

/** 진행 중인 방문의 예상 끝: "… 예상 끝 11:30 · 평소 50분" / 넘겼으면 "…이 평소(50분)보다 길어지고 있어요" */
function runningVisitText(
  subject: string,
  entry: Pick<
    PlannedVisit<unknown>,
    "minutes" | "basis" | "overrun" | "expectedEnd"
  >,
): string | null {
  if (entry.overrun) {
    return `${subject}이 평소(${formatMinutes(entry.minutes)})보다 길어지고 있어요`;
  }
  if (!entry.expectedEnd) return null;
  const end = formatKstTime(new Date(entry.expectedEnd));
  return `${subject} 예상 끝 ${end} · ${usualMinutesText(entry)}`;
}

/** 진행 중인 이 방문: "이 방문 예상 끝 11:30 · 평소 50분" / "이 방문이 평소(50분)보다 길어지고 있어요" */
export function activeVisitText(
  entry: Pick<
    PlannedVisit<unknown>,
    "minutes" | "basis" | "overrun" | "expectedEnd"
  >,
): string | null {
  return runningVisitText("이 방문", entry);
}

/**
 * 늦음 안내에서 고를 늦음(분)과 처음 값: 늦는 만큼 + 이동 몫 10분을 10분 단위로 올린 값(10~90)을
 * 10·20·30분과 함께.
 */
export function lateMinuteChoices(slack: number | null): {
  choices: number[];
  suggested: number;
} {
  const suggested =
    slack === null || slack >= 0
      ? 10
      : Math.min(90, Math.ceil((-slack + 10) / 10) * 10);
  return {
    choices: [...new Set([10, 20, 30, suggested])].sort((a, b) => a - b),
    suggested,
  };
}
