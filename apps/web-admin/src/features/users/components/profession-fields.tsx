import {
  LICENSE_LABELS,
  PROFESSION_LABELS,
  PROFESSIONS,
  requiresProfession,
  type Profession,
  type Role,
} from "@repo/shared-types";
import type { UseFormRegisterReturn } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/**
 * 직종·면허번호 입력. 직종이 방문 때 쓰는 서식을 정한다(의사: 방문진료 점검서식 등).
 * 현장 직원은 직종이 필수이고, 기관 관리자는 직접 방문할 때만 고른다. 운영자에게는 보이지 않는다.
 */
export function ProfessionFields({
  idPrefix,
  role,
  profession,
  professionField,
  licenseField,
  professionError,
  licenseError,
  professionHint,
}: {
  idPrefix: string;
  role: Role;
  profession: Profession | null | undefined;
  professionField: UseFormRegisterReturn;
  licenseField: UseFormRegisterReturn;
  professionError?: string;
  licenseError?: string;
  professionHint?: string;
}) {
  const required = requiresProfession(role);
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        label="직종"
        htmlFor={`${idPrefix}-profession`}
        required={required}
        error={professionError}
        hint={
          professionHint ??
          (required ? undefined : "직접 방문하는 관리자만 고릅니다")
        }
      >
        <Select
          id={`${idPrefix}-profession`}
          aria-invalid={!!professionError}
          {...professionField}
        >
          <option value="">{required ? "직종을 선택해 주세요" : "없음"}</option>
          {PROFESSIONS.map((option) => (
            <option key={option} value={option}>
              {PROFESSION_LABELS[option]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label={profession ? LICENSE_LABELS[profession] : "면허·자격번호"}
        htmlFor={`${idPrefix}-license`}
        error={licenseError}
        hint="서식에 적는 번호"
      >
        <Input
          id={`${idPrefix}-license`}
          autoComplete="off"
          aria-invalid={!!licenseError}
          {...licenseField}
        />
      </FormField>
    </div>
  );
}
