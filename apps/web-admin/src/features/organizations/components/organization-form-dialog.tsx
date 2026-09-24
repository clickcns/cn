import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateOrganizationSchema,
  PROGRAM_LABELS,
  PROGRAMS,
  type Organization,
} from "@repo/shared-types";
import { Controller, useForm } from "react-hook-form";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  useCreateOrganization,
  useUpdateOrganization,
} from "@/features/organizations/hooks/use-organizations";

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 없으면 등록, 있으면 수정. */
  organization: Organization | null;
}

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
}: OrganizationFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* 열 때마다 새로 마운트해 폼 값을 대상에 맞춘다. */}
        <OrganizationForm
          key={organization?.id ?? "new"}
          organization={organization}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function OrganizationForm({
  organization,
  onDone,
}: {
  organization: Organization | null;
  onDone: () => void;
}) {
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();
  const isEdit = organization !== null;
  const isPending =
    createOrganization.isPending || updateOrganization.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    // 수정도 이름은 필수라 등록 스키마로 검증한다(수정 스키마의 부분 입력과 호환된다).
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: organization?.name ?? "",
      code: organization?.code ?? "",
      programs: organization?.programs ?? [],
    },
  });

  const onSubmit = handleSubmit((input) =>
    organization
      ? updateOrganization.mutate(
          { id: organization.id, input },
          { onSuccess: onDone },
        )
      : createOrganization.mutate(input, { onSuccess: onDone }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{isEdit ? "기관 정보 수정" : "기관 등록"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "기관 이름·코드·사업을 수정합니다."
            : "새 기관을 등록합니다. 등록한 뒤 기관 관리자 계정을 추가하세요."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="기관 이름"
          htmlFor="organization-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="organization-name"
            autoFocus
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </FormField>
        <FormField
          label="기관 코드"
          htmlFor="organization-code"
          error={errors.code?.message}
          hint="요양기관기호·장기요양기관 기호 등 (선택). 서식 머리에 적힙니다"
        >
          <Input
            id="organization-code"
            aria-invalid={!!errors.code}
            {...register("code")}
          />
        </FormField>
        <FormField
          label="사업"
          required
          error={errors.programs?.message}
          hint="수급자 등록 사업과 방문은 이 중에서 고릅니다. 사업을 빼면 그 사업에 등록한 수급자에게서도 빠집니다"
        >
          <Controller
            control={control}
            name="programs"
            render={({ field }) => (
              <CheckboxGroup
                label="사업"
                options={PROGRAMS.map((program) => ({
                  value: program,
                  label: PROGRAM_LABELS[program],
                }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText={isEdit ? "저장" : "등록"}
        onCancel={onDone}
        isPending={isPending}
      />
    </form>
  );
}
