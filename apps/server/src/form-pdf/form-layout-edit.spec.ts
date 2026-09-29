import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignItems,
  createHistory,
  EMPTY_LAYOUT_ADJUSTMENTS,
  historyApply,
  historyBegin,
  historyCancel,
  historyCommit,
  historyRedo,
  historyUndo,
  itemInstanceRects,
  itemRect,
  nextSelection,
  markSizeAdjustment,
  normalizeItemAdjustment,
  patchLayoutItems,
  shiftAdjustment,
  snapToLines,
  type FormLayoutAdjustments,
  type FormLayoutItem,
} from "@repo/shared-types";

const style = { size: 9, bold: false, align: "left" } as const;
const text = (
  id: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): FormLayoutItem => ({
  id,
  label: id,
  group: "g",
  kind: "text",
  rect: { x0, y0, x1, y1 },
  style,
});
const mark = (id: string, x: number, y: number): FormLayoutItem => ({
  id,
  label: id,
  group: "g",
  kind: "mark",
  point: { x, y },
  markSize: 9,
});
const none = EMPTY_LAYOUT_ADJUSTMENTS;

describe("원본 서식 조정 편집 — 맞춤", () => {
  const a = text("a", 10, 10, 50, 20);
  const b = text("b", 30, 40, 60, 55);
  const c = text("c", 100, 70, 120, 80);

  it("왼쪽·가운데·아래 맞춤은 첫째 칸을 기준으로 나머지를 옮긴다", () => {
    assert.deepEqual(alignItems([a, b, c], none, "left").items, {
      b: { dx: -20 },
      c: { dx: -90 },
    });
    const centered = alignItems([a, b], none, "centerX");
    assert.deepEqual(itemRect(b, centered).x0 + itemRect(b, centered).x1, 60);
    assert.deepEqual(alignItems([b, a], none, "bottom").items, {
      a: { dy: 35 },
    });
  });

  it("같은 너비는 글 칸만 기준 칸 크기로 바꾸고, 표시(□·○)는 그대로 둔다", () => {
    const m = mark("m", 5, 5);
    assert.deepEqual(alignItems([a, b, m], none, "sameWidth").items, {
      b: { dw: 10 },
    });
    // 기준이 표시면 크기를 맞출 수 없다.
    assert.equal(alignItems([m, a], none, "sameWidth"), none);
  });

  it("가로 간격 같게는 양 끝을 두고 사이 칸을 옮긴다(셋 미만이면 그대로)", () => {
    const left = text("l", 0, 0, 10, 5);
    const middle = text("m", 12, 0, 22, 5);
    const right = text("r", 50, 0, 60, 5);
    const spaced = alignItems([middle, right, left], none, "spaceX");
    assert.deepEqual(spaced.items, { m: { dx: 13 } });
    assert.equal(alignItems([left, right], none, "spaceX"), none);
  });

  it("맞출 것이 없으면 같은 객체를 돌려준다(되돌리기 기록을 만들지 않는다)", () => {
    const row = text("x", 10, 40, 20, 50);
    assert.equal(alignItems([a, row], none, "left"), none);
  });
});

