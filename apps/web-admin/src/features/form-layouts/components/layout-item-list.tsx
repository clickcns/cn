import type { FormLayoutItem, SelectMode } from "@repo/shared-types";
import { SearchIcon } from "lucide-react";
import type * as React from "react";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { isModKey } from "@/features/form-layouts/lib/modifier-keys";
import { cn } from "@/lib/utils";

/**
 * 칸 목록(묶음별). PDF 위에서 누르기 어려운 작은 칸도 여기서 고른다. 누르면 그 칸만, Ctrl+누르기는
 * 더하거나 빼기, Shift+누르기는 마지막으로 누른 칸부터 범위, 묶음 이름은 그 묶음 전체를 고른다.
 * 조정한 칸은 점으로 표시한다.
 */
export function LayoutItemList({
  items,
  adjustedIds,
  selectedIds,
  onSelect,
}: {
  items: FormLayoutItem[];
  adjustedIds: ReadonlySet<string>;
  /** 고른 칸(첫째가 맞춤 기준) */
  selectedIds: readonly string[];
  onSelect: (ids: string[], mode: SelectMode) => void;
}) {
  const [query, setQuery] = useState("");
  /** Shift+누르기 범위의 시작(마지막으로 누른 칸) */
  const anchor = useRef<string | null>(null);
  const selected = new Set(selectedIds);
  const words = query.trim().toLowerCase();
  const visible = words
    ? items.filter((item) => item.label.toLowerCase().includes(words))
    : items;
  const groups = new Map<string, FormLayoutItem[]>();
  for (const item of visible) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }

  const pick = (event: React.MouseEvent, id: string) => {
    if (event.shiftKey && anchor.current) {
      const ids = visible.map((item) => item.id);
      const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort(
        (x, y) => x - y,
      );
      if (a >= 0) {
        onSelect(ids.slice(a, b + 1), isModKey(event) ? "add" : "replace");
        return;
      }
    }
    anchor.current = id;
    onSelect([id], isModKey(event) ? "toggle" : "replace");
  };

  return (
    <div className="grid gap-3">
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id="layout-item-search"
          type="search"
          placeholder="칸 이름으로 찾기"
          aria-label="칸 이름으로 찾기"
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
        {groups.size === 0 && (
          <p className="text-muted-foreground text-sm">찾는 칸이 없습니다.</p>
        )}
        {[...groups].map(([group, groupItems]) => (
          <section key={group} className="grid gap-0.5">
            <button
              type="button"
              title="이 묶음을 모두 고릅니다(Ctrl: 더하기)"
              onClick={(event) =>
                onSelect(
                  groupItems.map((item) => item.id),
                  isModKey(event) ? "add" : "replace",
                )
              }
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/25 rounded px-2 text-left text-xs font-semibold outline-none focus-visible:ring-3"
            >
              {group}
            </button>
            {groupItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(event) => pick(event, item.id)}
                aria-pressed={selected.has(item.id)}
                className={cn(
                  "hover:bg-muted focus-visible:ring-ring/25 flex items-center gap-2 rounded px-2 py-1 text-left text-[13px] outline-none select-none focus-visible:ring-3",
                  selected.has(item.id) && "bg-primary-soft text-primary",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {adjustedIds.has(item.id) && (
                  <span
                    className="bg-warning size-2 shrink-0 rounded-full"
                    aria-label="조정함"
                  />
                )}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
