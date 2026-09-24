import { useState } from "react";
import { PROGRAM_SHORT_LABELS } from "@repo/shared-types";
import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageError, PageLoading } from "@/components/ui/page-state";
import { CareGradeBadge } from "@/features/recipients/components/care-grade-badge";
import { RecipientSearchInput } from "@/features/recipients/components/recipient-search-input";
import { useRecipients } from "@/features/recipients/hooks/use-recipients";
import { formatRecipientMeta } from "@/features/recipients/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

interface RecipientPickerProps {
  value: string;
  onChange: (recipientId: string) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

/** 검색 가능한 수급자 선택 목록(단일 선택). */
export function RecipientPicker({
  value,
  onChange,
  invalid,
  describedBy,
  className,
}: RecipientPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const recipientsQuery = useRecipients(debouncedSearch);
  const recipients = recipientsQuery.data ?? [];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <RecipientSearchInput value={search} onChange={setSearch} />

      {recipientsQuery.isPending ? (
        <PageLoading className="py-8" />
      ) : recipientsQuery.isError ? (
        <PageError
          error={recipientsQuery.error}
          fallback="수급자 목록을 불러오지 못했습니다"
          onRetry={() => void recipientsQuery.refetch()}
        />
      ) : recipients.length === 0 ? (
        <p className="border-input bg-card text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center">
          {debouncedSearch.trim()
            ? "검색 결과가 없습니다"
            : "등록된 수급자가 없습니다"}
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="수급자"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "bg-muted/50 flex max-h-[24rem] flex-col gap-2 overflow-y-auto overscroll-contain rounded-2xl border p-2 md:max-h-[30rem]",
            invalid ? "border-destructive" : "border-border",
          )}
        >
          {recipients.map((recipient) => {
            const selected = recipient.id === value;
            const meta = formatRecipientMeta(recipient);
            return (
              <button
                key={recipient.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(recipient.id)}
                className={cn(
                  "bg-card focus-visible:ring-ring/30 flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors outline-none focus-visible:ring-4",
                  selected
                    ? "border-primary bg-primary-soft"
                    : "hover:border-primary/30 border-transparent",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold">{recipient.name}</span>
                    <CareGradeBadge grade={recipient.careGrade} />
                    {recipient.programs.map((program) => (
                      <Badge key={program} variant="outline">
                        {PROGRAM_SHORT_LABELS[program]}
                      </Badge>
                    ))}
                  </div>
                  {(meta || recipient.address) && (
                    <span className="text-muted-foreground truncate text-sm">
                      {[meta, recipient.address].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <CircleCheck
                  className={cn(
                    "size-7 shrink-0",
                    selected ? "text-primary" : "text-input",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
