import type { ReactNode } from "react";
import type { VisitRecipient } from "@repo/shared-types";
import { Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CareGradeBadge } from "@/features/recipients/components/care-grade-badge";
import { MapLinks } from "@/features/recipients/components/map-links";
import { formatRecipientMeta } from "@/features/recipients/lib/format";
import { cn, toTelHref } from "@/lib/utils";

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={toTelHref(phone)}
      className="border-input bg-card text-primary hover:bg-primary-soft focus-visible:ring-ring/30 active:bg-primary-soft inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 font-semibold tabular-nums transition-colors outline-none focus-visible:ring-4"
    >
      <Phone className="size-5" />
      {phone}
    </a>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-sm font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 수급자 기본 정보. 방문 기록 화면과 수급자 상세에서 함께 쓴다. */
export function RecipientInfoCard({
  recipient,
  className,
}: {
  recipient: VisitRecipient;
  className?: string;
}) {
  const meta = formatRecipientMeta(recipient);

  return (
    <Card className={cn("gap-5", className)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">{recipient.name}</h2>
          <CareGradeBadge grade={recipient.careGrade} />
        </div>
        {meta && <p className="text-muted-foreground text-lg">{meta}</p>}
      </div>

      <dl className="flex flex-col gap-4">
        <InfoRow label="주소">
          {recipient.address ? (
            <div className="flex flex-col gap-2">
              <span>{recipient.address}</span>
              <MapLinks address={recipient.address} />
            </div>
          ) : (
            "등록된 주소 없음"
          )}
        </InfoRow>

        {recipient.phone && (
          <InfoRow label="연락처">
            <PhoneLink phone={recipient.phone} />
          </InfoRow>
        )}

        <InfoRow label="보호자">
          {recipient.guardianName || recipient.guardianPhone ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {recipient.guardianName && (
                <span className="font-semibold">{recipient.guardianName}</span>
              )}
              {recipient.guardianPhone && (
                <PhoneLink phone={recipient.guardianPhone} />
              )}
            </div>
          ) : (
            "등록된 보호자 없음"
          )}
        </InfoRow>

        {recipient.notes && (
          <InfoRow label="메모">
            <p className="bg-muted rounded-xl px-4 py-3 whitespace-pre-wrap">
              {recipient.notes}
            </p>
          </InfoRow>
        )}
      </dl>
    </Card>
  );
}
