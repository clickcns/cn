import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMinutes,
  guardianNoticeAvailable,
  guardianNoticeText,
  smsUrl,
} from "@repo/shared-types";

describe("남은 시간 글", () => {
  it("분 → 시간·분", () => {
    assert.equal(formatMinutes(45), "45분");
    assert.equal(formatMinutes(60), "1시간");
    assert.equal(formatMinutes(65), "1시간 5분");
  });
});

describe("보호자 방문 안내", () => {
  const base = {
    recipientName: "강옥자",
    profession: "NURSE" as const,
    staffName: "오간호",
    organizationName: "데모 재택의료의원",
  };

  it("한국 시각·오전/오후·오늘/내일, 보호자 이름·주소는 넣지 않는다", () => {
    const text = guardianNoticeText(
      { ...base, scheduledAt: "2026-10-04T00:30:00.000Z" },
      "2026-10-03",
    );
    assert.equal(
      text,
      "[데모 재택의료의원] 강옥자 님 방문 안내\n내일 10월 4일 (일) 오전 9시 30분에 간호사 오간호가 방문합니다.\n일정 변경은 이 번호로 연락 주세요.",
    );
    assert.match(
      guardianNoticeText(
        { ...base, scheduledAt: "2026-10-03T03:00:00.000Z" },
        "2026-10-03",
      ),
      /오늘 10월 3일 \(토\) 오후 12시에/,
    );
    assert.match(
      guardianNoticeText(
        {
          ...base,
          profession: null,
          staffName: "한관리",
          scheduledAt: "2026-10-09T15:05:00.000Z",
        },
        "2026-10-03",
      ),
      /\n10월 10일 \(토\) 오전 12시 5분에 한관리가 방문합니다/,
    );
  });

  it("예정이고 오늘 이후일 때만", () => {
    const at = (date: string) =>
      new Date(`${date}T10:00:00+09:00`).toISOString();
    assert.equal(
      guardianNoticeAvailable(
        { status: "SCHEDULED", scheduledAt: at("2026-10-03") },
        "2026-10-03",
      ),
      true,
    );
    assert.equal(
      guardianNoticeAvailable(
        { status: "SCHEDULED", scheduledAt: at("2026-10-02") },
        "2026-10-03",
      ),
      false,
    );
    assert.equal(
      guardianNoticeAvailable(
        { status: "DRAFT", scheduledAt: at("2026-10-04") },
        "2026-10-03",
      ),
      false,
    );
  });

  it("문자 앱 주소: 번호는 숫자만, 본문은 줄바꿈까지 인코딩", () => {
    assert.equal(
      smsUrl("010-1234-5678", "안녕\n하세요"),
      "sms:01012345678?&body=%EC%95%88%EB%85%95%0A%ED%95%98%EC%84%B8%EC%9A%94",
    );
  });
});
