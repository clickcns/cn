import {
  CARE_GRADE_LABELS,
  CARE_GRADES,
  formatKstDate,
  GENDER_LABELS,
  GENDERS,
} from "@repo/shared-types";
import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RecipientFieldValues } from "@/features/recipients/lib/recipient-form";

/**
 * 수급자 등록·수정 폼의 공통 입력 칸. FormProvider 안에서 쓴다.
 * 비워 둔 선택 입력("")은 스키마가 null로 바꾼다.
 */
export function RecipientFields({ idPrefix }: { idPrefix: string }) {
  const {
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
        <Input
          id={id("birthDate")}
          type="date"
          max={formatKstDate()}
          aria-invalid={!!errors.birthDate}
          {...register("birthDate")}
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
