import { FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { openPdf } from "@/features/visits/lib/open-pdf";
import { api } from "@/lib/api";

/** 확정된 기록을 서식 PDF로 연다(원본 서식이 있으면 원본 위에 채운다). 지금 확정본 기준. */
export function FormPdfButton({
  visitId,
  version,
}: {
  visitId: string;
  version: number;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await openPdf(() =>
          api.visits.versionPdf(visitId, version, { style: "original" }),
        );
        setPending(false);
      }}
    >
      <FileText />
      {pending ? "만드는 중…" : "서식 PDF"}
    </Button>
  );
}
