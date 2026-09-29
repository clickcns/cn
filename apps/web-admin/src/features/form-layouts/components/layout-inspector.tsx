import {
  LAYOUT_ALIGN_LABELS,
  LAYOUT_ALIGNS,
  type FormLayoutAdjustments,
  type FormLayoutItem,
  type LayoutItemAdjustment,
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

/** 고른 칸의 조정(옮기기·칸 크기·글자 모양)과 페이지 전체 옮기기. */
export function LayoutInspector({
  item,
  adjustment,
  adjusted,
  page,
  onChange,
  onReset,
  onPageChange,
}: {
  item: FormLayoutItem | undefined;
  adjustment: LayoutItemAdjustment | undefined;
  /** 기본 자리에서 바뀌었는지(되돌리기 단추) */
  adjusted: boolean;
  page: FormLayoutAdjustments["page"];
  onChange: (patch: LayoutItemAdjustment) => void;
  onReset: () => void;
  onPageChange: (patch: { dx?: number; dy?: number }) => void;
}) {
  const style = item?.kind === "mark" ? undefined : item?.style;
  return (
    <div className="grid gap-5">
      {item ? (
        <section className="grid gap-4" aria-label="고른 칸">
          <div className="grid gap-0.5">
            <p className="font-semibold">{item.label}</p>
            <p className="text-muted-foreground text-xs">
              {item.group}
              {item.repeated && " · 다섯 칸에 함께 적용됩니다"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="layout-dx"
              label="오른쪽으로(pt)"
              value={adjustment?.dx ?? 0}
              onChange={(dx) => onChange({ dx })}
            />
            <NumberField
              id="layout-dy"
              label="아래로(pt)"
              value={adjustment?.dy ?? 0}
              onChange={(dy) => onChange({ dy })}
            />
            {item.kind !== "mark" && (
              <>
                <NumberField
                  id="layout-dw"
                  label="칸 너비 +(pt)"
                  value={adjustment?.dw ?? 0}
                  onChange={(dw) => onChange({ dw })}
                />
                <NumberField
                  id="layout-dh"
                  label="칸 높이 +(pt)"
                  value={adjustment?.dh ?? 0}
                  onChange={(dh) => onChange({ dh })}
                />
              </>
            )}
          </div>
          {style && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 items-end gap-3">
                <NumberField
                  id="layout-size"
                  label="글자 크기(pt)"
                  value={adjustment?.size}
                  placeholder={`기본 ${style.size}`}
                  onChange={(size) => onChange({ size })}
                />
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id="layout-bold"
                    checked={adjustment?.bold ?? style.bold}
                    onCheckedChange={(bold) => onChange({ bold })}
                  />
                  <Label htmlFor="layout-bold">굵게</Label>
                </div>
              </div>
              {item.kind === "text" && (
                <div className="grid gap-1.5">
                  <span className="text-[13px] font-medium">정렬</span>
                  <div className="flex gap-1" role="group" aria-label="정렬">
                    {LAYOUT_ALIGNS.map((align) => {
                      const active =
                        (adjustment?.align ?? style.align) === align;
                      return (
                        <Button
                          key={align}
                          type="button"
                          size="sm"
                          variant={active ? "secondary" : "outline"}
                          aria-pressed={active}
                          className="flex-1"
                          onClick={() => onChange({ align })}
                        >
                          {LAYOUT_ALIGN_LABELS[align]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={!adjusted}
            onClick={onReset}
          >
            <RotateCcwIcon />이 칸 기본값으로
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            PDF 위에서 끌어 옮기고, 오른쪽 아래 모서리를 끌어 칸 크기를
            바꿉니다. 방향키는 0.5pt, Shift+방향키는 5pt씩 옮기고, Alt+방향키로
            칸 크기를 바꿉니다.
          </p>
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          PDF 위의 칸을 누르거나 아래 목록에서 고르세요.
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
