import {
  CARE_GRADE_LABELS,
  CARE_GRADES,
  formatKstDate,
  GENDER_LABELS,
  GENDERS,
  PROGRAM_LABELS,
  requiresCareGrade,
  type Program,
} from "@repo/shared-types";
import { Controller, useFormContext } from "react-hook-form";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { DateInput } from "@/components/ui/date-input";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RecipientFieldValues } from "@/features/recipients/lib/recipient-form";

/**
 * 수급자 등록·수정 폼의 공통 입력 칸. FormProvider 안에서 쓴다.
 * 비워 둔 선택 입력("")은 스키마가 null로 바꾼다.
 * organizationPrograms는 수급자 기관이 하는 사업이다(등록 사업은 이 안에서 고른다). 기관을 아직 모르면 undefined.
 */
export function RecipientFields({
  idPrefix,
  organizationPrograms,
  programsRequired,
}: {
  idPrefix: string;
  organizationPrograms: readonly Program[] | undefined;
  /** 등록할 때는 등록 사업이 하나 이상 있어야 한다(수정할 때는 비워도 저장된다). */
  programsRequired: boolean;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<RecipientFieldValues>();
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid grid-cols-6 gap-x-4 gap-y-4">
      <FormField
        label="이름"
        className="col-span-3"
        htmlFor={id("name")}
        required
        error={errors.name?.message}
      >
        <Input
          id={id("name")}
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.name}
          {...register("name")}
        />
      </FormField>
      <FormField
        label="생년월일"
        className="col-span-3"
        htmlFor={id("birthDate")}
        error={errors.birthDate?.message}
      >
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <DateInput
              id={id("birthDate")}
              max={formatKstDate()}
              aria-invalid={!!errors.birthDate}
              {...field}
              value={field.value ?? ""}
            />
          )}
        />
      </FormField>
      <FormField
        label="성별"
        className="col-span-2"
        htmlFor={id("gender")}
        error={errors.gender?.message}
      >
        <Select
          id={id("gender")}
          aria-invalid={!!errors.gender}
          {...register("gender")}
        >
          <option value="">선택 안 함</option>
          {GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {GENDER_LABELS[gender]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="장기요양등급"
        className="col-span-2"
        htmlFor={id("careGrade")}
        error={errors.careGrade?.message}
      >
        <Select
          id={id("careGrade")}
          aria-invalid={!!errors.careGrade}
          {...register("careGrade")}
        >
          <option value="">선택 안 함</option>
          {CARE_GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {CARE_GRADE_LABELS[grade]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="장기요양인정번호"
        className="col-span-2"
        htmlFor={id("ltcCertNumber")}
        error={errors.ltcCertNumber?.message}
      >
        <Input
          id={id("ltcCertNumber")}
          autoComplete="off"
          aria-invalid={!!errors.ltcCertNumber}
          {...register("ltcCertNumber")}
        />
      </FormField>
      <FormField
        label="등록 사업"
        className="col-span-6"
        required={programsRequired}
        error={errors.programs?.message}
        hint="수급자가 동의·등록한 사업입니다. 방문은 이 중에서 고르고, 재택의료센터 수급자의 의사 방문은 별지 제4호를 함께 씁니다"
      >
        {organizationPrograms === undefined ? (
          <p className="text-muted-foreground text-sm">
            기관을 먼저 선택해 주세요.
          </p>
        ) : organizationPrograms.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            이 기관에 설정된 사업이 없습니다. 기관 메뉴에서 사업을 설정해
            주세요.
          </p>
        ) : (
          <Controller
            control={control}
            name="programs"
            render={({ field }) => (
              <CheckboxGroup
                label="등록 사업"
                className="flex flex-wrap gap-x-5 gap-y-2"
                options={organizationPrograms.map((program) => ({
                  value: program,
                  label: PROGRAM_LABELS[program],
                  note: requiresCareGrade(program)
                    ? "(장기요양등급 필요)"
                    : undefined,
                }))}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        )}
      </FormField>
      <FormField
        label="연락처"
        htmlFor={id("phone")}
        error={errors.phone?.message}
        className="col-span-2"
      >
        <Input
          id={id("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="010-0000-0000"
          aria-invalid={!!errors.phone}
          {...register("phone")}
        />
      </FormField>
      <FormField
        label="주소"
        htmlFor={id("address")}
        error={errors.address?.message}
        className="col-span-4"
      >
        <Input
          id={id("address")}
          autoComplete="off"
          aria-invalid={!!errors.address}
          {...register("address")}
        />
      </FormField>
      <FormField
        label="보호자 이름"
        className="col-span-3"
        htmlFor={id("guardianName")}
        error={errors.guardianName?.message}
      >
        <Input
          id={id("guardianName")}
          autoComplete="off"
          aria-invalid={!!errors.guardianName}
          {...register("guardianName")}
        />
      </FormField>
      <FormField
        label="보호자 연락처"
        className="col-span-3"
        htmlFor={id("guardianPhone")}
        error={errors.guardianPhone?.message}
      >
        <Input
          id={id("guardianPhone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="010-0000-0000"
          aria-invalid={!!errors.guardianPhone}
          {...register("guardianPhone")}
        />
      </FormField>
      <FormField
        label="메모"
        htmlFor={id("notes")}
        error={errors.notes?.message}
        className="col-span-6"
        hint="질환·주의사항 등 방문 담당자가 알아야 할 내용"
      >
        <Textarea
          id={id("notes")}
          rows={3}
          aria-invalid={!!errors.notes}
          {...register("notes")}
        />
      </FormField>
    </div>
  );
}
