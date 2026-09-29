import {
  hasOriginalPdf,
  type FormId,
  type FormPdfStyle,
} from "@repo/shared-types";
import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { openPdf } from "@/features/visits/lib/open-pdf";
import { api } from "@/lib/api";

/**
 * 확정본 한 벌의 서식 PDF. 원본 서식이 있으면 [원본 서식 PDF](원본 위에 채움)와
 * [표준 서식 PDF](서식 정의로 그림)를 함께 두고, 없으면 표준 서식만 둔다.
 */
export function FormPdfButtons({
  visitId,
  version,
  formIds,
}: {
  visitId: string;
  version: number;
  formIds: readonly FormId[];
}) {
  const [pending, setPending] = useState<FormPdfStyle | null>(null);
  const original = formIds.filter(hasOriginalPdf);
  const open = async (style: FormPdfStyle) => {
    setPending(style);
    await openPdf(() => api.visits.versionPdf(visitId, version, { style }));
    setPending(null);
  };
  const button = (style: FormPdfStyle, label: string, title: string) => (
    <Button
      variant="outline"
      size="sm"
      disabled={pending !== null}
      onClick={() => void open(style)}
      title={title}
    >
      {pending === style ? <Spinner /> : <FileTextIcon />}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {original.length > 0 &&
        button(
          "original",
          "원본 서식 PDF",
          original.length < formIds.length
            ? "지침 부록 원본 위에 채웁니다. 원본이 없는 서식은 표준 서식으로 나옵니다."
            : "지침 부록 원본 위에 채웁니다.",
        )}
      {button(
        "standard",
        original.length > 0 ? "표준 서식 PDF" : "서식 PDF",
        "서식 항목으로 그린 PDF입니다.",
      )}
    </div>
  );
}

/** 제7호(간호사) 월간 기록지: 수급자의 그 달 확정 방문을 원본 한 장(5칸)에 모은다. */
export function NurseMonthPdfButton({
  recipientId,
  month,
}: {
  recipientId: string;
  /** YYYY-MM(방문 예정일의 달 — 서버가 예정일로 그 달 방문을 모은다) */
  month: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      title="이 수급자의 그 달 확정된 간호사 방문을 별지 제7호 한 장(방문 5칸)에 모읍니다."
      onClick={async () => {
        setPending(true);
        await openPdf(() =>
          api.recipients.nurseMonthPdf(recipientId, { month }),
        );
        setPending(false);
      }}
    >
      {pending ? <Spinner /> : <FileTextIcon />}
      {Number(month.slice(5))}월 월간 기록지(제7호)
    </Button>
  );
}
