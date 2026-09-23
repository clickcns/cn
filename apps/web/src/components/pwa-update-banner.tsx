import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1시간

/**
 * 새 버전 안내. 기록 작성 중에 강제로 바뀌면 입력이 날아가므로(registerType: "prompt")
 * 사용자가 [새로고침]을 누를 때만 적용한다.
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // 앱을 오래 켜 두는 경우를 위해 주기적으로 새 버전을 확인한다.
      setInterval(() => {
        registration.update().catch(() => {
          // 오프라인이면 다음 주기에 다시 확인한다.
        });
      }, UPDATE_CHECK_INTERVAL);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="bottom-above-stack pointer-events-none fixed inset-x-0 z-50 px-4"
    >
      <div className="bg-foreground text-background pointer-events-auto mx-auto flex max-w-xl items-center gap-3 rounded-2xl py-2 pr-2 pl-5 shadow-xl">
        <RefreshCw className="size-5 shrink-0" />
        <p className="flex-1 font-semibold">새 버전이 있습니다</p>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          새로고침
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-background hover:bg-background/10 active:bg-background/10"
          aria-label="나중에"
          onClick={() => setNeedRefresh(false)}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
