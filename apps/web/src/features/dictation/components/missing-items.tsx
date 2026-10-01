import { withParticle, type MissingDictationItem } from "@repo/shared-types";
import { MessageCircleQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** 고를 수 있는 항목은 이만큼만 보여 주고 나머지는 "외 N개"로. */
const MAX_OPTIONS = 6;

/** 되묻는 질문이 없는 칸(필수인데 질문이 없는 칸)의 안내: 칸 종류로 무엇을 말하면 되는지. */
function promptFor(item: MissingDictationItem): string {
  const label = item.labels.join(", ");
  if (item.unit) {
    return `${withParticle(label, "을/를")} 숫자로 말해 주세요(${item.unit})`;
  }
  if (item.options.length > 0) return `${label}에 해당하는 것을 말해 주세요`;
  return `${withParticle(label, "을/를")} 말해 주세요`;
}

function MissingItemRow({ item }: { item: MissingDictationItem }) {
  const extra = item.options.length - MAX_OPTIONS;
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm font-semibold">
        {item.labels.join(" · ")}
        {item.required && (
          <Badge variant="warning" size="sm">
            필수
          </Badge>
        )}
      </p>
      <p className="font-semibold">{item.question ?? promptFor(item)}</p>
      {item.options.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {item.options.slice(0, MAX_OPTIONS).join(" · ")}
          {extra > 0 && ` 외 ${extra}개`}
        </p>
      )}
    </li>
  );
}

/**
 * 초안에서 빠진 항목. 필수 칸과 되묻는 질문이 있는 칸은 질문·고를 수 있는 것과 함께 보여 주고,
 * 질문 없는 부가 칸은 이름만 한 줄로 모은다. 음성으로 답하면([이어서 말하기]) 이전 구술에 이어 붙어
 * 초안이 다시 만들어진다.
 */
export function MissingItems({
  items,
}: {
  items: readonly MissingDictationItem[];
}) {
  if (items.length === 0) return null;
  // 필수 칸이나 되묻는 질문이 있는 칸은 질문과 함께, 나머지(부가)는 이름만.
  const isAsked = (item: MissingDictationItem) =>
    item.required || item.question !== null;
  const asked = items.filter(isAsked);
  const optional = items.filter((item) => !isAsked(item));

  return (
    <section className="border-primary/20 bg-primary-soft/50 flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="text-primary flex items-center gap-2 font-bold">
          <MessageCircleQuestion className="size-5 shrink-0" />더 말해 주세요
        </p>
        <p className="text-muted-foreground text-sm">
          [이어서 말하기]로 답하면 초안에 더해집니다.
        </p>
      </div>
      {asked.length > 0 && (
        <ul className="bg-card divide-border divide-y rounded-xl border">
          {asked.map((item) => (
            <MissingItemRow key={item.fields.join()} item={item} />
          ))}
        </ul>
      )}
      {optional.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-semibold">
            해당하면 말해 주세요
          </p>
          <ul className="flex flex-wrap gap-2">
            {optional.map((item) => (
              <li key={item.fields.join()}>
                <Badge variant="outline" className="font-normal">
                  {item.labels.join(" · ")}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
