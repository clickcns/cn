import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findMissingRequired,
  missingRequiredMessage,
  type VisitRecordSnapshot,
} from "@repo/shared-types";
import {
  canonicalJson,
  recordVersionHash,
  toRecordSnapshot,
} from "./record-version.js";

const snapshot: VisitRecordSnapshot = {
  program: "HOME_CARE_CENTER",
  profession: "NURSE",
  staffId: "nurse-1",
  formIds: ["HOME_CARE_NURSE"],
  forms: { HOME_CARE_NURSE: { care: [{ value: "vital" }], notes: null } },
  startedAt: "2026-09-23T05:00:00.000Z",
  endedAt: "2026-09-23T05:40:00.000Z",
  header: {
    organization: { name: "데모 재택의료의원", code: null },
    recipient: {
      name: "강옥자",
      chartNumber: "2001",
      birthDate: "1939-03-02",
      gender: "FEMALE",
      careGrade: "1",
      ltcCertNumber: "L0000001101",
      address: "서울시 가상구 연습로 21, 3층",
    },
    staff: { name: "오간호", licenseNumber: "N-200002" },
  },
};
/** DB에서 읽은 서식 머리(recordHeaderSelect 모양) */
const headerRow = {
  organization: snapshot.header.organization,
  recipient: {
    ...snapshot.header.recipient,
    birthDate: new Date("1939-03-02T00:00:00.000Z"),
  },
  staff: snapshot.header.staff,
};
const base = {
  visitId: "visit-1",
  version: 1,
  confirmedById: "nurse-1",
  confirmedAt: new Date("2026-09-23T11:20:00.000Z"),
  snapshot,
};

describe("확정본 hash", () => {
  it("키 순서와 상관없이 같은 값이면 같은 JSON이다(jsonb를 거쳐도)", () => {
    assert.equal(
      canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }),
      canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }),
    );
    assert.equal(canonicalJson({ a: undefined, b: 1 }), '{"b":1}');
  });

  it("같은 확정본이면 같은 hash, 값·차수·확정자가 바뀌면 다른 hash다", () => {
    const hash = recordVersionHash(base);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(recordVersionHash({ ...base }), hash);
    assert.notEqual(recordVersionHash({ ...base, version: 2 }), hash);
    assert.notEqual(
      recordVersionHash({ ...base, confirmedById: "nurse-2" }),
      hash,
    );
    const edited: VisitRecordSnapshot = {
      ...snapshot,
      forms: { HOME_CARE_NURSE: { care: [{ value: "wound" }], notes: null } },
    };
    assert.notEqual(recordVersionHash({ ...base, snapshot: edited }), hash);
  });

  it("확정본에는 이 방문의 서식만 서식 순서대로 담는다", () => {
    const result = toRecordSnapshot(
      {
        program: "HOME_CARE_CENTER",
        profession: "DOCTOR",
        staffId: "doctor-1",
        formIds: ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
        startedAt: null,
        endedAt: null,
      },
      {
        HOME_CARE_DOCTOR: { notes: "b" },
        PRIMARY_CARE_CHECK: { plan: "a" },
        HOME_CARE_NURSE: { notes: "뺀 서식" },
      },
      headerRow,
    );
    assert.deepEqual(Object.keys(result.forms), [
      "PRIMARY_CARE_CHECK",
      "HOME_CARE_DOCTOR",
    ]);
    assert.equal(result.startedAt, null);
    // 서식 머리는 확정 당시 값으로 담는다(날짜 열은 YYYY-MM-DD).
    assert.deepEqual(result.header, snapshot.header);
  });

  it("서식 머리(수급자 주소 등)가 바뀌어도 해시로 드러난다", () => {
    const moved = {
      ...snapshot,
      header: {
        ...snapshot.header,
        recipient: { ...snapshot.header.recipient, address: "다른 주소" },
      },
    };
    assert.notEqual(
      recordVersionHash({ ...base, snapshot: moved }),
      recordVersionHash(base),
    );
  });
});

describe("확정 전 필수 칸", () => {
  it("비어 있는 필수 칸을 서식별로 찾고 첫 서식을 문구로 알린다", () => {
    const missing = findMissingRequired(
      ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
      {
        PRIMARY_CARE_CHECK: {
          appointment: { value: "scheduled" },
          visitReason: [],
          treatment: null,
        },
        HOME_CARE_DOCTOR: {},
      },
    );
    assert.deepEqual(
      missing.map(({ formId, fields }) => [
        formId,
        fields.map((field) => field.key),
      ]),
      [
        ["PRIMARY_CARE_CHECK", ["visitReason", "treatment"]],
        ["HOME_CARE_DOCTOR", ["visitReason", "consultation"]],
      ],
    );
    assert.equal(
      missingRequiredMessage(missing),
      "방문진료 점검서식의 방문진료사유, 진료 및 조치 내용을 채워 주세요. 다른 서식 1개에도 빈 필수 칸이 있습니다.",
    );
  });

  it("필수 칸을 다 채웠으면 없다", () => {
    assert.deepEqual(
      findMissingRequired(["HOME_CARE_NURSE"], {
        HOME_CARE_NURSE: { care: [{ value: "vital" }] },
      }),
      [],
    );
    assert.equal(missingRequiredMessage([]), "");
  });
});
