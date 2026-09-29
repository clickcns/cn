import type { FormLayoutDetail, SelectMode } from "@repo/shared-types";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LayoutHandles } from "@/features/form-layouts/components/layout-handles";
import { LayoutInspector } from "@/features/form-layouts/components/layout-inspector";
import { LayoutItemList } from "@/features/form-layouts/components/layout-item-list";
import { LayoutToolbar } from "@/features/form-layouts/components/layout-toolbar";
import { PdfPageCanvas } from "@/features/form-layouts/components/pdf-page-canvas";
import {
  useFormLayoutPreview,
  useResetFormLayout,
  useSaveFormLayout,
} from "@/features/form-layouts/hooks/use-form-layouts";
import { useLayoutEditor } from "@/features/form-layouts/hooks/use-layout-editor";
import { isModKey } from "@/features/form-layouts/lib/modifier-keys";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { formatDateTime } from "@/lib/format";

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5];
const ZOOM_100 = ZOOMS.indexOf(1);

/** 확대 단계를 step 만큼(끝에서 멈춘다). */
const stepZoom = (current: number, step: number) =>
  Math.min(ZOOMS.length - 1, Math.max(0, current + step));

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** 글을 입력하는 칸(여기서는 저장 말고 화면 단축키를 쓰지 않는다). */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest("input, textarea, select, [contenteditable='true']")
  );
}

/**
 * 원본 서식 한 장의 칸 조정(WinForms 디자이너처럼 여러 칸을 골라 옮기고 맞추고 되돌린다).
 * 조정은 저장하기 전까지 이 화면에만 있고, 바꿀 때마다(잠시 멈춘 뒤) 서버가 표본 PDF를 다시 그려
 * 결과를 그대로 보여 준다. 손잡이는 바로 움직인다.
 */
