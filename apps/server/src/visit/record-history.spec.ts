import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeRecordCursor,
  encodeRecordCursor,
  FORMS,
  formFields,
  latestFieldValues,
  latestFieldValuesByForm,
  notReusedLabels,
  RecipientRecordQuerySchema,
  reusableFieldValue,
  reusableValues,
  sanitizeFieldValue,
  type FormId,
  type RecipientRecord,
  type VisitForms,
} from "@repo/shared-types";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { recordHistoryWhere, visibleRecordWhere } from "./record-history.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "nurse-1",
    username: "nurse1",
    name: "이간호",
    role: "STAFF",
    profession: "NURSE",
    organizationId: "org-1",
    sessionId: "session-1",
    ...overrides,
  };
}

describe("지난 기록 조회 조건", () => {
  it("확정 기록은 작성자와 상관없이, 작성 중 기록은 본인 것만", () => {
    assert.deepEqual(visibleRecordWhere("nurse-1"), {
      OR: [{ status: "CONFIRMED" }, { status: "DRAFT", staffId: "nurse-1" }],
    });
  });

  it("기관 범위: 현장 직원·기관 관리자는 자기 기관, 운영자는 모든 기관", () => {
    const staff = recordHistoryWhere({ actor: actor(), recipientId: "r-1" });
    assert.equal(staff.organizationId, "org-1");
    assert.equal(staff.recipientId, "r-1");
    assert.deepEqual(staff.AND, [visibleRecordWhere("nurse-1")]);
    const admin = recordHistoryWhere({
      actor: actor({ role: "ADMIN", organizationId: null }),
      recipientId: "r-1",
    });
    assert.equal(admin.organizationId, undefined);
  });

  it("기준 방문보다 앞선(같은 시각 포함) 다른 방문, 그리고 cursor 다음부터", () => {
    const at = new Date("2026-09-24T00:30:00.000Z");
    const where = recordHistoryWhere({
      actor: actor(),
      recipientId: "r-1",
      anchor: { id: ID_A, scheduledAt: at },
      cursor: { id: ID_B, scheduledAt: at },
    });
    assert.deepEqual(where.AND, [
      visibleRecordWhere("nurse-1"),
      { scheduledAt: { lte: at }, id: { not: ID_A } },
      {
        OR: [
          { scheduledAt: { lt: at } },
          { scheduledAt: at, id: { lt: ID_B } },
        ],
      },
    ]);
  });
});

describe("지난 기록 cursor·조회값", () => {
  it("cursor 는 방문 일시와 id 를 오가고, 잘못된 값은 null", () => {
    const scheduledAt = "2026-09-24T00:30:00.000Z";
    const cursor = encodeRecordCursor({ scheduledAt, id: ID_A });
    assert.deepEqual(decodeRecordCursor(cursor), {
      scheduledAt: new Date(scheduledAt),
      id: ID_A,
    });
    assert.equal(decodeRecordCursor("abc"), null);
    assert.equal(decodeRecordCursor(`not-a-date_${ID_A}`), null);
    assert.equal(decodeRecordCursor(`${scheduledAt}_not-uuid`), null);
  });

  it("limit 는 기본 10·최대 30, cursor 는 형식을 검사한다", () => {
    assert.equal(RecipientRecordQuerySchema.parse({}).limit, 10);
    assert.equal(RecipientRecordQuerySchema.parse({ limit: "5" }).limit, 5);
    assert.equal(
      RecipientRecordQuerySchema.safeParse({ limit: "31" }).success,
      false,
    );
    assert.equal(
      RecipientRecordQuerySchema.safeParse({ cursor: "abc" }).success,
      false,
    );
  });
});

const LTC = FORMS.LTC_NURSING;
const field = (formId: FormId, key: string) =>
  formFields(FORMS[formId]).find((f) => f.key === key)!;

describe("지난 값 정리(지금 서식 정의에 맞게)", () => {
  it("모르는 선택지는 버리고, 중복은 한 번, 괄호 내용은 항목 종류에 맞는 것만", () => {
    const nursingCare = field("LTC_NURSING", "nursingCare");
    assert.deepEqual(
      sanitizeFieldValue(nursingCare, [
        { value: "PRESSURE_ULCER", minutes: 15, note: "천골", detail: "x" },
        { value: "PRESSURE_ULCER", minutes: 10 },
        { value: "REMOVED_OPTION" },
        "garbage",
      ]),
      [{ value: "PRESSURE_ULCER", minutes: 15, note: "천골" }],
    );
    const content = field("HOME_CARE_SOCIAL", "content");
    assert.deepEqual(
      sanitizeFieldValue(content, [
        { value: "LINK_PROVIDED", detail: "INFO" },
        { value: "OTHER", detail: "야간 돌봄" },
      ]),
      [
        { value: "LINK_PROVIDED", detail: "INFO" },
        { value: "OTHER", detail: "야간 돌봄" },
      ],
    );
    assert.deepEqual(
      sanitizeFieldValue(content, [{ value: "LINK_PROVIDED", detail: "GONE" }]),
      [{ value: "LINK_PROVIDED" }],
    );
    assert.equal(
      sanitizeFieldValue(field("HOME_CARE_NURSE", "plan"), {
        value: "REMOVED",
      }),
      null,
    );
  });

  it("숫자는 범위·자릿수를 지킨 것만, 글은 빈 글이 아닌 것만", () => {
    const temperature = field("LTC_NURSING", "temperature");
    assert.equal(sanitizeFieldValue(temperature, 36.5), 36.5);
    assert.equal(sanitizeFieldValue(temperature, 36.55), null);
    assert.equal(sanitizeFieldValue(temperature, 99), null);
    const note = field("LTC_NURSING", "specialNote");
    assert.equal(sanitizeFieldValue(note, "  "), null);
    assert.equal(sanitizeFieldValue(note, "식사량 줄어듦"), "식사량 줄어듦");
  });
});

