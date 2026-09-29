import {
  withParticle,
  type MissingDictationItem,
  type VisitDictationExampleLine,
} from "@repo/shared-types";
import { MessageCircleQuestion, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** 고를 수 있는 항목은 이만큼만 보여 주고 나머지는 "외 N개"로. */
const MAX_OPTIONS = 6;

/** 되묻는 질문이 없는 칸(부가 항목)의 안내: 칸 종류로 무엇을 말하면 되는지. */
function promptFor(item: MissingDictationItem): string {
  const label = item.labels.join(", ");
  if (item.unit) {
    return `${withParticle(label, "을/를")} 숫자로 말해 주세요(${item.unit})`;
  }
  if (item.options.length > 0) return `${label}에 해당하는 것을 말해 주세요`;
  return `${withParticle(label, "을/를")} 말해 주세요`;
}

function MissingItemRow({
  item,
  example,
}: {
  item: MissingDictationItem;
  example: string | undefined;
}) {
  const extra = item.options.length - MAX_OPTIONS;
  return (
    <li className="bg-card flex flex-col gap-1.5 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={item.required ? "warning" : "outline"}
          className="h-7 px-2.5"
        >
          {item.required ? "필수" : "부가"}
        </Badge>
        <span className="font-semibold">{item.labels.join(" · ")}</span>
      </div>
      <p className="text-lg">{item.question ?? promptFor(item)}</p>
      {item.options.length > 0 && (
        <p className="text-muted-foreground text-sm">
          고를 수 있는 것: {item.options.slice(0, MAX_OPTIONS).join(" · ")}
          {extra > 0 && ` 외 ${extra}개`}
        </p>
      )}
      {example && (
        <p className="text-muted-foreground text-sm">예: “{example}”</p>
      )}
    </li>
  );
}

/**
 * 초안에서 빠진 항목: 필수(확정 전에 채울 칸)와 부가 항목을 항목마다 질문·고를 수 있는 것·예시 문장과
 * 함께 보여 준다. 음성으로 답하면 이전 구술에 이어 붙어 초안이 다시 만들어진다.
 */
export function MissingItems({
  items,
  examples,
  disabled,
  onAnswer,
}: {
  items: readonly MissingDictationItem[];
  /** 이 방문의 구술 예시. 항목의 칸을 채우는 첫 줄을 예시로 보여 준다. */
  examples: readonly VisitDictationExampleLine[];
  disabled: boolean;
  onAnswer: () => void;
}) {
  if (items.length === 0) return null;
  const requiredCount = items.filter((item) => item.required).length;
  // 항목의 칸을 채우는 첫 예시 줄. 앞 항목에 이미 보인 줄은 되풀이하지 않는다.
  const shown = new Set<string>();
  const exampleFor = (item: MissingDictationItem) => {
    const text = examples.find((line) =>
      line.fields.some((ref) => item.fields.includes(ref)),
    )?.text;
    if (!text || shown.has(text)) return undefined;
    shown.add(text);
    return text;
  };

  return (
    <section className="border-primary/20 bg-primary-soft/60 flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <p className="text-primary flex items-center gap-2 font-bold">
          <MessageCircleQuestion className="size-5 shrink-0" />
          빠진 항목 {items.length}개
        </p>
        <p className="text-muted-foreground text-sm">
          {requiredCount > 0 &&
            `필수 ${requiredCount}개는 확정 전에 채워야 합니다. `}
          부가 항목은 해당할 때만 말하면 됩니다.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <MissingItemRow
            key={item.fields.join()}
            item={item}
            example={exampleFor(item)}
          />
        ))}
      </ul>
      <Button variant="soft" onClick={onAnswer} disabled={disabled}>
        <Mic />
        음성으로 답하기
      </Button>
      <p className="text-muted-foreground text-sm">
        말하기 어려우면 서식에 채운 뒤 직접 입력해도 됩니다.
      </p>
    </section>
  );
}