describe("원본 서식 조정 편집 — 맞춤선·자리", () => {
  it("가장 가까운 선에 붙고, 한도 밖이면 붙지 않는다", () => {
    const targets = [
      { x0: 100, y0: 0, x1: 140, y1: 10 },
      { x0: 0, y0: 200, x1: 10, y1: 220 },
    ];
    const near = snapToLines({ x0: 97, y0: 50, x1: 117, y1: 60 }, targets, 4);
    assert.deepEqual(near, { dx: 3, dy: 0, guides: { x: 100, y: undefined } });
    const far = snapToLines({ x0: 90, y0: 50, x1: 95, y1: 60 }, targets, 4);
    assert.deepEqual(far, { dx: 0, dy: 0, guides: {} });
  });

  it("크기를 바꿀 때는 오른쪽·아래 가장자리만 맞춘다", () => {
    const targets = [{ x0: 50, y0: 50, x1: 80, y1: 90 }];
    const snapped = snapToLines(
      { x0: 48, y0: 0, x1: 78, y1: 88 },
      targets,
      3,
      true,
    );
    assert.deepEqual(snapped, { dx: 2, dy: 2, guides: { x: 80, y: 90 } });
  });

  it("방문 칸은 다섯 칸 자리로 펼치고, 그 밖의 칸은 한 자리다", () => {
    const column = { ...text("col.day", 10, 0, 20, 5), repeated: true };
    assert.deepEqual(
      itemInstanceRects(column, none, [0, 70, 140]).map((r) => r.x0),
      [10, 80, 150],
    );
    assert.equal(
      itemInstanceRects(text("t", 0, 0, 1, 1), none, [0, 70]).length,
      1,
    );
  });

  it("조정은 0.1pt로 반올림하고 한도 안으로, 글 칸은 2pt보다 작아지지 않게 맞춘다", () => {
    const small = text("s", 0, 0, 10, 5);
    assert.deepEqual(
      normalizeItemAdjustment(small, { dx: 1.26, dw: -50, dy: 999 }),
      {
        dx: 1.3,
        dy: 200,
        dw: -8,
      },
    );
    assert.equal(shiftAdjustment(mark("m", 0, 0), {}, 1, 1, "resize"), null);
  });

  it("표시 크기는 표시 칸만 바꾸고(글 칸은 그대로), 한도 안으로 맞춘다", () => {
    const m = mark("m", 0, 0);
    assert.deepEqual(markSizeAdjustment(m, { dx: 1 }, 30), { dx: 1, size: 24 });
    assert.equal(markSizeAdjustment(text("t", 0, 0, 1, 1), {}, 10), null);
  });

  it("바뀐 칸이 없으면 같은 객체를 돌려준다", () => {
    const adjusted: FormLayoutAdjustments = { items: { a: { dx: 1 } } };
    const a = text("a", 0, 0, 1, 1);
    assert.equal(
      patchLayoutItems(adjusted, [a], () => ({ dx: 1 })),
      adjusted,
    );
    assert.notEqual(
      patchLayoutItems(adjusted, [a], () => ({ dx: 2 })),
      adjusted,
    );
  });
});

describe("원본 서식 조정 편집 — 선택", () => {
  it("바꾸기는 지금 기준 칸이 들어 있으면 그대로 기준으로 둔다", () => {
    assert.deepEqual(nextSelection(["b", "x"], ["a", "b", "c"], "replace"), [
      "b",
      "a",
      "c",
    ]);
    assert.deepEqual(nextSelection(["x"], ["a", "b"], "replace"), ["a", "b"]);
  });

  it("누르기(focus)는 고른 칸이면 여럿 고른 채로 기준으로, 아니면 그 칸만", () => {
    assert.deepEqual(nextSelection(["a", "b"], ["b"], "focus"), ["b", "a"]);
    assert.deepEqual(nextSelection(["a", "b"], ["c"], "focus"), ["c"]);
  });

  it("더하기·넣고 빼기, 바뀐 것이 없으면 같은 배열", () => {
    const current = ["a", "b"];
    assert.deepEqual(nextSelection(current, ["b", "c"], "add"), [
      "a",
      "b",
      "c",
    ]);
    assert.deepEqual(nextSelection(current, ["b"], "toggle"), ["a"]);
    assert.deepEqual(nextSelection(current, ["c"], "toggle"), ["a", "b", "c"]);
    assert.equal(nextSelection(current, ["a"], "focus"), current);
  });
});

describe("원본 서식 조정 편집 — 되돌리기 기록", () => {
  it("값마다 한 걸음, 같은 묶음이 1초 안에 이어지면 합친다", () => {
    let h = createHistory(0);
    h = historyApply(h, 1, { mergeKey: "key", now: 1000 });
    h = historyApply(h, 2, { mergeKey: "key", now: 1500 });
    h = historyApply(h, 3, { mergeKey: "key", now: 3000 });
    assert.deepEqual(h.past, [0, 2]);
    h = historyUndo(historyUndo(h));
    assert.equal(h.present, 0);
    assert.equal(historyRedo(h).present, 2);
  });

  it("끌기는 시작~끝이 한 걸음이고, 취소하면 시작 전 값으로, 움직임이 없으면 남기지 않는다", () => {
    let h = historyBegin(createHistory("a"));
    h = historyApply(h, "b", { now: 0 });
    h = historyApply(h, "c", { now: 0 });
    const committed = historyCommit(h);
    assert.deepEqual([committed.past, committed.present], [["a"], "c"]);
    assert.equal(historyCancel(h).present, "a");
    const idle = historyCommit(historyBegin(createHistory("a")));
    assert.deepEqual(idle.past, []);
  });

  it("끄는 동안에는 되돌리기·다시 하기를 받지 않는다", () => {
    const h = historyBegin(historyApply(createHistory(0), 1, { now: 0 }));
    assert.equal(historyUndo(h), h);
  });
});
