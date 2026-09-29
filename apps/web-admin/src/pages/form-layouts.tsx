import {
  FORMS,
  FORMS_WITH_ORIGINAL_PDF,
  type OriginalPdfFormId,
} from "@repo/shared-types";
import { useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { FormLayoutEditor } from "@/features/form-layouts/components/form-layout-editor";
import {
  useFormLayout,
  useFormLayouts,
} from "@/features/form-layouts/hooks/use-form-layouts";
import { useSearchParamsUpdater } from "@/hooks/use-search-params-updater";

export default function FormLayoutsPage() {
  const [searchParams] = useSearchParams();
  const updateSearchParams = useSearchParamsUpdater();
  const formId: OriginalPdfFormId =
    FORMS_WITH_ORIGINAL_PDF.find((id) => id === searchParams.get("form")) ??
    FORMS_WITH_ORIGINAL_PDF[0];
  const summaries = useFormLayouts().data ?? [];
  const detailQuery = useFormLayout(formId);
  const detail = detailQuery.data;

  return (
    <>
      <PageHeader
        title="원본 서식 조정"
        description="원본 서식 PDF(별지 제4·6·7·8호)에 채우는 값의 자리와 글자 모양을 맞춥니다. 저장하면 모든 기관의 PDF에 바로 적용됩니다. 운영자만 볼 수 있습니다."
      />
      <div
        role="tablist"
        aria-label="서식"
        className="mb-4 flex flex-wrap gap-1.5"
      >
        {FORMS_WITH_ORIGINAL_PDF.map((id) => {
          const count =
            summaries.find((summary) => summary.formId === id)?.adjustedCount ??
            0;
          return (
            <Button
              key={id}
              role="tab"
              aria-selected={id === formId}
              variant={id === formId ? "secondary" : "ghost"}
              size="sm"
              onClick={() => updateSearchParams({ form: id })}
            >
              {FORMS[id].code} {FORMS[id].shortTitle}
              {count > 0 && (
                <Badge variant="warning" className="h-5 px-1.5 text-[11px]">
                  {count}칸
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
      {detailQuery.isError ? (
        <ErrorState
          error={detailQuery.error}
          title="서식을 불러오지 못했습니다"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : !detail ? (
        <LoadingState />
      ) : (
        // 저장하면 새 저장 시각으로 편집 화면을 새로 연다(조정 초안을 저장본으로).
        <FormLayoutEditor
          key={`${detail.formId}:${detail.updatedAt}`}
          detail={detail}
        />
      )}
    </>
  );
}
