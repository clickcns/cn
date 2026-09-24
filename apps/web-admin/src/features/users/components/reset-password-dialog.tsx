import { zodResolver } from "@hookform/resolvers/zod";
import {
  getPasswordMinLength,
  UpdateUserSchema,
  type UserSummary,
} from "@repo/shared-types";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUpdateUser } from "@/features/users/hooks/use-users";

/** 비밀번호 규칙은 서버와 같은 UpdateUserSchema의 password를 그대로 쓴다. */
const ResetPasswordFormSchema = z
  .object({
    password: UpdateUserSchema.shape.password.unwrap(),
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해 주세요"),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["passwordConfirm"],
  });

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSummary | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {user && (
          <ResetPasswordForm
            key={user.id}
            user={user}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordForm({
  user,
  onDone,
}: {
  user: UserSummary;
  onDone: () => void;
}) {
  const updateUser = useUpdateUser({
    successMessage: "비밀번호를 재설정했습니다",
  });
  // 서버는 비밀번호를 바꾸면 그 사용자의 세션을 모두 끊는다.
  const isSelf = useCurrentUser()?.id === user.id;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const onSubmit = handleSubmit(({ password }) => {
    updateUser.mutate(
      { id: user.id, input: { password } },
      { onSuccess: onDone },
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>비밀번호 재설정</DialogTitle>
        <DialogDescription>
          <span className="text-foreground font-medium">
            {user.name} ({user.username})
          </span>{" "}
          계정의 비밀번호를 새로 정합니다.{" "}
          {isSelf
            ? "본인 비밀번호를 바꾸면 이 화면에서도 다시 로그인해야 합니다."
            : "그 계정으로 로그인한 기기는 모두 로그아웃됩니다."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="새 비밀번호"
          htmlFor="reset-password"
          required
          error={errors.password?.message}
          hint={`${getPasswordMinLength()}자 이상`}
        >
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!errors.password}
            {...register("password")}
          />
        </FormField>
        <FormField
          label="새 비밀번호 확인"
          htmlFor="reset-password-confirm"
          required
          error={errors.passwordConfirm?.message}
        >
          <Input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.passwordConfirm}
            {...register("passwordConfirm")}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText="재설정"
        onCancel={onDone}
        isPending={updateUser.isPending}
      />
    </form>
  );
}
