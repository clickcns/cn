import type * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  /** 검증 오류 문구. 있으면 hint 대신 보여 준다. */
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div data-slot="form-field" className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-[13px]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-[13px]">{hint}</p>
      ) : null}
    </div>
  );
}
