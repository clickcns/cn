import { zodResolver } from "@hookform/resolvers/zod";
import {
  allowsProfession,
  assignableRoles,
  requiresOrganization,
  ROLE_LABELS,
  UpdateUserSchema,
  type UpdateUserInput,
  type UserSummary,
} from "@repo/shared-types";
import { useForm, useWatch } from "react-hook-form";
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
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch-field";
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import { OrganizationSelectField } from "@/features/organizations/components/organization-select-field";
import { ProfessionFields } from "@/features/users/components/profession-fields";
import { useUpdateUser } from "@/features/users/hooks/use-users";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSummary | null;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
}: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {user && (
          <EditUserForm
            key={user.id}
            user={user}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditUserForm({
  user,
  onDone,
}: {
  user: UserSummary;
  onDone: () => void;
}) {
  const actor = useCurrentUser();
  const isAdmin = useIsAdmin();
  const isSelf = actor?.id === user.id;
  const updateUser = useUpdateUser({
    successMessage: "사용자 정보를 수정했습니다",
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: user.name,
      role: user.role,
      profession: user.profession ?? "",
      licenseNumber: user.licenseNumber ?? "",
      isActive: user.isActive,
      organizationId: user.organizationId,
    },
  });
  const role = useWatch({ control, name: "role" }) ?? user.role;
  const profession = useWatch({ control, name: "profession" });
  // 기관은 운영자만 바꾼다. 운영자 역할로 바꾸면 서버가 기관을 비운다.
  const needsOrg = isAdmin && requiresOrganization(role);
  // 방문은 담당자의 기관에 묶여 있어, 확정하지 않은 방문이 있으면 서버가 소속 기관 변경을
  // 409로 막는다(문구는 useUpdateUser가 토스트로 보여 주고 다이얼로그는 열어 둔다).
  const leavesOrganization =
    user.organizationId !== null && !requiresOrganization(role);
  // 기관 관리자 화면에는 운영자가 나오지 않지만, 혹시 있으면 현재 역할도 고를 수 있게 둔다.
  const roleOptions = assignableRoles(actor?.role ?? "MANAGER");
  const selectableRoles = roleOptions.includes(user.role)
    ? roleOptions
    : [user.role, ...roleOptions];

  const onSubmit = handleSubmit((values) => {
    if (needsOrg && !values.organizationId) {
      setError("organizationId", { message: "기관을 선택해 주세요" });
      return;
    }
    const input: UpdateUserInput = { name: values.name };
    // 본인 계정의 역할·활성 여부는 바꾸지 않는다(스스로 잠기는 일을 막는다).
    if (!isSelf) {
      if (values.role !== user.role) input.role = values.role;
      if (values.isActive !== user.isActive) input.isActive = values.isActive;
    }
    if (needsOrg && values.organizationId !== user.organizationId) {
      input.organizationId = values.organizationId;
    }
    // 빈 입력은 스키마가 null로 바꾼다. 운영자로 바꾸면 서버가 직종·번호를 비운다.
    if (allowsProfession(values.role ?? user.role)) {
      if ((values.profession ?? null) !== user.profession) {
        input.profession = values.profession;
      }
      if ((values.licenseNumber ?? null) !== user.licenseNumber) {
        input.licenseNumber = values.licenseNumber;
      }
    }
    updateUser.mutate({ id: user.id, input }, { onSuccess: onDone });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>사용자 정보 수정</DialogTitle>
        <DialogDescription>
          <span className="text-foreground font-medium">{user.username}</span>{" "}
          계정의 이름·역할·직종·활성 여부를 바꿉니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="이름"
          htmlFor="edit-user-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="edit-user-name"
            autoComplete="off"
            autoFocus
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </FormField>
        <FormField
          label="역할"
          htmlFor="edit-user-role"
          error={errors.role?.message}
          hint={
            isSelf
              ? "본인 계정의 역할은 바꿀 수 없습니다."
              : leavesOrganization
                ? "운영자로 바꾸면 소속 기관이 비워집니다. 확정하지 않은 방문이 있으면 바꿀 수 없습니다."
                : undefined
          }
        >
          <Select
            id="edit-user-role"
            disabled={isSelf}
            aria-invalid={!!errors.role}
            {...register("role")}
          >
            {selectableRoles.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </FormField>
        {allowsProfession(role) && (
          <ProfessionFields
            idPrefix="edit-user"
            role={role}
            profession={profession || null}
            professionField={register("profession")}
            licenseField={register("licenseNumber")}
            professionError={errors.profession?.message}
            licenseError={errors.licenseNumber?.message}
            professionHint={
              user.profession
                ? "확정하지 않은 방문이 있으면 직종을 바꿀 수 없습니다(방문 서식이 직종으로 정해집니다)."
                : undefined
            }
          />
        )}
        {needsOrg && (
          <OrganizationSelectField
            control={control}
            name="organizationId"
            id="edit-user-organization"
            hint={
              user.organizationId !== null
                ? "확정하지 않은 방문(예정·작성 중)이 있으면 기관을 바꿀 수 없습니다."
                : undefined
            }
          />
        )}
        <SwitchField
          control={control}
          name="isActive"
          id="edit-user-active"
          label="계정 활성"
          description={
            isSelf
              ? "본인 계정은 비활성으로 바꿀 수 없습니다."
              : "끄면 이 계정으로 로그인할 수 없습니다."
          }
          disabled={isSelf}
        />
      </DialogBody>
      <FormDialogFooter
        submitText="저장"
        onCancel={onDone}
        isPending={updateUser.isPending}
      />
    </form>
  );
}
