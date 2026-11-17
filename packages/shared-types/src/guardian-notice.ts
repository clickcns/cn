import {
  formatDateLabel,
  formatKstDate,
  formatKstTime,
  relativeDayLabel,
} from "./date.js";
import { PROFESSION_LABELS, type Profession } from "./roles.js";
import { dialablePhone, withParticle } from "./text.js";
import type { VisitDetail, VisitStatus } from "./visit.js";

/*
 * 보호자 방문 안내 문구: 직원이 자기 휴대폰 문자 앱으로 보낸다(케어노트는 문자를 보내지 않는다).
 * 개인정보는 최소로: 수급자 이름·방문 일시·기관·담당자만, 보호자 이름·주소·진단은 넣지 않는다.
 */

/** 보호자 문자 창들의 안내 한 줄 */
export const GUARDIAN_SMS_NOTE =
  "문자는 내 휴대폰 문자 앱으로 보냅니다. 케어노트는 문자를 보내지 않습니다.";

/** 예정 상태이고 오늘이나 그 뒤 방문일 때만 안내한다. */
export function guardianNoticeAvailable(
  visit: { status: VisitStatus; scheduledAt: string },
  today: string,
): boolean {
  return (
    visit.status === "SCHEDULED" &&
    formatKstDate(new Date(visit.scheduledAt)) >= today
  );
}

/** 그날 안내할 방문이 있는지(하루 단위 — 오늘 이후이고 예정 방문이 있을 때). */
export function guardianNoticesAvailable(
  date: string,
  scheduledCount: number,
  today: string,
): boolean {
  return date >= today && scheduledCount > 0;
}

/** "오전 9시 30분", "오후 12시", "오전 12시 5분"(한국 시각) */
function spokenTime(date: Date): string {
  const [hour, minute] = formatKstTime(date).split(":").map(Number) as [
    number,
    number,
  ];
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? "오전" : "오후"} ${hour12}시${minute ? ` ${minute}분` : ""}`;
}

/** 안내 문구에 들어가는 방문 정보 */
export interface GuardianNoticeVisit {
  scheduledAt: string;
  recipientName: string;
  profession: Profession | null;
  staffName: string;
  organizationName: string;
}

/** 방문 상세 → 안내 문구에 넣을 방문 정보(기관·수급자·일시·담당자만) */
export function guardianNoticeVisitOf(visit: VisitDetail): GuardianNoticeVisit {
  return {
    scheduledAt: visit.scheduledAt,
    recipientName: visit.recipient.name,
    profession: visit.profession,
    staffName: visit.staff.name,
    organizationName: visit.organization.name,
  };
}

/** "간호사 오간호가" */
function staffSubject({ profession, staffName }: GuardianNoticeVisit): string {
  const who = profession
    ? `${PROFESSION_LABELS[profession]} ${staffName}`
    : staffName;
  return withParticle(who, "이/가");
}

export function guardianNoticeText(
  visit: GuardianNoticeVisit,
  today: string,
): string {
  const at = new Date(visit.scheduledAt);
  const day = formatKstDate(at);
  const relative = relativeDayLabel(day, today);
  return [
    `[${visit.organizationName}] ${visit.recipientName} 님 방문 안내`,
    `${relative ? `${relative} ` : ""}${formatDateLabel(day)} ${spokenTime(at)}에 ${staffSubject(visit)} 방문합니다.`,
    "일정 변경은 이 번호로 연락 주세요.",
  ].join("\n");
}

/**
 * 늦음 안내: "간호사 이간호가 예정(오후 12시)보다 20분쯤 늦은 오후 12시 20분쯤 도착할 예정입니다."
 * 앞 방문의 수급자나 늦는 까닭은 넣지 않는다.
 */
export function guardianLateNoticeText(
  visit: GuardianNoticeVisit,
  lateMinutes: number,
): string {
  const at = new Date(visit.scheduledAt);
  const arrival = new Date(at.getTime() + lateMinutes * 60_000);
  return [
    `[${visit.organizationName}] ${visit.recipientName} 님 방문 안내`,
    `${staffSubject(visit)} 예정(${spokenTime(at)})보다 ${lateMinutes}분쯤 늦은 ${spokenTime(arrival)}쯤 도착할 예정입니다.`,
    "늦어져 죄송합니다. 문의는 이 번호로 연락 주세요.",
  ].join("\n");
}

/**
 * 휴대폰 문자 앱을 여는 주소. `?&body=`는 iOS·Android 모두에서 본문이 채워지는 형태로 알려져 있다(기기마다
 * 다를 수 있어 화면은 늘 [문구 복사]를 함께 둔다).
 */
export function smsUrl(phone: string, body: string): string {
  return `sms:${dialablePhone(phone)}?&body=${encodeURIComponent(body)}`;
}
