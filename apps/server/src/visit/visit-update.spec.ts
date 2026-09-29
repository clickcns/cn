import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choicesForNewStaff,
  formChoicesFor,
  formIdsForNewStaff,
  formRulesFor,
  UpdateVisitSchema,
  visitProfession,
} from "@repo/shared-types";
import {
  planVisitUpdate,
  type VisitUpdateStaff,
  type VisitUpdateTarget,
} from "./visit-update.js";

const AT = "2026-09-24T09:00:00+09:00";

function target(overrides: Partial<VisitUpdateTarget> = {}): VisitUpdateTarget {
  return {
    status: "SCHEDULED",
    program: "HOME_CARE_CENTER",
    organizationId: "org-1",
    staffId: "doctor-1",
    scheduledAt: new Date(AT),
    formIds: ["HOME_CARE_DOCTOR"],
    hasDictation: false,
    currentProfession: "DOCTOR",
    ...overrides,
  };
}

const nurse: VisitUpdateStaff = {
  role: "STAFF",
  profession: "NURSE",
  isActive: true,
  organizationId: "org-1",
};
const doctor: VisitUpdateStaff = { ...nurse, profession: "DOCTOR" };

function parse(input: unknown) {
  return UpdateVisitSchema.parse(input);
}

describe("planVisitUpdate: 일정", () => {
  it("확정 전 방문은 일정을 옮긴다", () => {
    const plan = planVisitUpdate(
      target({ status: "DRAFT" }),
      parse({ scheduledAt: "2026-09-25T09:00:00+09:00" }),
      null,
    );
    assert.deepEqual(plan, {
      ok: true,
      data: { scheduledAt: new Date("2026-09-25T09:00:00+09:00") },
    });
  });

  it("확정 방문은 409", () => {
    const plan = planVisitUpdate(
      target({ status: "CONFIRMED" }),
      parse({ scheduledAt: "2026-09-25T09:00:00+09:00" }),
      null,
    );
    assert.equal(plan.ok, false);
    assert.equal(!plan.ok && plan.kind, "conflict");
  });

  it("화면이 본 일시와 다르면 409, 같은 일시면 바뀌는 것 없음", () => {
    const stale = planVisitUpdate(
      target(),
      parse({
        scheduledAt: "2026-09-26T09:00:00+09:00",
        expectedScheduledAt: "2026-09-23T09:00:00+09:00",
      }),
      null,
    );
    assert.equal(!stale.ok && stale.kind, "conflict");

    const same = planVisitUpdate(target(), parse({ scheduledAt: AT }), null);
    assert.deepEqual(same, { ok: true, data: {} });
  });
});

describe("planVisitUpdate: 담당자", () => {
  it("다른 직종으로 넘기면 새 직종 서식으로 바꾼다", () => {
    const plan = planVisitUpdate(
      target(),
      parse({ staffId: "11111111-1111-4111-8111-111111111111" }),
      nurse,
    );
    assert.deepEqual(plan, {
      ok: true,
      data: {
        staffId: "11111111-1111-4111-8111-111111111111",
        formIds: ["HOME_CARE_NURSE"],
      },
    });
  });

  it("같은 직종이면 켜고 끈 선택 서식을 잇는다", () => {
    // 제4호를 끈 재택의료 의사 방문 → 다른 의사
    const plan = planVisitUpdate(
      target({ formIds: ["HOME_CARE_DOCTOR"] }),
      parse({ staffId: "22222222-2222-4222-8222-222222222222" }),
      doctor,
    );
    assert.equal(plan.ok && plan.data.formIds?.join(), "HOME_CARE_DOCTOR");
  });

  it("작성 중이거나 구술이 있으면 409", () => {
    const staffId = "33333333-3333-4333-8333-333333333333";
    const draft = planVisitUpdate(
      target({ status: "DRAFT" }),
      parse({ staffId }),
      nurse,
    );
    assert.equal(!draft.ok && draft.kind, "conflict");
    const dictated = planVisitUpdate(
      target({ hasDictation: true }),
      parse({ staffId }),
      nurse,
    );
    assert.equal(!dictated.ok && dictated.kind, "conflict");
  });

  it("다른 기관·비활성·직종 없음·맡을 수 없는 직종은 400", () => {
    const staffId = "44444444-4444-4444-8444-444444444444";
    const cases: VisitUpdateStaff[] = [
      { ...nurse, organizationId: "org-2" },
      { ...nurse, isActive: false },
      { ...nurse, profession: null },
    ];
    for (const staff of cases) {
      const plan = planVisitUpdate(target(), parse({ staffId }), staff);
      assert.equal(!plan.ok && plan.kind, "invalid");
    }
    // 장기요양 방문간호는 간호사만 맡는다
    const ltc = planVisitUpdate(
      target({
        program: "LTC_NURSING",
        formIds: ["LTC_NURSING"],
        currentProfession: "NURSE",
      }),
      parse({ staffId }),
      { ...nurse, profession: "SOCIAL_WORKER" },
    );
    assert.equal(!ltc.ok && ltc.kind, "invalid");
  });
});

describe("담당자 바꿀 때 서식과 방문 직종", () => {
  it("간호사 방문을 의사에게 넘기면 제4호가 기본으로 켜진다", () => {
    assert.deepEqual(
      formIdsForNewStaff(
        "HOME_CARE_CENTER",
        ["HOME_CARE_NURSE"],
        "NURSE",
        "DOCTOR",
      ),
      ["PRIMARY_CARE_CHECK", "HOME_CARE_DOCTOR"],
    );
  });

  it("같은 직종끼리 넘기면 끈 선택 서식도 그대로 잇는다", () => {
    assert.deepEqual(
      choicesForNewStaff(
        "HOME_CARE_CENTER",
        ["HOME_CARE_DOCTOR"],
        "DOCTOR",
        "DOCTOR",
      ),
      { PRIMARY_CARE_CHECK: false },
    );
    assert.deepEqual(
      formIdsForNewStaff(
        "HOME_CARE_CENTER",
        ["HOME_CARE_DOCTOR"],
        "DOCTOR",
        "DOCTOR",
      ),
      ["HOME_CARE_DOCTOR"],
    );
  });

  it("서식 목록을 규칙의 켜고 끈 상태로 바꾼다", () => {
    assert.deepEqual(
      formChoicesFor(formRulesFor("HOME_CARE_CENTER", "DOCTOR"), [
        "HOME_CARE_DOCTOR",
      ]),
      { PRIMARY_CARE_CHECK: false, HOME_CARE_DOCTOR: true },
    );
  });

  it("방문의 필수 서식으로 직종을 판정한다", () => {
    assert.equal(
      visitProfession("HOME_CARE_CENTER", [
        "PRIMARY_CARE_CHECK",
        "HOME_CARE_DOCTOR",
      ]),
      "DOCTOR",
    );
    assert.equal(
      visitProfession("HOME_CARE_CENTER", ["HOME_CARE_SOCIAL"]),
      "SOCIAL_WORKER",
    );
    assert.equal(visitProfession("LTC_NURSING", ["LTC_NURSING"]), "NURSE");
    assert.equal(visitProfession("PRIMARY_CARE", []), null);
  });
});

describe("UpdateVisitSchema", () => {
  it("바꿀 내용이 없거나 담당자 없이 서식만 보내면 거절한다", () => {
    assert.ok(!UpdateVisitSchema.safeParse({}).success);
    assert.ok(
      !UpdateVisitSchema.safeParse({ formIds: ["HOME_CARE_NURSE"] }).success,
    );
    assert.ok(UpdateVisitSchema.safeParse({ scheduledAt: AT }).success);
  });
});
