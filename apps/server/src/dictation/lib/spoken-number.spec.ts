import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { numbersInText, parseSpokenNumber } from "./spoken-number.js";

describe("parseSpokenNumber", () => {
  const cases: [string, number | null][] = [
    ["130", 130],
    ["36.8", 36.8],
    ["36 .8", 36.8],
    ["36.8도", 36.8],
    ["36점8", 36.8],
    ["15분", 15],
    ["백삼십", 130],
    ["백삼십에", 130],
    ["팔십오", 85],
    ["십오", 15],
    ["이십", 20],
    ["천이백", 1200],
    ["삼십육 점 팔", 36.8],
    ["삼십육점팔도", 36.8],
    ["영 점 오", 0.5],
    ["오", 5],
    // 숫자가 아니거나 자릿수 순서가 틀린 경우
    ["", null],
    ["맥박", null],
    ["십백", null],
    ["일이", null],
    ["삼십육 점 팔 점 이", null],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      assert.equal(parseSpokenNumber(input), expected);
    });
  }
});

describe("numbersInText", () => {
  it("아라비아 숫자와 띄어 쓴 소수", () => {
    const numbers = numbersInText("혈압 130에 85, 체온 36 .8도입니다.");
    assert.ok(numbers.includes(130));
    assert.ok(numbers.includes(85));
    assert.ok(numbers.includes(36.8));
  });

  it("한글로 읽은 숫자", () => {
    const numbers = numbersInText("혈압 백삼십에 팔십오, 체온 삼십육 점 팔 도");
    assert.ok(numbers.includes(130));
    assert.ok(numbers.includes(85));
    assert.ok(numbers.includes(36.8));
  });

  it("고유어 횟수", () => {
    assert.ok(numbersInText("혈압약을 두 번 빼먹으셨다").includes(2));
    assert.ok(numbersInText("진통제 세 알 드셨다").includes(3));
  });
});
