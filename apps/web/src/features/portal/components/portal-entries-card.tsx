import { useState } from "react";
import {
  FORMS,
  PORTAL_INFO,
  type FormId,
  type VisitDetail,
} from "@repo/shared-types";
import { CircleCheck, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PortalEntryDialog } from "@/features/portal/components/portal-entry-dialog";
import { usePortalEntries } from "@/features/portal/hooks/use-portal-entries";
import { formatDateTimeLabel } from "@/lib/date";

/**
 * 확정한 기록의 공식 전산 입력: 서식마다 옮겨 적을 곳과 입력 완료 여부, [옮겨 적기]. 케어노트는
 * 공식 전산과 연결되지 않아, 옮겨 적은 뒤 서식마다 한 번 [입력 완료]로 표시한다.
 */
export function PortalEntriesCard({ visit }: { visit: VisitDetail }) {
  const entriesQuery = usePortalEntries(visit.id);
  const [openFormId, setOpenFormId] = useState<FormId | null>(null);
  const entries = entriesQuery.data ?? [];
  const entryOf = (formId: FormId) =>
    entries.find((entry) => entry.formId === formId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>공식 전산 입력</CardTitle>
        <CardDescription>
          심평원·공단에 옮겨 적은 뒤 서식마다 한 번 [입력 완료]를 누르세요.
          케어노트는 인증서를 쓰지 않습니다.
        </CardDescription>
      </CardHeader>
      <ul className="divide-border flex flex-col divide-y">
        {visit.formIds.map((formId) => {
          const entry = entryOf(formId);
          return (
            <li
              key={formId}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold">
                  {FORMS[formId].code} →{" "}
                  {PORTAL_INFO[FORMS[formId].portal].short}
                </span>
                {entriesQuery.isPending ? (
                  <span className="text-muted-foreground text-sm">
                    확인하는 중…
                  </span>
                ) : entry ? (
                  <span className="text-success flex items-center gap-1 text-sm">
                    <CircleCheck className="size-4" aria-hidden />
                    입력 완료 · {formatDateTimeLabel(entry.enteredAt)}
                  </span>
                ) : (
                  <span className="text-warning text-sm font-medium">
                    아직 입력 완료로 표시하지 않았습니다
                  </span>
                )}
              </div>
              <Button
                variant={entry ? "outline" : "soft"}
                size="sm"
                onClick={() => setOpenFormId(formId)}
              >
                <ClipboardPaste />
                {entry ? "다시 보기" : "옮겨 적기"}
              </Button>
            </li>
          );
        })}
      </ul>
      {openFormId && (
        <PortalEntryDialog
          visit={visit}
          formId={openFormId}
          entry={entryOf(openFormId)}
          onClose={() => setOpenFormId(null)}
        />
      )}
    </Card>
  );
}
