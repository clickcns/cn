import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="md:border-border md:bg-card w-full max-w-md md:rounded-3xl md:border md:p-10 md:shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/icons/icon.svg" alt="" className="size-18" />
          <h1 className="text-primary text-2xl font-extrabold">케어노트</h1>
          <p className="text-muted-foreground">방문 의료·간호 기록 도우미</p>
        </div>
        <LoginForm />
        <p className="text-muted-foreground mt-6 text-center text-sm">
          계정이 없거나 비밀번호를 잊었다면 기관 관리자에게 문의해 주세요.
        </p>
      </div>
    </main>
  );
}
