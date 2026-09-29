import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { getErrorMessage, getErrorStatus } from "@repo/api-client";
import {
  ChangePasswordFormSchema,
  getPasswordMinLength,
} from "@repo/shared-types";
import { Eye, EyeOff } from "lucide-react";
import {
  useForm,
  useFormState,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword } from "@/features/auth/hooks/use-change-password";

/** 본인 비밀번호 바꾸기 창. 닫으면 입력한 값은 지운다(다시 열면 빈 칸). */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const changePassword = useChangePassword();
  const { control, register, handleSubmit, setError } = useForm({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const { errors } = useFormState({ control });

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
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>비밀번호 변경</DialogTitle>
        <DialogDescription>
          지금 쓰는 이 기기는 로그인이 그대로 유지되고, 다른 기기에서는 새
          비밀번호로 다시 로그인해야 합니다.
        </DialogDescription>
      </DialogHeader>

      <PasswordField
        id="change-password-current"
        label="지금 비밀번호"
        autoComplete="current-password"
        autoFocus
        error={errors.currentPassword?.message}
        registration={register("currentPassword")}
      />
      <PasswordField
        id="change-password-new"
        label="새 비밀번호"
        autoComplete="new-password"
        hint={`${getPasswordMinLength()}자 이상`}
        error={errors.newPassword?.message}
        registration={register("newPassword")}
      />
      <PasswordField
        id="change-password-confirm"
        label="새 비밀번호 확인"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        registration={register("confirmPassword")}
      />

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? "바꾸는 중…" : "변경"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 비밀번호 칸: 눌러서 입력한 글자를 보고 숨긴다(큰 터치 영역). */
function PasswordField({
  id,
  label,
  autoComplete,
  autoFocus,
  hint,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  hint?: string;
  error: string | undefined;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="pr-14"
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...registration}
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground absolute top-1/2 right-0.5 -translate-y-1/2"
          aria-label={visible ? `${label} 숨기기` : `${label} 보기`}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {message && (
        <p
          id={messageId}
          className={error ? "text-destructive" : "text-muted-foreground"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
