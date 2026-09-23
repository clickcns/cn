import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@repo/shared-types";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useLogin } from "@/features/auth/hooks/use-login";

export function LoginForm() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => login.mutate(values))}
      className="grid gap-5"
    >
      <FormField
        label="아이디"
        htmlFor="login-username"
        error={errors.username?.message}
      >
        <Input
          id="login-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          className="h-11"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
      </FormField>
      <FormField
        label="비밀번호"
        htmlFor="login-password"
        error={errors.password?.message}
      >
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="h-11"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>
      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        disabled={login.isPending}
      >
        {login.isPending && <Spinner />}
        로그인
      </Button>
    </form>
  );
}
