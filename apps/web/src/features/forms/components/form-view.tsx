import type { ReactNode } from "react";
import {
  formatFieldValue,
  type FormData,
  type FormDef,
  type FormSection,
} from "@repo/shared-types";
import { FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/** 서식 제목 줄: 별지 번호·서식 이름·입력하는 곳. */
export function FormHeading({ form }: { form: FormDef }) {
  return (
    <div className="flex items-start gap-3 px-1">
      <FileText className="text-primary mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-bold">
          <span className="text-muted-foreground mr-1.5 font-semibold">
            {form.code}
          </span>
          {form.title}
        </p>
        <p className="text-muted-foreground text-sm">
          작성 후 {form.submitTo}에 입력합니다
        </p>
      </div>
    </div>
  );
}

/** 읽기 전용 서식. 빈 칸은 "—". sectionAction 을 주면 구분 카드 머리 오른쪽에 둔다(지난 기록 불러오기). */
export function FormView({
  form,
  data,
  sectionAction,
}: {
  form: FormDef;
  data: FormData | undefined;
  sectionAction?: (section: FormSection) => ReactNode;
}) {
  if (!data) {
    return (
      <Card>
        <p className="text-muted-foreground">저장된 기록이 없습니다</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {form.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>{section.title}</CardTitle>
            {sectionAction?.(section)}
          </CardHeader>
          <dl className="divide-border divide-y">
            {section.fields.map((field) => {
              const text = formatFieldValue(field, data[field.key]);
              return (
                <div
                  key={field.key}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4"
                >
                  <dt className="text-muted-foreground shrink-0 font-semibold sm:w-44">
                    {field.label}
                  </dt>
                  <dd
                    className={
                      text ? "whitespace-pre-wrap" : "text-muted-foreground"
                    }
                  >
                    {text || "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ))}
    </div>
  );
}
