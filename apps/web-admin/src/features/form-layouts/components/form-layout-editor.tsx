import {
  clampLayoutAdjustment,
  cleanLayoutAdjustments,
  roundPt,
  type FormLayoutAdjustments,
  type FormLayoutDetail,
  type LayoutItemAdjustment,
} from "@repo/shared-types";
import { MinusIcon, PlusIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import type * as React from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LayoutHandles } from "@/features/form-layouts/components/layout-handles";
import { LayoutInspector } from "@/features/form-layouts/components/layout-inspector";
import { LayoutItemList } from "@/features/form-layouts/components/layout-item-list";
import { PdfPageCanvas } from "@/features/form-layouts/components/pdf-page-canvas";
import {
  useFormLayoutPreview,
  useResetFormLayout,
  useSaveFormLayout,
} from "@/features/form-layouts/hooks/use-form-layouts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { formatDateTime } from "@/lib/format";

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5];

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * 원본 서식 한 장의 칸 조정. 조정은 저장하기 전까지 이 화면에만 있고, 바꿀 때마다(잠시 멈춘 뒤)
 * 서버가 표본 PDF를 다시 그려 결과를 그대로 보여 준다. 손잡이는 바로 움직인다.
 */
export function FormLayoutEditor({ detail }: { detail: FormLayoutDetail }) {
  const { formId, page, items } = detail;
  const [draft, setDraft] = useState<FormLayoutAdjustments>(detail.adjustments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2);
  const [showOutlines, setShowOutlines] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scale = ZOOMS[zoom];

  const clean = cleanLayoutAdjustments(draft);
  const draftKey = JSON.stringify(clean);
  const dirty =
    draftKey !== JSON.stringify(cleanLayoutAdjustments(detail.adjustments));
  const adjustedIds = new Set(Object.keys(clean.items));
  const preview = useFormLayoutPreview(
    formId,
    useDebouncedValue(draftKey, 350),
  );
  const save = useSaveFormLayout(formId);
  const reset = useResetFormLayout(formId);
  const selected = items.find((item) => item.id === selectedId);

  // 저장하지 않은 조정이 있으면 다른 화면·서식으로 가기 전에 묻는다(저장하는 동안은 빼고).
  const blocker = useUnsavedChangesGuard(dirty && !save.isPending);

  const changeItem = (id: string, patch: LayoutItemAdjustment) =>
    setDraft((current) => ({
      ...current,
      items: {
        ...current.items,
        [id]: clampLayoutAdjustment({ ...current.items[id], ...patch }),
      },
    }));

  const resetItem = (id: string) =>
    setDraft((current) => ({
      ...current,
      items: Object.fromEntries(
        Object.entries(current.items).filter(([key]) => key !== id),
      ),
    }));

  const selectFromList = (id: string) => {
    setSelectedId(id);
    const handle = scrollRef.current?.querySelector(
      `[data-item-id="${CSS.escape(id)}"]`,
    );
    handle?.scrollIntoView({ block: "center", inline: "center" });
    scrollRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!selected) return;
    if (event.key === "Escape") {
      setSelectedId(null);
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 0.5;
    const [x, y] = arrow;
    const [keyX, keyY] =
      event.altKey && selected.kind !== "mark"
        ? (["dw", "dh"] as const)
        : (["dx", "dy"] as const);
    const id = selected.id;
    // 키를 빠르게 눌러도 쌓이게 지금 값에서 움직인 축만 바꾼다.
    setDraft((current) => {
      const adjustment = { ...current.items[id] };
      if (x) adjustment[keyX] = roundPt((adjustment[keyX] ?? 0) + x * step);
      if (y) adjustment[keyY] = roundPt((adjustment[keyY] ?? 0) + y * step);
      return {
        ...current,
        items: { ...current.items, [id]: clampLayoutAdjustment(adjustment) },
      };
    });
  };

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="축소"
                disabled={zoom === 0}
                onClick={() => setZoom(zoom - 1)}
              >
                <MinusIcon />
              </Button>
              <span className="w-12 text-center text-sm tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="확대"
                disabled={zoom === ZOOMS.length - 1}
                onClick={() => setZoom(zoom + 1)}
              >
                <PlusIcon />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="layout-outlines"
                checked={showOutlines}
                onCheckedChange={setShowOutlines}
              />
              <Label htmlFor="layout-outlines">칸 테두리</Label>
            </div>
            <p className="text-muted-foreground text-xs">
              표본 값으로 채운 미리보기입니다. 조정한 칸은 주황 테두리로
              보입니다.
              {preview.isFetching && " 다시 그리는 중…"}
            </p>
          </div>
          <div
            ref={scrollRef}
            tabIndex={0}
            aria-label="원본 서식 미리보기. 칸을 고른 뒤 방향키로 옮깁니다"
            onKeyDown={onKeyDown}
            className="bg-muted/50 focus-visible:ring-ring/25 max-h-[calc(100dvh-13rem)] overflow-auto p-6 outline-none focus-visible:ring-3 focus-visible:ring-inset"
          >
            <div
              className="relative mx-auto bg-white shadow-sm"
              style={{ width: page.width * scale, height: page.height * scale }}
              onPointerDown={() => setSelectedId(null)}
            >
              <PdfPageCanvas pdf={preview.data} scale={scale} />
              <LayoutHandles
                items={items}
                adjustments={draft}
                adjustedIds={adjustedIds}
                repeatOffsets={detail.repeatOffsets}
                scale={scale}
                selectedId={selectedId}
                showOutlines={showOutlines}
                onSelect={setSelectedId}
                onChange={changeItem}
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardContent className="grid gap-3">
              <p className="text-muted-foreground text-xs">
                {detail.updatedAt && detail.updatedBy
                  ? `${formatDateTime(detail.updatedAt)} · ${detail.updatedBy.name} 저장 · 조정한 칸 ${detail.adjustedCount}개`
                  : "아직 조정하지 않았습니다(기본 자리)."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!dirty || save.isPending}
                  onClick={() =>
                    save.mutate({
                      adjustments: clean,
                      expectedUpdatedAt: detail.updatedAt,
                    })
                  }
                >
                  <SaveIcon />
                  저장
                </Button>
                <Button
                  variant="outline"
                  disabled={!dirty}
                  onClick={() => setDraft(detail.adjustments)}
                >
                  바꾼 것 취소
                </Button>
                <Button
                  variant="ghost"
                  disabled={detail.updatedAt === null}
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcwIcon />
                  기본 자리로
                </Button>
              </div>
              {dirty && (
                <p className="text-warning text-xs font-medium">
                  저장하지 않은 조정이 있습니다.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>칸 조정</CardTitle>
            </CardHeader>
            <CardContent>
              <LayoutInspector
                item={selected}
                adjustment={selected ? draft.items[selected.id] : undefined}
                adjusted={selected ? adjustedIds.has(selected.id) : false}
                page={draft.page}
                onChange={(patch) => selected && changeItem(selected.id, patch)}
                onReset={() => selected && resetItem(selected.id)}
                onPageChange={(patch) =>
                  setDraft((current) => {
                    const { dx = 0, dy = 0 } = clampLayoutAdjustment({
                      ...current.page,
                      ...patch,
                    });
                    return { ...current, page: { dx, dy } };
                  })
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>칸 목록</CardTitle>
              <span className="text-muted-foreground text-xs tabular-nums">
                {items.length}칸
              </span>
            </CardHeader>
            <CardContent>
              <LayoutItemList
                items={items}
                adjustedIds={adjustedIds}
                selectedId={selectedId}
                onSelect={selectFromList}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="기본 자리로 되돌릴까요?"
        description="이 서식에 저장한 조정을 모두 지웁니다. 모든 기관의 원본 서식 PDF에 바로 적용됩니다."
        confirmText="기본 자리로"
        destructive
        isPending={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, { onSuccess: () => setConfirmReset(false) })
        }
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="저장하지 않은 조정이 있습니다"
        description="이 화면을 떠나면 저장하지 않은 조정이 사라집니다."
        confirmText="저장하지 않고 나가기"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
