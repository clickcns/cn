import { ALIGN_MODES, type AlignMode } from "@repo/shared-types";
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalDistributeCenterIcon,
  KeyboardIcon,
  MinusIcon,
  PlusIcon,
  Redo2Icon,
  StretchHorizontalIcon,
  StretchVerticalIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

const ALIGN_TOOLS: { mode: AlignMode; label: string; icon: LucideIcon }[][] = [
  [
    { mode: "left", label: "왼쪽 맞춤", icon: AlignStartVerticalIcon },
    {
      mode: "centerX",
      label: "가로 가운데 맞춤",
      icon: AlignCenterVerticalIcon,
    },
    { mode: "right", label: "오른쪽 맞춤", icon: AlignEndVerticalIcon },
  ],
  [
    { mode: "top", label: "위 맞춤", icon: AlignStartHorizontalIcon },
    {
      mode: "centerY",
      label: "세로 가운데 맞춤",
      icon: AlignCenterHorizontalIcon,
    },
    { mode: "bottom", label: "아래 맞춤", icon: AlignEndHorizontalIcon },
  ],
  [
    { mode: "sameWidth", label: "같은 너비", icon: StretchHorizontalIcon },
    { mode: "sameHeight", label: "같은 높이", icon: StretchVerticalIcon },
  ],
  [
    {
      mode: "spaceX",
      label: "가로 간격 같게(셋 이상)",
      icon: AlignHorizontalDistributeCenterIcon,
    },
    {
      mode: "spaceY",
      label: "세로 간격 같게(셋 이상)",
      icon: AlignVerticalDistributeCenterIcon,
    },
  ],
];

/** 단축키 안내(도구 막대의 [단축키]). */
const SHORTCUTS: [string, string][] = [
  ["누르기 · 빈 곳에서 끌기", "칸 고르기 · 사각형 안의 칸 고르기"],
  ["Ctrl·Shift + 누르기(끌기)", "고른 칸에 더하거나 빼기"],
  ["Ctrl + A", "모두 고르기"],
  ["Esc", "선택 풀기"],
  ["끌기 · 방향키", "고른 칸 함께 옮기기(방향키 0.5pt)"],
  ["Alt + 끌기", "맞춤선에 붙지 않고 옮기기"],
  ["Shift / Ctrl + 방향키", "5pt / 0.1pt씩 옮기기"],
  ["Alt + 방향키 · 모서리 끌기", "고른 글 칸 크기 바꾸기"],
  ["Ctrl + Z", "되돌리기"],
  ["Ctrl + Y · Ctrl + Shift + Z", "다시 하기"],
  ["Ctrl + C / Ctrl + V", "글자 모양 복사 / 붙여넣기"],
  ["Delete", "고른 칸 기본 자리로"],
  ["Ctrl + S", "저장"],
  ["Ctrl + 휠 · Ctrl + + / − · Ctrl + 0", "확대 · 축소 · 100%"],
];

/** 편집 도구 막대: 확대, 칸 테두리, 되돌리기, 맞춤, 단축키 안내. */
export function LayoutToolbar({
  zoomLabel,
  canZoomIn,
  canZoomOut,
  onZoom,
  showOutlines,
  onShowOutlines,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedCount,
  onAlign,
}: {
  zoomLabel: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoom: (step: number) => void;
  showOutlines: boolean;
  onShowOutlines: (show: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedCount: number;
  onAlign: (mode: AlignMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="축소"
          title="축소 (Ctrl + −)"
          disabled={!canZoomOut}
          onClick={() => onZoom(-1)}
        >
          <MinusIcon />
        </Button>
        <span className="w-11 text-center text-sm tabular-nums">
          {zoomLabel}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="확대"
          title="확대 (Ctrl + +)"
          disabled={!canZoomIn}
          onClick={() => onZoom(1)}
        >
          <PlusIcon />
        </Button>
      </div>
      <div className="flex items-center gap-0.5 border-l pl-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="되돌리기"
          title="되돌리기 (Ctrl + Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2Icon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="다시 하기"
          title="다시 하기 (Ctrl + Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2Icon />
        </Button>
      </div>
      <div
        className="flex flex-wrap items-center gap-0.5 border-l pl-3"
        role="group"
        aria-label="맞춤(처음 고른 칸 기준)"
      >
        {ALIGN_TOOLS.map((tools, index) => (
          <div key={index} className="flex items-center gap-0.5">
            {index > 0 && <span className="bg-border mx-1 h-5 w-px" />}
            {tools.map(({ mode, label, icon: Icon }) => (
              <Button
                key={mode}
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                title={`${label} — 처음 고른 칸 기준`}
                disabled={selectedCount < ALIGN_MODES[mode].min}
                onClick={() => onAlign(mode)}
              >
                <Icon />
              </Button>
            ))}
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="layout-outlines"
            checked={showOutlines}
            onCheckedChange={onShowOutlines}
          />
          <Label htmlFor="layout-outlines">칸 테두리</Label>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <KeyboardIcon />
              단축키
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={keys} className="contents">
                  <dt className="text-muted-foreground font-medium whitespace-nowrap">
                    {keys}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
