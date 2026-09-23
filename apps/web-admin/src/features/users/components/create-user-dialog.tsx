import { zodResolver } from "@hookform/resolvers/zod";
import {
  allowsProfession,
  assignableRoles,
  CreateUserSchema,
  requiresOrganization,
  ROLE_LABELS,
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
import {
  useCurrentUser,
  useIsAdmin,
} from "@/features/auth/hooks/use-current-user";
import { OrganizationSelectField } from "@/features/organizations/components/organization-select-field";
import { useScopeOrganizationId } from "@/features/organizations/hooks/use-organization-scope";
import { ProfessionFields } from "@/features/users/components/profession-fields";
import { useCreateUser } from "@/features/users/hooks/use-users";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
}: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CreateUserForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const actor = useCurrentUser();
  const isAdmin = useIsAdmin();
  const scopeOrganizationId = useScopeOrganizationId();
  const createUser = useCreateUser();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      username: "",
      name: "",
      password: "",
      role: "STAFF",
      profession: "",
      licenseNumber: "",
      organizationId: scopeOrganizationId,
    },
  });
  const role = useWatch({ control, name: "role" });
  const profession = useWatch({ control, name: "profession" });
  // 기관은 운영자만 고른다. 운영자 계정은 서버가 기관을 비우고,
  // 기관 관리자가 만들면 서버가 자기 기관으로 고정한다.
  const needsOrg = isAdmin && requiresOrganization(role);

  const onSubmit = handleSubmit((values) => {
    if (needsOrg && !values.organizationId) {
      setError("organizationId", { message: "기관을 선택해 주세요" });
      return;
    }
    createUser.mutate(values, { onSuccess: onDone });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>사용자 추가</DialogTitle>
        <DialogDescription>
          추가한 아이디와 비밀번호를 사용자에게 전달해 주세요.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="아이디"
          htmlFor="user-username"
          required
          error={errors.username?.message}
          hint="영문 소문자로 시작하는 3~30자 (영문 소문자·숫자·.-_)"
        >
          <Input
            id="user-username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={!!errors.username}
            {...register("username")}
          />
        </FormField>
        <FormField
          label="이름"
          htmlFor="user-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="user-name"
            autoComplete="off"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </FormField>
        <FormField
          label="역할"
          htmlFor="user-role"
          required
          error={errors.role?.message}
        >
          <Select
            id="user-role"
            aria-invalid={!!errors.role}
            {...register("role")}
          >
            {assignableRoles(actor?.role ?? "MANAGER").map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </FormField>
        {allowsProfession(role) && (
          <ProfessionFields
            idPrefix="user"
            role={role}
            profession={profession || null}
            professionField={register("profession")}
            licenseField={register("licenseNumber")}
            professionError={errors.profession?.message}
            licenseError={errors.licenseNumber?.message}
          />
        )}
        {needsOrg && (
          <OrganizationSelectField
            control={control}
            name="organizationId"
            id="user-organization"
          />
        )}
        <FormField
          label="초기 비밀번호"
          htmlFor="user-password"
          required
          error={errors.password?.message}
          hint="8자 이상"
        >
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText="추가"
        onCancel={onDone}
        isPending={createUser.isPending}
      />
    </form>
  );
}
