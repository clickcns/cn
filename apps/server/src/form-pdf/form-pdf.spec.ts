import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  cleanLayoutAdjustments,
  FORMS,
  FORMS_WITH_ORIGINAL_PDF,
  formFields,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import { PDFDocument } from "pdf-lib";
import {
  buildLayoutPreviewPdf,
  buildNurseMonthPdf,
  buildVisitPdf,
} from "./build.js";
import { renderPdf } from "./pdf-draw.js";
import { describeLayout } from "./overlay/describe.js";
import {
  addNurseMonthPages,
  planNursePages,
} from "./overlay/home-care-nurse.js";
import { placement, slotId, type Placement } from "./overlay/layout.js";
import { OVERLAY_LAYOUTS } from "./overlay/layouts.js";
import { addOverlayPage } from "./overlay/render.js";
import {
  fullFormData,
  layoutPreviewRecords,
  sampleRecord,
} from "./sample-records.js";

async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

interface PlacementCall {
  method: keyof Placement;
  id: string;
  /** 그리는 코드의 기본값(자리·글자 모양·표시 크기) */
  base: unknown;
}

/** 조정 없는 Placement 가 받은 부름(칸 ID와 기본값)을 모은다. */
function recordingPlacement(calls: PlacementCall[]): Placement {
  const base = placement();
  const seen = <T>(method: keyof Placement, id: string, value: T): T => {
    calls.push({ method, id, base: value });
    return value;
  };
  return {
    rect: (id, value) => base.rect(id, seen("rect", id, value)),
    point: (id, value) => base.point(id, seen("point", id, value)),
    style: (id, value) => base.style(id, seen("style", id, value)),
    markSize: (id, value) => base.markSize(id, seen("markSize", id, value)),
  };
}

/** 조정 화면 표본(모든 칸·선택지를 채움)을 그리며 Placement 에 물은 것. */
async function drawnCalls(formId: OriginalPdfFormId): Promise<PlacementCall[]> {
  const calls: PlacementCall[] = [];
  const place = recordingPlacement(calls);
  const records = layoutPreviewRecords(formId);
  await renderPdf("테스트", (doc, fonts) =>
    formId === "HOME_CARE_NURSE"
      ? addNurseMonthPages(doc, fonts, records, "출력", place)
      : addOverlayPage(doc, fonts, OVERLAY_LAYOUTS[formId], records[0], place),
  );
  return calls;
}

describe("원본 서식 자리", () => {
  it("서식 정의의 모든 칸·선택지(괄호 포함)에 원본 자리가 있고 칸 ID는 겹치지 않는다", () => {
    for (const formId of FORMS_WITH_ORIGINAL_PDF) {
      const { items, ids } = describeLayout(formId);
      assert.equal(ids.size, items.length, `${formId} ID 겹침`);
      const drawnFields = new Set(items.flatMap((item) => item.fields ?? []));
      const missing: string[] = [];
      for (const field of formFields(FORMS[formId])) {
        if (field.type !== "single" && field.type !== "multi") {
          if (!ids.has(field.key) && !drawnFields.has(field.key)) {
            missing.push(field.key);
          }
          continue;
        }
        for (const option of field.options) {
          const id = slotId.option(field.key, option.value);
          if (!ids.has(id)) missing.push(id);
          else if (
            option.detail &&
            !ids.has(slotId.detail(id)) &&
            ![...ids].some((other) => other.startsWith(`${id}:`))
          ) {
            missing.push(`${id}(괄호)`);
          }
        }
      }
      assert.deepEqual(missing, [], formId);
    }
  });

  it("그리는 코드가 쓰는 칸 ID는 모두 조정 화면 칸 목록에 있다(조정이 버려지지 않는다)", async () => {
    for (const formId of FORMS_WITH_ORIGINAL_PDF) {
      const { ids } = describeLayout(formId);
      const drawn = new Set((await drawnCalls(formId)).map((call) => call.id));
      assert.deepEqual(
        [...drawn].filter((id) => !ids.has(id)),
        [],
        formId,
      );
      // 표본에서 고르지 않은 괄호 안 선택지(○ 하나만 고를 수 있다) 말고는 모두 그려 본다.
      assert.deepEqual(
        [...ids].filter(
          (id) => !drawn.has(id) && !/\.[A-Z_0-9]+:[A-Z_0-9]+$/.test(id),
        ),
        [],
        formId,
      );
    }
  });

  it("그리는 코드의 기본 자리·글자 모양·표시 크기는 조정 화면 칸 목록과 같다", async () => {
    for (const formId of FORMS_WITH_ORIGINAL_PDF) {
      const items = new Map(
        describeLayout(formId).items.map((item) => [item.id, item]),
      );
      const wrong = new Set<string>();
      for (const { method, id, base } of await drawnCalls(formId)) {
        const item = items.get(id);
        if (!item) continue;
        // 표시 칸은 자리·표시 크기만, 글 칸은 칸·글자 모양만 묻는다(size 뜻이 섞이지 않게).
        const expected: Partial<Record<keyof Placement, unknown>> =
          item.kind === "mark"
            ? { point: item.point, markSize: item.markSize }
            : { rect: item.rect, style: item.style };
        if (!isDeepStrictEqual(base, expected[method])) {
          wrong.add(`${id} ${method}`);
        }
      }
      assert.deepEqual([...wrong], [], formId);
    }
  });
});

