import {
  adjustMarkSize,
  adjustStyle,
  LAYOUT_ALIGN_LABELS,
  LAYOUT_ALIGNS,
  type FormLayoutAdjustments,
  type FormLayoutItem,
  type LayoutItemAdjustment,
  type LayoutTextStyle,
} from "@repo/shared-types";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** 숫자 칸. 입력하는 동안("-", "1.")은 글 그대로 두고, 읽을 수 있는 값일 때만 알린다. */
function NumberField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <FormField label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={0.5}
        placeholder={placeholder}
        value={text ?? (value === undefined ? "" : String(value))}
        onFocus={() => setText(value === undefined ? "" : String(value))}
        onBlur={() => setText(null)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === "") onChange(undefined);
          else if (Number.isFinite(Number(next))) onChange(Number(next));
        }}
      />
    </FormField>
  );
}

/** 모든 값이 같으면 그 값, 아니면 undefined. */
function common<T>(values: readonly T[]): T | undefined {
  return values.every((value) => value === values[0]) ? values[0] : undefined;
}

/** 크기 칸의 안내: 모두 같으면 지금 크기, 아니면 "여러 값". */
function sizePlaceholder(sizes: readonly number[]): string {
  const size = common(sizes);
  return size === undefined ? "여러 값" : `지금 ${size}`;
}

/**
 * 고른 칸의 조정. 한 칸이면 위치·칸 크기를 숫자로 바꾸고, 여러 칸이면 글자 모양을 한꺼번에 바꾼다
 * (옮기기·맞춤은 PDF 위와 도구 막대에서). 아래에 채운 값 전체 옮기기.
 */
export function LayoutInspector({
  selected,
  adjustments,
  adjustedIds,
  onSetItem,
  onSetStyle,
  onSetMarkSize,
  onReset,
  onPageChange,
}: {
  /** 고른 칸(첫째가 맞춤 기준) */
  selected: readonly FormLayoutItem[];
  adjustments: FormLayoutAdjustments;
  adjustedIds: ReadonlySet<string>;
  onSetItem: (id: string, patch: LayoutItemAdjustment) => void;
  onSetStyle: (patch: Partial<LayoutTextStyle>) => void;
  onSetMarkSize: (size: number | undefined) => void;
  onReset: () => void;
  onPageChange: (patch: { dx?: number; dy?: number }) => void;
}) {
  const [primary] = selected;
  const single = selected.length === 1 ? primary : undefined;
  const texts = selected.flatMap((item) =>
    item.kind === "mark"
      ? []
      : [
          {
            item,
            adjustment: adjustments.items[item.id],
            style: adjustStyle(item.style, adjustments.items[item.id]),
          },
        ],
  );
  const marks = selected.flatMap((item) =>
    item.kind === "mark"
      ? [
          {
            adjustment: adjustments.items[item.id],
            size: adjustMarkSize(item.markSize, adjustments.items[item.id]),
          },
        ]
      : [],
  );
  const alignable = texts.filter((text) => text.item.kind === "text");
  const align = common(alignable.map((text) => text.style.align));
  const page = adjustments.page;

  const field = (
    item: FormLayoutItem,
    key: "dx" | "dy" | "dw" | "dh",
    label: string,
  ) => (
    <NumberField
      id={`layout-${key}`}
      label={label}
      value={adjustments.items[item.id]?.[key] ?? 0}
      onChange={(value) => onSetItem(item.id, { [key]: value })}
    />
  );

  return (
    <div className="grid gap-5">
      {primary ? (
        <section className="grid gap-4" aria-label="고른 칸">
          <div className="grid gap-0.5">
            <p className="font-semibold">
              {single ? single.label : `${selected.length}칸 고름`}
            </p>
            <p className="text-muted-foreground text-xs">
              {single
                ? `${single.group}${single.repeated ? " · 다섯 칸에 함께 적용됩니다" : ""}`
                : `맞춤 기준: ${primary.label}`}
            </p>
          </div>
          {single && (
            <div className="grid grid-cols-2 gap-3">
              {field(single, "dx", "오른쪽으로(pt)")}
              {field(single, "dy", "아래로(pt)")}
              {single.kind !== "mark" && (
                <>
                  {field(single, "dw", "칸 너비 +(pt)")}
                  {field(single, "dh", "칸 높이 +(pt)")}
                </>
              )}
            </div>
          )}
          {texts.length > 0 && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 items-end gap-3">
                <NumberField
                  id="layout-size"
                  label="글자 크기(pt)"
                  value={common(texts.map((text) => text.adjustment?.size))}
                  placeholder={sizePlaceholder(
                    texts.map((text) => text.style.size),
                  )}
                  onChange={(size) => onSetStyle({ size })}
                />
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id="layout-bold"
                    checked={texts.every((text) => text.style.bold)}
                    onCheckedChange={(bold) => onSetStyle({ bold })}
                  />
                  <Label htmlFor="layout-bold">굵게</Label>
                </div>
              </div>
              {alignable.length > 0 && (
                <div className="grid gap-1.5">
                  <span className="text-[13px] font-medium">정렬</span>
                  <div className="flex gap-1" role="group" aria-label="정렬">
                    {LAYOUT_ALIGNS.map((value) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={align === value ? "secondary" : "outline"}
                        aria-pressed={align === value}
                        className="flex-1"
                        onClick={() => onSetStyle({ align: value })}
                      >
                        {LAYOUT_ALIGN_LABELS[value]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {marks.length > 0 && (
            <div className="grid grid-cols-2 items-end gap-3">
              <NumberField
                id="layout-mark-size"
                label="표시 크기(pt)"
                value={common(marks.map((mark) => mark.adjustment?.size))}
                placeholder={sizePlaceholder(marks.map((mark) => mark.size))}
                onChange={onSetMarkSize}
              />
              <p className="text-muted-foreground pb-2 text-xs">
                □ 체크·○ 점·동그라미 크기
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={!selected.some((item) => adjustedIds.has(item.id))}
            onClick={onReset}
          >
            <RotateCcwIcon />
            {single ? "이 칸 기본값으로" : "고른 칸 기본값으로"}
          </Button>
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          PDF 위의 칸을 누르거나 빈 곳에서 끌어 여러 칸을 고르세요. 아래
          목록에서도 고를 수 있습니다. 단축키는 도구 막대의 [단축키]에 있습니다.
        </p>
      )}
      <section className="grid gap-3 border-t pt-4" aria-label="페이지 전체">
        <div className="grid gap-0.5">
          <p className="text-sm font-semibold">채운 값 전체 옮기기</p>
          <p className="text-muted-foreground text-xs">
            원본 인쇄 글자는 그대로 두고 채운 값만 한꺼번에 옮깁니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="layout-page-dx"
            label="오른쪽으로(pt)"
            value={page?.dx ?? 0}
            onChange={(dx) => onPageChange({ dx: dx ?? 0 })}
          />
          <NumberField
            id="layout-page-dy"
            label="아래로(pt)"
            value={page?.dy ?? 0}
            onChange={(dy) => onPageChange({ dy: dy ?? 0 })}
          />
        </div>
      </section>
    </div>
  );
}
