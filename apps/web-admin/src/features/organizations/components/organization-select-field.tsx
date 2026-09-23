import type * as React from "react";
import {
  Controller,
  type FieldPathByValue,
  type FieldValues,
  type UseControllerProps,
} from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { useOrganizations } from "@/features/organizations/hooks/use-organizations";

type OrganizationSelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string | null | undefined>,
  TTransformedValues,
> = Pick<
  UseControllerProps<TFieldValues, TName, TTransformedValues>,
  "control" | "name"
> & {
  id: string;
  /** 칸 아래 도움말. 검증 오류가 있으면 오류가 대신 보인다. */
  hint?: React.ReactNode;
};

/**
 * 폼의 필수 기관 선택 칸(운영자 전용). 고르지 않으면 null이다.
 * 목록이 늦게 와도 선택값이 어긋나지 않도록 제어 컴포넌트로 쓴다.
 */
export function OrganizationSelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string | null | undefined>,
  TTransformedValues,
>({
  control,
  name,
  id,
  hint,
}: OrganizationSelectFieldProps<TFieldValues, TName, TTransformedValues>) {
  const { data: organizations, isPending } = useOrganizations();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField
          label="기관"
          htmlFor={id}
          required
          error={fieldState.error?.message}
          hint={hint}
        >
          <Select
            id={id}
            aria-invalid={fieldState.invalid}
            disabled={isPending}
            ref={field.ref}
            value={field.value ?? ""}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value || null)}
          >
            <option value="">
              {isPending ? "기관 목록을 불러오는 중…" : "기관을 선택해 주세요"}
            </option>
            {organizations?.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}
    />
  );
}