describe("서식 PDF 만들기", () => {
  it("원본 서식은 서식마다 한 장, 원본이 없는 서식(제14호)은 표준 서식으로 그린다", async () => {
    const doctor = await buildVisitPdf(
      [sampleRecord("PRIMARY_CARE_CHECK"), sampleRecord("HOME_CARE_DOCTOR")],
      "original",
      "테스트",
    );
    assert.equal(await pageCount(doctor), 2);
    const nursing = await buildVisitPdf(
      [sampleRecord("LTC_NURSING")],
      "original",
      "테스트",
    );
    assert.equal(await pageCount(nursing), 1);
  });

  it("글꼴은 쓴 글자만 넣는다(표준 서식 한 장이 100KB를 넘지 않는다)", async () => {
    const bytes = await buildVisitPdf(
      [sampleRecord("HOME_CARE_SOCIAL")],
      "standard",
      "테스트",
    );
    assert.ok(bytes.length < 100_000, `${bytes.length} bytes`);
  });

  it("제7호 월간 기록지는 정기 방문이 2건을 넘으면 다음 장에 적는다", async () => {
    const records = ["REGULAR", "ADDITIONAL", "REGULAR", "REGULAR"].map(
      (visitType, i) =>
        sampleRecord("HOME_CARE_NURSE", {
          data: {
            ...fullFormData("HOME_CARE_NURSE"),
            visitType: { value: visitType },
          },
          visitDate: `2026-09-0${i + 1}`,
        }),
    );
    assert.equal(
      await pageCount(await buildNurseMonthPdf(records, "테스트", "출력")),
      2,
    );
  });
});

describe("제7호 칸 나누기", () => {
  const visit = (visitType: string | null, day: number) =>
    sampleRecord("HOME_CARE_NURSE", {
      data: {
        ...fullFormData("HOME_CARE_NURSE"),
        visitType: visitType ? { value: visitType } : null,
      },
      visitDate: `2026-09-${String(day).padStart(2, "0")}`,
    });
  const layout = (records: ReturnType<typeof visit>[]) =>
    planNursePages(records).map((page) =>
      page.map(
        ({ column, record }) => `${column}:${record.visitDate.slice(8)}`,
      ),
    );

  it("정기는 1~2번 칸, 추가는 3~5번 칸에 날짜순으로 채우고 넘치면 다음 장으로 이어 간다", () => {
    const records = [
      visit("REGULAR", 1),
      visit("ADDITIONAL", 3),
      visit("REGULAR", 8),
      visit("ADDITIONAL", 10),
      visit("ADDITIONAL", 15),
      visit("REGULAR", 22),
      visit("ADDITIONAL", 29),
    ];
    assert.deepEqual(layout(records), [
      ["0:01", "1:08", "2:03", "3:10", "4:15"],
      ["0:22", "2:29"],
    ]);
  });

  it("방문 한 건은 정기면 1번 칸, 추가면 3번 칸이고, 방문사유가 비어 있으면 정기로 본다", () => {
    assert.deepEqual(layout([visit("REGULAR", 5)]), [["0:05"]]);
    assert.deepEqual(layout([visit("ADDITIONAL", 5)]), [["2:05"]]);
    assert.deepEqual(layout([visit(null, 5)]), [["0:05"]]);
  });
});

describe("원본 서식 조정", () => {
  it("조정은 칸을 옮기고 넓히며(최소 2pt), 페이지 전체 옮기기를 더한다", () => {
    const place = placement({
      page: { dx: 1, dy: -1 },
      items: { a: { dx: 2, dy: 3, dw: -100 }, b: { size: 11, bold: true } },
    });
    assert.deepEqual(place.rect("a", { x0: 10, y0: 10, x1: 20, y1: 20 }), {
      x0: 13,
      y0: 12,
      x1: 15,
      y1: 22,
    });
    assert.deepEqual(place.point("c", { x: 5, y: 5 }), { x: 6, y: 4 });
    assert.deepEqual(
      place.style("b", { size: 9, bold: false, align: "right" }),
      { size: 11, bold: true, align: "right" },
    );
    // 표시 칸의 size 는 표시 크기다.
    assert.equal(place.markSize("b", 9), 11);
    assert.equal(place.markSize("c", 9), 9);
  });

  it("저장할 때 0.1pt로 반올림하고, 바뀐 것이 없는 값·칸은 빼고, 칸 ID 순으로 늘어놓는다", () => {
    const clean = cleanLayoutAdjustments({
      page: { dx: 0, dy: 0.04 },
      items: { z: { dy: 2 }, a: { dx: 1.26, dy: 0 }, b: { dx: 0.01 } },
    });
    assert.deepEqual(clean, { items: { a: { dx: 1.3 }, z: { dy: 2 } } });
    assert.deepEqual(Object.keys(clean.items), ["a", "z"]);
  });

  it("조정한 자리로 표본 PDF를 그린다(제7호는 다섯 칸을 한 장에)", async () => {
    const bytes = await buildLayoutPreviewPdf("HOME_CARE_NURSE", {
      page: { dx: 1, dy: 1 },
      items: { "col.day": { dx: 3, size: 10, bold: true } },
    });
    assert.equal(await pageCount(bytes), 1);
  });
});
