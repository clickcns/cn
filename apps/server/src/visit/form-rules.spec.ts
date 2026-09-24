import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkRecipientPrograms,
  CreateRecipientSchema,
  keepDraftForms,
  resolveFormIds,
  selectForms,
  UpdateRecipientSchema,
} from "@repo/shared-types";

describe("selectForms", () => {
  it("보내지 않으면 필수 서식과 미리 켜 둔 선택 서식을 쓴다", () => {
    assert.deepEqual(selectForms("HOME_CARE_CENTER", "DOCTOR"), {
      ok: true,
      formIds: ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
    });
    assert.deepEqual(resolveFormIds("PRIMARY_CARE", "DOCTOR"), [
      "PRIMARY_CARE_CHECK",
    ]);
  });

  it("선택 서식을 빼면 필수 서식만 남는다", () => {
    assert.deepEqual(
      selectForms("HOME_CARE_CENTER", "DOCTOR", ["HOME_CARE_DOCTOR"]),
      { ok: true, formIds: ["HOME_CARE_DOCTOR"] },
    );
  });

  it("고른 순서와 상관없이 규칙 순서로 정리하고 중복을 없앤다", () => {
    assert.deepEqual(
      selectForms("HOME_CARE_CENTER", "DOCTOR", [
        "HOME_CARE_DOCTOR",
        "PRIMARY_CARE_CHECK",
        "HOME_CARE_DOCTOR",
      ]),
      { ok: true, formIds: ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"] },
    );
  });

  it("필수 서식을 빼면 실패한다", () => {
    const result = selectForms("HOME_CARE_CENTER", "DOCTOR", [
      "PRIMARY_CARE_CHECK",
    ]);
    assert.equal(result.ok, false);
    assert.match(
      !result.ok ? result.message : "",
      /방문점검 기록지\(의사\)는 필수 서식/,
    );
  });

  it("그 사업·직종이 쓰지 않는 서식이 섞이면 실패한다", () => {
    const result = selectForms("HOME_CARE_CENTER", "NURSE", [
      "HOME_CARE_NURSE",
      "HOME_CARE_DOCTOR",
    ]);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.message : "", /쓰지 않는 서식/);
  });

  it("맡을 수 없는 사업이면 실패한다", () => {
    const result = selectForms("PRIMARY_CARE", "NURSE");
    assert.equal(result.ok, false);
    assert.match(
      !result.ok ? result.message : "",
      /간호사는 일차의료 방문진료 방문을 맡을 수 없습니다/,
    );
    assert.equal(selectForms("LTC_NURSING", null).ok, false);
  });
});

describe("checkRecipientPrograms", () => {
  it("일차의료 방문진료는 장기요양등급이 없어도 된다", () => {
    assert.equal(checkRecipientPrograms(["PRIMARY_CARE"], null), null);
  });

  it("재택의료센터·방문간호는 장기요양등급이 있어야 한다", () => {
    assert.match(
      checkRecipientPrograms(["HOME_CARE_CENTER", "LTC_NURSING"], null) ?? "",
      /재택의료센터·장기요양 방문간호는 장기요양등급/,
    );
    assert.equal(checkRecipientPrograms(["LTC_NURSING"], "COGNITIVE"), null);
  });

  it("재택의료센터와 일차의료 방문진료는 함께 등록하지 않는다", () => {
    assert.match(
      checkRecipientPrograms(["HOME_CARE_CENTER", "PRIMARY_CARE"], "1") ?? "",
      /별지 제4호를 함께/,
    );
    assert.equal(
      checkRecipientPrograms(["HOME_CARE_CENTER", "LTC_NURSING"], "1"),
      null,
    );
  });
});

describe("수급자 스키마의 등록 사업 규칙", () => {
  it("등록할 때 등급을 보내지 않으면 등급 없음으로 본다", () => {
    const result = CreateRecipientSchema.safeParse({
      name: "홍길순",
      programs: ["HOME_CARE_CENTER"],
    });
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ["programs"]);
  });

  it("등록할 때는 등록 사업이 하나 이상, 수정할 때는 비워도 된다", () => {
    const empty = CreateRecipientSchema.safeParse({
      name: "홍길순",
      programs: [],
    });
    assert.equal(empty.success, false);
    assert.match(empty.error?.issues[0]?.message ?? "", /하나 이상/);
    assert.equal(
      UpdateRecipientSchema.safeParse({ programs: [], careGrade: null })
        .success,
      true,
    );
  });

  it("수정은 두 칸이 모두 올 때만 스키마에서 본다(한쪽만 오면 서버가 합쳐 본다)", () => {
    assert.equal(
      UpdateRecipientSchema.safeParse({ programs: ["HOME_CARE_CENTER"] })
        .success,
      true,
    );
    assert.equal(
      UpdateRecipientSchema.safeParse({
        programs: ["HOME_CARE_CENTER"],
        careGrade: "",
      }).success,
      false,
    );
  });
});

describe("resolveFormIds", () => {
  it("화면에서 끈 선택 서식은 빠지고 필수 서식은 끌 수 없다", () => {
    assert.deepEqual(
      resolveFormIds("HOME_CARE_CENTER", "DOCTOR", {
        PRIMARY_CARE_CHECK: false,
        HOME_CARE_DOCTOR: false,
      }),
      ["HOME_CARE_DOCTOR"],
    );
  });

  it("선택 서식을 끈 기록은 다른 사업의 필수 서식에 영향이 없다", () => {
    assert.deepEqual(
      resolveFormIds("PRIMARY_CARE", "DOCTOR", { PRIMARY_CARE_CHECK: false }),
      ["PRIMARY_CARE_CHECK"],
    );
  });
});

describe("keepDraftForms", () => {
  it("뺀 서식의 초안 값·검사 결과·되묻기 칸을 지운다", () => {
    const kept = keepDraftForms(
      {
        draft: {
          PRIMARY_CARE_CHECK: { values: {}, evidence: {} },
          HOME_CARE_DOCTOR: { values: {}, evidence: {} },
        },
        issues: [
          {
            field: "PRIMARY_CARE_CHECK.plan",
            severity: "removed",
            message: "a",
          },
          { field: "HOME_CARE_DOCTOR.plan", severity: "check", message: "b" },
        ],
        questions: [
          {
            fields: ["PRIMARY_CARE_CHECK.plan", "HOME_CARE_DOCTOR.plan"],
            question: "향후 계획은?",
          },
          { fields: ["PRIMARY_CARE_CHECK.treatment"], question: "진료는?" },
        ],
      },
      ["HOME_CARE_DOCTOR"],
    );
    assert.deepEqual(Object.keys(kept.draft), ["HOME_CARE_DOCTOR"]);
    assert.deepEqual(
      kept.issues.map((issue) => issue.field),
      ["HOME_CARE_DOCTOR.plan"],
    );
    assert.deepEqual(kept.questions, [
      { fields: ["HOME_CARE_DOCTOR.plan"], question: "향후 계획은?" },
    ]);
  });
});
