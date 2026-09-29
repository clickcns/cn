import {
  FORMS,
  type FormDef,
  type FormLayoutItem,
  type LayoutPoint,
  type LayoutRect,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import {
  NURSE_COLUMN_FIELDS,
  NURSE_COLUMN_OFFSETS,
  NURSE_COLUMN_TEXTS,
  NURSE_HEADER_TEXTS,
  NURSE_PAGE_FIELDS,
  WEIGHT_RINGS,
} from "./home-care-nurse.js";
import {
  DETAIL_STYLE,
  FOOTER_STYLE,
  HOME_CARE_FOOTER,
  ITEM_LABELS,
  MARK_SIZE,
  slotId,
  slotStyle,
  type FieldSlot,
  type MarkShape,
  type TextSlot,
} from "./layout.js";
import { OVERLAY_LAYOUTS } from "./layouts.js";

/*
 * 원본 서식 조정 화면에 보일 칸 목록(ID·이름·기본 자리). 그리는 코드와 같은 자리 선언
 * (layouts.ts·home-care-nurse.ts)과 같은 ID(slotId·ITEM_LABELS)로 만든다.
 */

const HEADER_GROUP = "머리·방문일·시각";
const COLUMN_GROUP = "방문 칸";
const FOOTER_GROUP = "출력 표시";

interface ItemPlace {
  group: string;
  repeated?: boolean;
}

/** 표시 칸. 기본 크기는 그리는 코드(drawPlacedMark)와 같은 MARK_SIZE[shape]. */
function markItem(
  place: ItemPlace,
  id: string,
  label: string,
  point: LayoutPoint,
  shape: MarkShape,
): FormLayoutItem {
  return {
    ...place,
    id,
    label,
    kind: "mark",
    point,
    markSize: MARK_SIZE[shape],
  };
}

function textItems(
  slots: readonly TextSlot[],
  group: string,
  repeated?: boolean,
): FormLayoutItem[] {
  return slots.map((slot) => ({
    id: slot.id,
    label: ITEM_LABELS[slot.id],
    group,
    kind: "text",
    rect: slot.box,
    style: slotStyle(slot),
    repeated,
    fields: slot.fields,
  }));
}

function fieldItems(
  form: FormDef,
  slots: Record<string, FieldSlot>,
  repeated?: boolean,
): FormLayoutItem[] {
  const items: FormLayoutItem[] = [];
  for (const section of form.sections) {
    for (const field of section.fields) {
      const slot = slots[field.key];
      if (!slot) continue;
      const base: ItemPlace = {
        group: repeated ? COLUMN_GROUP : section.title,
        repeated,
      };
      if (slot.kind !== "options") {
        if (slot.kind === "text" && slot.mark) {
          items.push(
            markItem(
              base,
              slotId.mark(field.key),
              `${field.label} · □`,
              slot.mark,
              "box",
            ),
          );
        }
        items.push({
          ...base,
          id: field.key,
          label: field.label,
          kind: slot.kind === "text" && slot.multiline ? "paragraph" : "text",
          rect: slot.box,
          style: slotStyle(slot),
        });
        continue;
      }
      if (field.type !== "single" && field.type !== "multi") continue;
      for (const option of field.options) {
        const place = slot.options[option.value];
        if (!place) continue;
        const id = slotId.option(field.key, option.value);
        const label = `${field.label} · ${option.label}`;
        items.push(markItem(base, id, label, place.at, place.shape));
        if (place.detail) {
          items.push({
            ...base,
            id: slotId.detail(id),
            label: `${label} · 괄호 내용`,
            kind: "text",
            rect: place.detail,
            style: DETAIL_STYLE,
          });
        }
        const choices =
          option.detail?.kind === "choice" ? option.detail.options : [];
        for (const [value, point] of Object.entries(
          place.detailChoices ?? {},
        )) {
          const choice = choices.find((c) => c.value === value);
          items.push(
            markItem(
              base,
              slotId.choice(id, value),
              `${label} · ${choice?.label ?? value}`,
              point,
              "circle",
            ),
          );
        }
      }
    }
  }
  return items;
}

function footerItem(rect: LayoutRect): FormLayoutItem {
  return {
    id: "footer",
    label: ITEM_LABELS.footer,
    group: FOOTER_GROUP,
    kind: "text",
    rect,
    style: FOOTER_STYLE,
  };
}

export interface LayoutDescription {
  items: FormLayoutItem[];
  /** 방문 칸(repeated)을 그리는 칸별 가로 이동. 방문 칸이 없는 서식은 [0] */
  repeatOffsets: number[];
  ids: ReadonlySet<string>;
}

function buildDescription(formId: OriginalPdfFormId): LayoutDescription {
  const form = FORMS[formId];
  let items: FormLayoutItem[];
  let repeatOffsets = [0];
  if (formId === "HOME_CARE_NURSE") {
    repeatOffsets = NURSE_COLUMN_OFFSETS;
    items = [
      ...textItems(NURSE_HEADER_TEXTS, HEADER_GROUP),
      ...fieldItems(form, NURSE_PAGE_FIELDS),
      ...textItems(NURSE_COLUMN_TEXTS, COLUMN_GROUP, true),
      ...fieldItems(form, NURSE_COLUMN_FIELDS, true),
      ...Object.entries(WEIGHT_RINGS).map(([id, point]) =>
        markItem(
          { group: COLUMN_GROUP, repeated: true },
          id,
          ITEM_LABELS[id as keyof typeof WEIGHT_RINGS],
          point,
          "ring",
        ),
      ),
      footerItem(HOME_CARE_FOOTER),
    ];
  } else {
    const layout = OVERLAY_LAYOUTS[formId];
    items = [
      ...textItems(layout.texts, HEADER_GROUP),
      ...fieldItems(form, layout.fields),
      footerItem(layout.footer),
    ];
  }
  return {
    items,
    repeatOffsets,
    ids: new Set(items.map((item) => item.id)),
  };
}

const descriptions = new Map<OriginalPdfFormId, LayoutDescription>();

/** 서식의 조정할 수 있는 칸(기본 자리). 자리 선언은 고정이라 서식마다 한 번만 만든다. */
export function describeLayout(formId: OriginalPdfFormId): LayoutDescription {
  let description = descriptions.get(formId);
  if (!description) {
    description = buildDescription(formId);
    descriptions.set(formId, description);
  }
  return description;
}
