import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@repo/shared-types";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useForm, useFormState } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/features/auth/hooks/use-login";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { control, register, handleSubmit } = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: "", password: "" },
  });
  const { errors } = useFormState({ control });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-username">아이디</Label>
        <Input
          id="login-username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={
            errors.username ? "login-username-error" : undefined
          }
          {...register("username")}
        />
        {errors.username && (
          <p id="login-username-error" className="text-destructive">
            {errors.username.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">비밀번호</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            className="pr-14"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            {...register("password")}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground absolute top-1/2 right-0.5 -translate-y-1/2"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={login.isPending}
      >
        <LogIn />
        {login.isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
