import type { FormLayoutItem } from "@repo/shared-types";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** 칸 목록(묶음별). PDF 위에서 누르기 어려운 작은 칸도 여기서 고른다. 조정한 칸은 점으로 표시한다. */
export function LayoutItemList({
  items,
  adjustedIds,
  selectedId,
  onSelect,
}: {
  items: FormLayoutItem[];
  adjustedIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const groups = new Map<string, FormLayoutItem[]>();
  for (const item of items) {
    if (words && !item.label.toLowerCase().includes(words)) continue;
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }

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
            <h3 className="text-muted-foreground px-2 text-xs font-semibold">
              {group}
            </h3>
            {groupItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={item.id === selectedId}
                className={cn(
                  "hover:bg-muted focus-visible:ring-ring/25 flex items-center gap-2 rounded px-2 py-1 text-left text-[13px] outline-none focus-visible:ring-3",
                  item.id === selectedId && "bg-primary-soft text-primary",
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
