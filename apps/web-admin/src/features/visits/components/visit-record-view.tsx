import {
  FORMS,
  formatFieldValue,
  withParticle,
  type FormData,
  type FormDef,
  type FormId,
  type VisitDetail,
  type VisitForms,
} from "@repo/shared-types";
import { FileTextIcon, NotebookPenIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-state";
import { DescriptionList } from "@/components/ui/description-list";

/** 서식 한 장: 서식 구분(섹션)마다 칸과 값. 빈 칸은 "—". */
function FormCard({ form, data }: { form: FormDef; data: FormData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="text-primary size-4" />
          <span className="text-muted-foreground font-medium">{form.code}</span>
          {form.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {form.sections.map((section) => (
          <section key={section.title} className="grid gap-2.5">
            <h3 className="text-[13px] font-semibold">{section.title}</h3>
            <DescriptionList
              columns={2}
              items={section.fields.map((field) => {
                const text = formatFieldValue(field, data[field.key]);
                return {
                  label: field.label,
                  value: text ? (
                    <span className="whitespace-pre-wrap">{text}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
                  wide: field.type === "text" || text.length > 30,
                };
              })}
            />
          </section>
        ))}
        <p className="text-muted-foreground text-[12px]">
          작성 후 {form.submitTo}에 입력합니다.
        </p>
      </CardContent>
    </Card>
  );
}

/** 방문 기록 읽기 전용 보기: 이 방문의 서식들(사업·담당자 직종으로 정해짐). */
export function VisitRecordView({ visit }: { visit: VisitDetail }) {
  if (!visit.formIds.some((formId) => visit.forms[formId])) {
    return (
      <Card>
        <EmptyState
          icon={NotebookPenIcon}
          title="아직 작성된 기록이 없습니다"
          description={`담당자가 방문 후 현장 웹에서 ${withParticle(
            visit.formIds.map((formId) => FORMS[formId].shortTitle).join("·"),
            "을/를",
          )} 작성하면 여기에 표시됩니다.`}
        />
      </Card>
    );
  }

  return <RecordFormCards formIds={visit.formIds} forms={visit.forms} />;
}

/** 서식들을 읽기 전용 카드로(저장하지 않은 서식은 빈 카드). 지금 기록과 지난 확정본이 함께 쓴다. */
export function RecordFormCards({
  formIds,
  forms,
}: {
  formIds: readonly FormId[];
  forms: VisitForms;
}) {
  return (
    <div className="grid gap-5">
      {formIds.map((formId) => {
        const data = forms[formId];
        return data ? (
          <FormCard key={formId} form={FORMS[formId]} data={data} />
        ) : (
          <Card key={formId}>
            <EmptyState
              icon={NotebookPenIcon}
              title={`${withParticle(FORMS[formId].shortTitle, "이/가")} 아직 저장되지 않았습니다`}
            />
          </Card>
        );
      })}
    </div>
  );
}
