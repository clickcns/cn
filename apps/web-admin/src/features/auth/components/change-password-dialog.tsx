import { zodResolver } from "@hookform/resolvers/zod";
import { getErrorMessage, getErrorStatus } from "@repo/api-client";
import {
  ChangePasswordFormSchema,
  getPasswordMinLength,
} from "@repo/shared-types";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { useChangePassword } from "@/features/auth/hooks/use-change-password";

/**
 * 본인 비밀번호 바꾸기 창(헤더). 다른 사용자의 비밀번호는 사용자 화면의 [비밀번호 재설정]으로
 * 바꾼다. 닫으면 입력한 값은 지운다.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success(
            "비밀번호를 바꿨습니다. 다른 기기에서는 다시 로그인해야 합니다.",
          );
          onDone();
        },
        onError: (error) => {
          // 폼 검사를 통과한 뒤의 400은 지금 비밀번호가 틀린 경우다.
          if (getErrorStatus(error) === 400) {
            setError(
              "currentPassword",
              { message: getErrorMessage(error) },
              { shouldFocus: true },
            );
          } else {
            toast.error(getErrorMessage(error));
          }
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>비밀번호 변경</DialogTitle>
        <DialogDescription>
          이 브라우저의 로그인은 그대로 유지되고, 다른 기기에서는 새 비밀번호로
          다시 로그인해야 합니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <FormField
          label="지금 비밀번호"
          htmlFor="change-password-current"
          required
          error={errors.currentPassword?.message}
        >
          <Input
            id="change-password-current"
            type="password"
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!errors.currentPassword}
            {...register("currentPassword")}
          />
        </FormField>
        <FormField
          label="새 비밀번호"
          htmlFor="change-password-new"
          required
          error={errors.newPassword?.message}
          hint={`${getPasswordMinLength()}자 이상`}
        >
          <Input
            id="change-password-new"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            {...register("newPassword")}
          />
        </FormField>
        <FormField
          label="새 비밀번호 확인"
          htmlFor="change-password-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            id="change-password-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
        </FormField>
      </DialogBody>
      <FormDialogFooter
        submitText="변경"
        onCancel={onDone}
        isPending={changePassword.isPending}
      />
    </form>
  );
}
