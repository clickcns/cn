import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  birthDateSearchCandidates,
  mapSearchQuery,
  mapSearchUrl,
} from "@repo/shared-types";

describe("birthDateSearchCandidates", () => {
  it("네 자리 연도는 그 날짜 하나로 읽는다", () => {
    assert.deepEqual(birthDateSearchCandidates("19420819"), ["1942-08-19"]);
    assert.deepEqual(birthDateSearchCandidates("1942-08-19"), ["1942-08-19"]);
    assert.deepEqual(birthDateSearchCandidates(" 1942.8.19. "), ["1942-08-19"]);
    assert.deepEqual(birthDateSearchCandidates("1942/8/9"), ["1942-08-09"]);
  });

  it("두 자리 연도(주민등록번호 앞자리)는 1900년대와 2000년대를 모두 본다", () => {
    assert.deepEqual(birthDateSearchCandidates("420819"), [
      "1942-08-19",
      "2042-08-19",
    ]);
    assert.deepEqual(birthDateSearchCandidates("42.8.19"), [
      "1942-08-19",
      "2042-08-19",
    ]);
  });

  it("없는 날짜·섞인 구분 기호·다른 글자는 생년월일로 보지 않는다", () => {
    assert.deepEqual(birthDateSearchCandidates("19420230"), []);
    assert.deepEqual(birthDateSearchCandidates("000229"), ["2000-02-29"]);
    assert.deepEqual(birthDateSearchCandidates("1942-08.19"), []);
    assert.deepEqual(birthDateSearchCandidates("1001"), []);
    assert.deepEqual(birthDateSearchCandidates("김영자"), []);
    assert.deepEqual(birthDateSearchCandidates("1942081"), []);
  });
});

describe("mapSearchUrl", () => {
  it("상세주소(첫 쉼표 뒤)는 빼고 찾는다", () => {
    assert.equal(
      mapSearchQuery(" 서울시 가상구 예시로 12, 101동 1203호 "),
      "서울시 가상구 예시로 12",
    );
    assert.equal(
      mapSearchQuery("서울시 가상구 샘플길 45"),
      "서울시 가상구 샘플길 45",
    );
    assert.equal(mapSearchQuery(", 2층"), ", 2층");
  });

  it("지도 앱마다 검색 주소를 만든다(검색어는 인코딩)", () => {
    const address = "서울시 가상구 테스트로 7, 2층";
    const query = encodeURIComponent("서울시 가상구 테스트로 7");
    assert.equal(
      mapSearchUrl("NAVER", address),
      `https://map.naver.com/p/search/${query}`,
    );
    assert.equal(
      mapSearchUrl("KAKAO", address),
      `https://map.kakao.com/link/search/${query}`,
    );
    assert.equal(
      mapSearchUrl("GOOGLE", address),
      `https://www.google.com/maps/search/?api=1&query=${query}`,
    );
  });
});
