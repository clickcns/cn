import { FORMS, type FormId } from "@repo/shared-types";
import { cn } from "@/lib/utils";

/** 방문 한 건의 서식이 여럿일 때 고르는 탭(재택의료 의사: 별지 제4·6호). */
export function FormTabs({
  formIds,
  value,
  onChange,
}: {
  formIds: readonly FormId[];
  value: FormId | undefined;
  onChange: (formId: FormId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="서식"
      className="bg-muted grid gap-1 rounded-2xl p-1"
      style={{
        gridTemplateColumns: `repeat(${formIds.length}, minmax(0, 1fr))`,
      }}
    >
      {formIds.map((formId) => {
        const form = FORMS[formId];
        const selected = formId === value;
        return (
          <button
            key={formId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`form-panel-${formId}`}
            onClick={() => onChange(formId)}
            className={cn(
              "focus-visible:ring-ring/30 flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-colors outline-none focus-visible:ring-4",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-xs font-semibold">{form.code}</span>
            <span className="text-sm leading-tight font-bold">
              {form.shortTitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}
