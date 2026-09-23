import type * as React from "react";
import {
  Controller,
  type FieldPathByValue,
  type FieldValues,
  type UseControllerProps,
} from "react-hook-form";
import { Switch } from "@/components/ui/switch";

type SwitchFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean | undefined>,
  TTransformedValues,
> = Pick<
  UseControllerProps<TFieldValues, TName, TTransformedValues>,
  "control" | "name"
> & {
  id: string;
  label: string;
  description: React.ReactNode;
  disabled?: boolean;
};

/** 라벨·설명과 켜고 끄는 스위치 한 줄. react-hook-form의 boolean 칸에 연결한다. */
export function SwitchField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, boolean | undefined>,
  TTransformedValues,
>({
  control,
  name,
  id,
  label,
  description,
  disabled,
}: SwitchFieldProps<TFieldValues, TName, TTransformedValues>) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-muted-foreground text-[13px]">{description}</p>
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            id={id}
            checked={field.value === true}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            disabled={disabled}
          />
        )}
      />
    </div>
  );
}