export function FormLayoutEditor({ detail }: { detail: FormLayoutDetail }) {
  const { formId, page, items } = detail;
  const editor = useLayoutEditor(detail);
  const [zoom, setZoom] = useState(2);
  const [showOutlines, setShowOutlines] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scale = ZOOMS[zoom];
  const preview = useFormLayoutPreview(
    formId,
    useDebouncedValue(editor.draftKey, 350),
  );
  const save = useSaveFormLayout(formId);
  const reset = useResetFormLayout(formId);

  // 저장하지 않은 조정이 있으면 다른 화면·서식으로 가기 전에 묻는다(저장하는 동안은 빼고).
  const blocker = useUnsavedChangesGuard(editor.dirty && !save.isPending);

  const zoomBy = (step: number) =>
    setZoom((current) => stepZoom(current, step));

  const saveNow = () => {
    if (!editor.dirty || save.isPending) return;
    save.mutate({
      adjustments: editor.clean,
      expectedUpdatedAt: detail.updatedAt,
    });
  };

  const { select, load } = editor;
  const selectFromList = (ids: string[], mode: SelectMode) => {
    select(ids, mode);
    if (ids.length !== 1 || mode !== "replace") return;
    scrollRef.current
      ?.querySelector(`[data-handle="${CSS.escape(ids[0])}"][data-column="0"]`)
      ?.scrollIntoView({ block: "center", inline: "center" });
  };

  const onShortcut = (event: KeyboardEvent) => {
    // 이 화면 안(또는 아무 곳에도 포커스가 없을 때)만 받는다. 창·메뉴는 화면 밖에 떠서 빠진다.
    const { target } = event;
    const inEditor =
      target === document.body ||
      (target instanceof Node && !!rootRef.current?.contains(target));
    if (!inEditor || event.defaultPrevented || event.isComposing) return;
    const mod = isModKey(event);
    const key = event.key.toLowerCase();
    const run = (action: () => void) => {
      event.preventDefault();
      action();
    };
    if (mod && key === "s") return run(saveNow);
    if (isTextEntry(target)) return;
    if (key === "escape" && editor.isDragging()) return run(editor.dragCancel);
    if (mod && key === "z" && !event.shiftKey) return run(editor.undo);
    if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
      return run(editor.redo);
    }
    if (mod && key === "a") return run(editor.selectAll);
    if (mod && (key === "=" || key === "+")) return run(() => zoomBy(1));
    if (mod && key === "-") return run(() => zoomBy(-1));
    if (mod && key === "0") return run(() => setZoom(ZOOM_100));
    if (mod && key === "c") {
      if (editor.copyStyle())
        run(() => toast.success("글자 모양을 복사했습니다"));
      return;
    }
    if (mod && key === "v") {
      if (editor.pasteStyle())
        run(() => toast.success("글자 모양을 붙였습니다"));
      return;
    }
    if (editor.selected.length === 0) return;
    if (key === "escape") return run(editor.clearSelection);
    if (key === "delete" || key === "backspace") {
      return run(editor.resetSelection);
    }
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    const step = event.shiftKey ? 5 : mod ? 0.1 : 0.5;
    run(() =>
      editor.nudge(
        arrow[0] * step,
        arrow[1] * step,
        event.altKey ? "resize" : "move",
      ),
    );
  };

  // 늘 최신 상태를 쓰도록 ref 로 감싸 한 번만 단다.
  const shortcutRef = useLatestRef(onShortcut);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [shortcutRef]);

  // Ctrl+휠로 확대·축소(브라우저 확대 대신). React 의 onWheel 은 기본 동작을 막을 수 없어 직접 단다.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!isModKey(event)) return;
      event.preventDefault();
      setZoom((current) => stepZoom(current, event.deltaY < 0 ? 1 : -1));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <Card className="min-w-0 overflow-hidden">
          <LayoutToolbar
            zoomLabel={`${Math.round(scale * 100)}%`}
            canZoomIn={zoom < ZOOMS.length - 1}
            canZoomOut={zoom > 0}
            onZoom={zoomBy}
            showOutlines={showOutlines}
            onShowOutlines={setShowOutlines}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onUndo={editor.undo}
            onRedo={editor.redo}
            selectedCount={editor.selected.length}
            onAlign={editor.align}
          />
          <p className="text-muted-foreground border-b px-4 py-1.5 text-xs">
            표본 값으로 채운 미리보기입니다. 조정한 칸은 주황 테두리, 고른 칸은
            파란 테두리(굵은 것이 맞춤 기준)로 보입니다.
            {preview.isFetching && " 다시 그리는 중…"}
          </p>
          <div
            ref={scrollRef}
            className="bg-muted/50 max-h-[calc(100dvh-15rem)] overflow-auto p-6"
          >
            <div
              className="relative mx-auto bg-white shadow-sm select-none"
              style={{ width: page.width * scale, height: page.height * scale }}
            >
              <PdfPageCanvas pdf={preview.data} scale={scale} />
              <LayoutHandles
                items={items}
                adjustments={editor.draft}
                adjustedIds={editor.adjustedIds}
                selectedIds={editor.selectedIds}
                repeatOffsets={detail.repeatOffsets}
                scale={scale}
                showOutlines={showOutlines}
                guides={editor.guides}
                onSelect={select}
                onDragStart={editor.dragStart}
                onDrag={editor.dragTo}
                onDragEnd={editor.dragEnd}
                onDragCancel={editor.dragCancel}
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
                  disabled={!editor.dirty || save.isPending}
                  title="저장 (Ctrl + S)"
                  onClick={saveNow}
                >
                  <SaveIcon />
                  저장
                </Button>
                <Button
                  variant="outline"
                  disabled={!editor.dirty}
                  onClick={editor.revert}
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
              {editor.dirty && (
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
                selected={editor.selected}
                adjustments={editor.draft}
                adjustedIds={editor.adjustedIds}
                onSetItem={editor.setItem}
                onSetStyle={editor.setStyle}
                onSetMarkSize={editor.setMarkSize}
                onReset={editor.resetSelection}
                onPageChange={editor.setPage}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>칸 목록</CardTitle>
              <span className="text-muted-foreground text-xs tabular-nums">
                {editor.selected.length > 0 &&
                  `${editor.selected.length}칸 고름 · `}
                {items.length}칸
              </span>
            </CardHeader>
            <CardContent>
              <LayoutItemList
                items={items}
                adjustedIds={editor.adjustedIds}
                selectedIds={editor.selectedIds}
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
          reset.mutate(undefined, {
            onSuccess: (saved) => {
              load(saved.adjustments);
              setConfirmReset(false);
            },
          })
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
