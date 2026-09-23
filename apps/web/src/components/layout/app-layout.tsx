import { Outlet } from "react-router";
import { AppHeader } from "@/components/layout/app-header";
import { TabBar } from "@/components/layout/tab-bar";

/**
 * 로그인 후 화면 공통 틀.
 * - 넓은 화면(md 이상): 상단 헤더 + 본문 최대 1100px
 * - 좁은 화면: 하단 탭 바(safe-area 패딩 포함)
 */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="pb-bottom-stack mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-8">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