describe("다시 쓸 값", () => {
  it("방문마다 새로 정하는 칸은 빼고, 제공 시간은 지우고 메모는 둔다", () => {
    assert.equal(
      reusableFieldValue(field("LTC_NURSING", "systolic"), 130),
      null,
    );
    assert.equal(
      reusableFieldValue(field("HOME_CARE_NURSE", "visitType"), {
        value: "REGULAR",
      }),
      null,
    );
    const data = {
      systolic: 130,
      diastolic: 80,
      nursingCare: [{ value: "PRESSURE_ULCER", minutes: 15, note: "천골" }],
      specialNote: "식사량 줄어듦",
      nextPlan: "",
    };
    assert.deepEqual(reusableValues(formFields(LTC), data), {
      nursingCare: [{ value: "PRESSURE_ULCER", note: "천골" }],
      specialNote: "식사량 줄어듦",
    });
    const lastSection = LTC.sections.at(-1)!;
    assert.deepEqual(reusableValues(lastSection.fields, data), {
      specialNote: "식사량 줄어듦",
    });
  });

  it("불러오지 않는 것 안내: 방문마다 새로 정하는 칸(숫자 짝은 짝 이름)과 제공 시간", () => {
    assert.deepEqual(notReusedLabels(LTC), [
      "혈압",
      "맥박",
      "체온",
      "호흡",
      "혈당",
      "제공 시간",
    ]);
    assert.deepEqual(notReusedLabels(FORMS.HOME_CARE_SOCIAL), [
      "상담방법",
      "상담구분",
    ]);
  });
});

function record(
  id: string,
  date: string,
  forms: VisitForms,
  status: RecipientRecord["status"] = "CONFIRMED",
): RecipientRecord {
  return {
    id,
    organizationId: "org-1",
    status,
    program: "LTC_NURSING",
    profession: "NURSE",
    scheduledAt: `${date}T01:00:00.000Z`,
    startedAt: null,
    endedAt: null,
    confirmedAt: null,
    staff: { id: "nurse-1", name: "이간호", profession: "NURSE" },
    formIds: Object.keys(forms) as FormId[],
    forms,
  };
}

describe("칸마다 지난 값", () => {
  it("가장 최근 값, 비어 있으면 앞 기록에서, 숫자 짝은 한 기록에서 함께", () => {
    const records = [
      record(
        "v3",
        "2026-09-24",
        { LTC_NURSING: { systolic: 128, specialNote: "" } },
        "DRAFT",
      ),
      record("v2", "2026-09-17", {
        LTC_NURSING: { systolic: 120, diastolic: 70, specialNote: "안정" },
      }),
      record("v1", "2026-09-10", {
        LTC_NURSING: { pulse: 72, nextPlan: "다음 주 화요일" },
      }),
      record("other", "2026-09-09", { HOME_CARE_NURSE: { pulse: 99 } }),
    ];
    const past = latestFieldValues(records, "LTC_NURSING");
    assert.equal(past.systolic?.value, 128);
    assert.equal(past.systolic?.draft, true);
    assert.equal(past.systolic?.date, "2026-09-24");
    // 혈압 짝은 수축기만 있는 최근 기록에서 함께 가져오므로 이완기는 비어 있다.
    assert.equal(past.diastolic, undefined);
    assert.equal(past.specialNote?.value, "안정");
    assert.equal(past.specialNote?.date, "2026-09-17");
    assert.equal(past.pulse?.value, 72);
    assert.equal(past.nextPlan?.value, "다음 주 화요일");
    assert.deepEqual(Object.keys(latestFieldValuesByForm(records)).sort(), [
      "HOME_CARE_NURSE",
      "LTC_NURSING",
    ]);
    assert.deepEqual(latestFieldValues([], "LTC_NURSING"), {});
  });
});

describe("서식 정의: 방문마다 새로 정하는 칸", () => {
  it("이월 칸과 함께 쓰지 않는다", () => {
    for (const form of Object.values(FORMS)) {
      for (const f of formFields(form)) {
        assert.ok(!(f.carryOver && f.visitSpecific), `${form.id} ${f.key}`);
      }
    }
  });
});
