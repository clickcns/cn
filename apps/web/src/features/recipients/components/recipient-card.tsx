import type { Recipient } from "@repo/shared-types";
import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router";
import { CareGradeBadge } from "@/features/recipients/components/care-grade-badge";
import { formatRecipientMeta } from "@/features/recipients/lib/format";
import { recipientPath } from "@/lib/routes";

export function RecipientCard({ recipient }: { recipient: Recipient }) {
  const meta = formatRecipientMeta(recipient);

  return (
    <Link
      to={recipientPath(recipient.id)}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring/30 active:bg-muted flex h-full min-h-24 items-center gap-3 rounded-2xl border p-4 transition-colors outline-none focus-visible:ring-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{recipient.name}</span>
          <CareGradeBadge grade={recipient.careGrade} />
        </div>
        {meta && <p className="text-muted-foreground">{meta}</p>}
        <p className="text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{recipient.address ?? "주소 없음"}</span>
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-6 shrink-0" />
    </Link>
  );
}
