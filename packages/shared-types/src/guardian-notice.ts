import {
  formatDateLabel,
  formatKstDate,
  formatKstTime,
  relativeDayLabel,
} from "./date.js";
import { PROFESSION_LABELS, type Profession } from "./roles.js";
import { dialablePhone, withParticle } from "./text.js";
import type { VisitStatus } from "./visit.js";

/*
 * 보호자 방문 안내 문구: 직원이 자기 휴대폰 문자 앱으로 보낸다(케어노트는 문자를 보내지 않는다).
 * 개인정보는 최소로: 수급자 이름·방문 일시·기관·담당자만, 보호자 이름·주소·진단은 넣지 않는다.
 */

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

/** "오전 9시 30분", "오후 12시", "오전 12시 5분"(한국 시각) */
function spokenTime(date: Date): string {
  const [hour, minute] = formatKstTime(date).split(":").map(Number) as [
    number,
    number,
  ];
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour < 12 ? "오전" : "오후"} ${hour12}시${minute ? ` ${minute}분` : ""}`;
}

export function guardianNoticeText(
  {
    scheduledAt,
    recipientName,
    profession,
    staffName,
    organizationName,
  }: {
    scheduledAt: string;
    recipientName: string;
    profession: Profession | null;
    staffName: string;
    organizationName: string;
  },
  today: string,
): string {
  const at = new Date(scheduledAt);
  const day = formatKstDate(at);
  const relative = relativeDayLabel(day, today);
  const who = profession
    ? `${PROFESSION_LABELS[profession]} ${staffName}`
    : staffName;
  return [
    `[${organizationName}] ${recipientName} 님 방문 안내`,
    `${relative ? `${relative} ` : ""}${formatDateLabel(day)} ${spokenTime(at)}에 ${withParticle(who, "이/가")} 방문합니다.`,
    "일정 변경은 이 번호로 연락 주세요.",
  ].join("\n");
}

/**
 * 휴대폰 문자 앱을 여는 주소. `?&body=`는 iOS·Android 모두에서 본문이 채워지는 형태로 알려져 있다(기기마다
 * 다를 수 있어 화면은 늘 [문구 복사]를 함께 둔다).
 */
export function smsUrl(phone: string, body: string): string {
  return `sms:${dialablePhone(phone)}?&body=${encodeURIComponent(body)}`;
}
