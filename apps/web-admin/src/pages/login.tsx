import {
  CalendarCheckIcon,
  ClipboardCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { LoginForm } from "@/features/auth/components/login-form";

const HIGHLIGHTS = [
  {
    icon: CalendarCheckIcon,
    text: "방문 일정을 등록하고 의사·간호사·사회복지사에게 배정",
  },
  { icon: ClipboardCheckIcon, text: "작성·확정된 방문 기록을 한곳에서 확인" },
  { icon: UsersRoundIcon, text: "수급자와 직원 계정을 기관별로 관리" },
];

export default function LoginPage() {
  return (
    <div className="bg-background grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <title>로그인 · 케어노트 관리</title>
      <section className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden px-12 py-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            className="size-8 rounded-lg ring-1 ring-white/30"
          />
          <span className="text-lg font-bold tracking-tight">
            케어노트 관리
          </span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl leading-snug font-bold tracking-tight">
            방문 의료·간호 기록을
            <br />
            기관 단위로 관리합니다
          </h1>
          <ul className="mt-8 grid gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 text-[15px] text-white/90"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/12">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-white/60">
          방문 의료·간호 기록 서비스 · 운영자·기관 관리자 전용
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/6"
        />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="text-lg font-bold tracking-tight">
              케어노트 관리
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">관리 웹 로그인</h2>
          <p className="text-muted-foreground mt-1.5 mb-8 text-sm">
            운영자 또는 기관 관리자 계정으로 로그인해 주세요.
          </p>
          <LoginForm />
          <p className="text-muted-foreground mt-8 text-[13px]">
            의사·간호사·사회복지사 계정은 현장 웹에서 사용합니다. 비밀번호를
            잊었다면 기관 관리자에게 재설정을 요청해 주세요.
          </p>
        </div>
      </section>
    </div>
  );
}
