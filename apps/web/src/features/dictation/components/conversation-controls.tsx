import { useState } from "react";
import {
  formatMinutes,
  hasConversation,
  type RecordingConsent,
} from "@repo/shared-types";
import {
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  MessagesSquare,
  Pause,
  Play,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import {
  DICTATION_SHEET_ID,
  LevelMeter,
  RecordingDot,
} from "@/features/dictation/components/recording-parts";
import {
  useConversationLevel,
  useConversationSeconds,
  type ConversationMeter,
} from "@/features/dictation/hooks/use-conversation-recorder";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";
import { formatClock } from "@/features/dictation/lib/clock";
import { formatDateLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

const minutesOf = (seconds: number) =>
  formatMinutes(Math.max(1, Math.round(seconds / 60)));

/**
 * 기록 화면 위의 대화 녹음 카드. 수급자 녹음 동의가 있을 때만 녹음을 시작한다(동의는 기관 관리자가 관리 웹에 적는다).
 * - 녹음 전: 무엇을 하는지·동의 기록과 [대화 녹음 시작](시작 전에 녹음을 알렸는지 한 번 묻는다). 구술을 받은 뒤에만
 *   누를 수 있다(서버에 끝내지 않은 녹음이 있는지 먼저 안다).
 * - 끝내지 않은 녹음이 서버에 있으면: [초안 만들기]·[이어서 녹음]·[버리기]. 그 사이 동의가 지워졌으면
 *   [버리기]만 둔다(남은 조각이 확정을 막으므로 동의가 없어도 지울 수 있어야 한다).
 * - 녹음 중에는 저장 버튼 바와 그 위 시트가 조작하므로 카드는 숨는다. 초안으로 만든 뒤에도 숨는다
 *   (그 뒤에는 기존 [이어서 말하기]로 덧붙인다. [처음부터]로 구술을 지우면 다시 보인다).
 */
export function ConversationCard({
  session,
  consent,
}: {
  session: DictationSession;
  consent: RecordingConsent | null;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const { conversation, pendingConversation } = session;
  if (session.isConversationActive) return null;
  if (!consent && !pendingConversation) return null;
  // 이미 대화 녹음으로 초안을 만들었다.
  if (
    !pendingConversation &&
    hasConversation(session.dictation?.sentences ?? [])
  ) {
    return null;
  }

  const otherBusy = session.isBusy || !session.isLoaded;

  if (pendingConversation) {
    return (
      <Card className="gap-4">
        <Notice
          tone="warning"
          icon={MessagesSquare}
          message={
            consent
              ? `끝내지 않은 대화 녹음이 있습니다 · ${minutesOf(pendingConversation.seconds)}`
              : `녹음 동의가 지워져 끝내지 않은 대화 녹음(${minutesOf(pendingConversation.seconds)})으로 초안을 만들 수 없습니다. 버린 뒤 확정해 주세요`
          }
        >
          <div className="flex flex-wrap gap-3">
            {consent && (
              <>
                <Button
                  className="flex-1"
                  onClick={conversation.finishPending}
                  disabled={otherBusy}
                >
                  <ClipboardList />
                  초안 만들기
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => void conversation.start()}
                  disabled={otherBusy}
                >
                  <Play />
                  이어서 녹음
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => setDiscardOpen(true)}
              disabled={otherBusy}
            >
              <Trash2 />
              버리기
            </Button>
          </div>
        </Notice>
        <DiscardConversationDialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          onConfirm={() => {
            setDiscardOpen(false);
            void conversation.discard();
          }}
        />
      </Card>
    );
  }
  if (!consent) return null;

  return (
    <Card className="gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-primary-soft text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
          <MessagesSquare className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">방문 중 대화 녹음</p>
          <p className="text-muted-foreground text-sm">
            대화를 처음부터 녹음해 두면, 끝낸 뒤 기록 초안을 만듭니다. 음성은
            남기지 않습니다.
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        녹음 동의 {formatDateLabel(consent.on)} · {consent.by}
      </p>
      <Button
        variant="soft"
        className="w-full"
        onClick={() => setStartOpen(true)}
        disabled={otherBusy}
      >
        <MessagesSquare />
        대화 녹음 시작
      </Button>
      <ConfirmDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onConfirm={() => {
          setStartOpen(false);
          void conversation.start();
        }}
        title="녹음을 알렸나요?"
        description={`수급자·보호자(${consent.by})에게 지금부터 대화를 녹음한다고 알린 뒤 시작해 주세요. 녹음하는 동안 화면을 켜 둔 채 이 화면에 두어야 합니다.`}
        confirmText="녹음 시작"
      />
    </Card>
  );
}

function DiscardConversationDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="대화 녹음을 버릴까요?"
      description="지금까지 녹음한 대화가 지워집니다. 이미 만든 초안과 서식에 채운 내용은 그대로 남습니다."
      confirmText="버리기"
      variant="destructive"
    />
  );
}

/** 녹음 길이(초마다 바뀐다 — 이 부분만 다시 그린다). */
function ConversationClock({
  meter,
  className,
}: {
  meter: ConversationMeter;
  className?: string;
}) {
  const seconds = useConversationSeconds(meter);
  return (
    <span className={cn("tabular-nums", className)}>
      {formatClock(seconds)}
    </span>
  );
}

function ConversationLevel({ meter }: { meter: ConversationMeter }) {
  return <LevelMeter level={useConversationLevel(meter)} />;
}

/**
 * 대화 녹음 중 저장 버튼 바의 [녹음] 자리에 두는 작은 표시. 서식을 채우고 저장하는 동안에도 녹음이 이어지므로
 * 바를 차지하지 않는다. 누르면 위 시트(멈춤·끝내기)를 접고 편다.
 */
export function ConversationBarControl({
  session,
}: {
  session: DictationSession;
}) {
  const { conversation } = session;
  const recording = conversation.status === "recording";
  return (
    <button
      type="button"
      onClick={session.toggleConversationSheet}
      aria-expanded={session.conversationSheetOpen}
      aria-controls={DICTATION_SHEET_ID}
      aria-label="대화 녹음 조작 펼치기"
      className="border-input hover:bg-muted focus-visible:ring-ring/30 flex h-13 shrink-0 items-center gap-2 rounded-xl border px-3 font-bold outline-none focus-visible:ring-4"
    >
      <RecordingDot active={recording} />
      {conversation.status === "finishing" ? (
        <LoaderCircle className="text-primary size-5 animate-spin" />
      ) : (
        <ConversationClock meter={conversation.meter} />
      )}
    </button>
  );
}

/** 저장 버튼 바 위 시트의 대화 녹음 조작: 상태, 멈춤·이어서·끝내기·버리기, 보내기 실패. */
export function ConversationSheetContent({
  session,
}: {
  session: DictationSession;
}) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const { conversation } = session;
  const { status } = conversation;
  /** 마이크를 켠 녹음(멈춤 포함) — 멈추기·끝내기·버리기를 할 수 있다 */
  const live = status === "recording" || status === "paused";

  const headline = (() => {
    if (status === "finishing") {
      return (
        <div role="status" className="flex items-center gap-3">
          <LoaderCircle className="text-primary size-6 shrink-0 animate-spin" />
          <div>
            <p className="font-bold">대화로 기록 초안을 만드는 중입니다</p>
            <p className="text-muted-foreground text-sm">
              남은 녹음을 보내고 서식 항목을 채웁니다. 1분 안팎 걸립니다.
            </p>
            {conversation.notice && (
              <p className="text-warning text-sm font-semibold">
                {conversation.notice}
              </p>
            )}
          </div>
        </div>
      );
    }
    const recording = status === "recording";
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-bold">
          <RecordingDot active={recording} />
          {status === "starting"
            ? "마이크를 켜는 중입니다"
            : recording
              ? "대화 녹음 중"
              : "녹음을 멈췄습니다"}
          <ConversationClock
            meter={conversation.meter}
            className="text-muted-foreground font-semibold"
          />
        </p>
        {recording && <ConversationLevel meter={conversation.meter} />}
        <p className="text-muted-foreground text-sm">
          {conversation.notice ??
            "화면을 켜 둔 채 이 화면에 두세요. 다른 앱으로 가거나 화면이 꺼지면 녹음이 멈출 수 있습니다. 서식은 녹음하면서 채우고 저장해도 됩니다."}
        </p>
        <p className="text-muted-foreground text-sm">
          보낸 녹음 {session.pendingConversation?.segments ?? 0}조각 · 음성은
          글로 옮긴 뒤 남기지 않습니다
        </p>
      </div>
    );
  })();

  return (
    <div className="flex flex-col gap-3">
      {headline}
      {conversation.failure && (
        <Notice
          tone="destructive"
          icon={CircleAlert}
          message={conversation.failure}
        >
          <Button onClick={conversation.retry}>
            <RotateCw />
            다시 시도
          </Button>
        </Notice>
      )}
      <div className="flex flex-wrap gap-3">
        {status === "recording" && (
          <Button variant="outline" onClick={conversation.pause}>
            <Pause />
            잠시 멈춤
          </Button>
        )}
        {status === "paused" && (
          <Button variant="outline" onClick={() => void conversation.start()}>
            <Play />
            이어서 녹음
          </Button>
        )}
        {live && (
          <Button className="flex-1" onClick={conversation.finish}>
            <ClipboardList />
            끝내고 초안 만들기
          </Button>
        )}
        {/* 초안을 만드는 동안 버리면 서버의 초안과 엇갈린다. 실패해 멈췄을 때만 버린다. */}
        {(live || conversation.failure !== null) && (
          <Button variant="ghost" onClick={() => setDiscardOpen(true)}>
            <Trash2 />
            버리기
          </Button>
        )}
      </div>
      <DiscardConversationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={() => {
          setDiscardOpen(false);
          void conversation.discard();
        }}
      />
    </div>
  );
}
