import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getErrorMessage, getErrorStatus } from "@repo/api-client";
import {
  CONVERSATION_MAX_SECONDS,
  CONVERSATION_SEGMENT_SECONDS,
  type ConversationProgress,
  type VisitDictation,
} from "@repo/shared-types";
import {
  createRecorder,
  holdScreenOn,
  MicrophoneError,
  openMicrophone,
  type Microphone,
} from "@/features/dictation/lib/microphone";
import { toWav16kMono } from "@/features/dictation/lib/wav";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { api } from "@/lib/api";

/**
 * - idle: 녹음하지 않음(서버에 끝내지 않은 녹음이 있을 수 있다 — pending)
 * - starting: 마이크를 켜는 중
 * - recording: 녹음 중
 * - paused: 멈춤(사용자가 멈췄거나 마이크가 끊겼거나 서버가 조각을 거절했다). 이어서 녹음하거나 끝낸다
 * - finishing: 남은 조각을 보내고 초안을 만드는 중(실패하면 그대로 머물러 다시 시도한다)
 */
export type ConversationStatus =
  "idle" | "starting" | "recording" | "paused" | "finishing";

/** 녹음한 조각 하나. 조각은 마이크를 켠 구간(run)마다 0부터 번호를 매긴다. */
interface Segment {
  runId: string;
  /** 구간을 시작한 때(ISO) — 서버가 조각을 잇는 순서 */
  runStartedAt: string;
  index: number;
  recording: Blob;
}

/** 마이크를 켠 한 구간(멈췄다 이어 녹음하면 새 구간). */
interface LiveRun {
  runId: string;
  runStartedAt: string;
  microphone: Microphone;
  recorder: MediaRecorder;
  /** 지금 녹음기가 멈추고 조각을 줄에 넣으면 끝난다 */
  stopped: Promise<void>;
  /** 다음 조각 번호 */
  nextIndex: number;
  /** 지금 조각을 시작한 때 */
  segmentStartedAt: number;
  /** 이 구간을 시작한 때 */
  startedAt: number;
  timer: number;
  releaseScreen: () => void;
}

/** 녹음 한 번(초안을 만들거나 버릴 때까지). 멈췄다 이어 녹음해도 같은 녹음이다. */
interface ConversationSession {
  /** 지난 구간까지 녹음한 길이(초) — 서버에 이미 있던 조각 포함 */
  baseSeconds: number;
  /** 녹음했지만 아직 보내지 않은 조각 */
  queue: Segment[];
  /** WAV로 바꿔 보내는 중인 조각(연결 오류로 실패하면 남아 다시 보낸다) */
  sending: (Omit<Segment, "recording"> & { wav: Blob }) | null;
  /** 돌고 있는 보내기(없으면 null). 버리기는 이것이 끝나기를 기다린 뒤 서버에서 지운다 */
  pumping: Promise<void> | null;
  /** 남은 조각을 다 보내면 초안을 만든다 */
  finishRequested: boolean;
  live: LiveRun | null;
  /** 마이크를 켜는 중(같은 [이어서 녹음]이 두 번 눌려도 한 번만 켠다) */
  opening: boolean;
  /** 버리면 남은 조각을 보내지 않는다 */
  discarded: boolean;
  /** 초안에서 빠진 조각이 있다(서버 거절·읽지 못함) — 초안을 만든 뒤에도 알린다 */
  dropped: string | null;
}

const newSession = (pendingSeconds: number): ConversationSession => ({
  baseSeconds: pendingSeconds,
  queue: [],
  sending: null,
  pumping: null,
  finishRequested: false,
  live: null,
  opening: false,
  discarded: false,
  dropped: null,
});

/** 보내기 자동 재시도 간격. 다 쓰면 [다시 시도]를 기다린다(다음 조각이 나와도 다시 시도한다). */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000];
/** 이보다 작은 조각을 읽지 못한 것은 멈출 때 생긴 아주 짧은 끝 조각으로 보고 알리지 않는다(바이트). */
const TINY_SEGMENT_BYTES = 16_000;

/**
 * 다시 보내면 될 수 있는 오류: 연결·서버 오류, 시간 초과(408), 요청 제한(429), 토큰 갱신이 연결 오류로
 * 실패해 돌아온 401(세션이 남아 있다 — 녹음은 토큰 수명보다 길다). 그 밖의 4xx는 다시 보내도 같다.
 */
const isRetryable = (error: unknown) => {
  const status = getErrorStatus(error);
  return (
    status === undefined ||
    status >= 500 ||
    status === 401 ||
    status === 408 ||
    status === 429
  );
};

/** 초안에서 빠지는 부분 알림을 더한다(앞 알림을 지우지 않는다). */
function addDropped(session: { dropped: string | null }, message: string) {
  // 같은 거절은 조각마다 되풀이되므로(동의가 지워짐·확정됨) 같은 문구는 한 번만 둔다.
  if (!session.dropped) session.dropped = message;
  else if (!session.dropped.split(" · ").includes(message)) {
    session.dropped = `${session.dropped} · ${message}`;
  }
  return session.dropped;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function releaseRun(run: LiveRun) {
  window.clearInterval(run.timer);
  run.microphone.release();
  run.releaseScreen();
}

const runSeconds = (run: LiveRun) => (Date.now() - run.startedAt) / 1000;

/**
 * 녹음 길이·입력 크기. 녹음하는 동안 1초에 몇 번씩 바뀌므로 상태로 두지 않고(기록 폼 전체가 다시 그려진다)
 * 작은 저장소에 두어 그 값을 그리는 부분만 구독한다(useConversationSeconds·useConversationLevel).
 */
interface MeterSnapshot {
  /** 녹음한 길이(초, 멈춘 구간 빼고) */
  seconds: number;
  /** 입력 크기 0~1 */
  level: number;
}
function createMeter() {
  let snapshot: MeterSnapshot = { seconds: 0, level: 0 };
  const listeners = new Set<() => void>();
  return {
    set(next: Partial<MeterSnapshot>) {
      const merged = { ...snapshot, ...next };
      if (
        merged.seconds === snapshot.seconds &&
        merged.level === snapshot.level
      ) {
        return;
      }
      snapshot = merged;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => snapshot,
  };
}
export type ConversationMeter = ReturnType<typeof createMeter>;

/** 녹음 길이(초). 초가 바뀔 때만 다시 그린다. */
export function useConversationSeconds(meter: ConversationMeter): number {
  return useSyncExternalStore(meter.subscribe, () => meter.get().seconds);
}

/** 입력 크기(0~1). */
export function useConversationLevel(meter: ConversationMeter): number {
  return useSyncExternalStore(meter.subscribe, () => meter.get().level);
}

/**
 * 방문 중 대화 녹음. 마이크를 켠 채 CONVERSATION_SEGMENT_SECONDS 마다 녹음기를 바꿔(새 녹음기를 먼저 켜고
 * 앞 녹음기를 끈다 — 끊김 없이) 조각을 만들고, 녹음하는 동안 차례로 WAV로 바꿔 올린다(서버가 음성인식해 둔다).
 * 조각 번호는 마이크를 켠 구간(runId)마다 새로 매기므로, 다시 열어 이어 녹음해도 앞 조각과 겹치지 않는다.
 * [끝내기]는 남은 조각을 다 보낸 뒤 서버에 있는 조각을 모두 이어 초안을 만든다. 휴대폰이 꺼지거나 화면을
 * 떠나도 보낸 조각은 서버에 남아(pending), 다시 열면 이어서 녹음하거나 초안을 만들 수 있다.
 * 화면을 떠나면 마이크를 끄고 녹음 중이던 조각을 보내 본다(보내지 못하면 그 조각만 잃는다).
 * 서버가 거절한 조각(4xx)은 빼고 알린 뒤 녹음을 멈춘다 — 이미 보낸 조각으로 초안을 만들 수 있다.
 */
export function useConversationRecorder({
  visitId,
  pending,
  onProgress,
  onFinished,
  onStale,
  onDiscarded,
  onError,
}: {
  visitId: string;
  /** 서버에 있는 끝내지 않은 녹음(다른 화면·지난번에 보낸 조각) */
  pending: ConversationProgress | null;
  /** 조각을 보낼 때마다 서버가 센 진행 */
  onProgress: (progress: ConversationProgress) => void;
  /** dropped: 초안에서 빠진 조각이 있었으면 그 알림 */
  onFinished: (dictation: VisitDictation, dropped: string | null) => void;
  /** 서버에 이을 조각이 없었다(이미 초안을 만들었거나 지웠다) — 구술·진행을 다시 받는다 */
  onStale: () => void;
  onDiscarded: () => void;
  /** 마이크를 켜지 못했을 때 등 알림으로 띄울 문구 */
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [meter] = useState(createMeter);
  /** 보내기·초안 만들기 실패 문구(다시 시도할 수 있다) */
  const [failure, setFailure] = useState<string | null>(null);
  /** 멈춘 까닭(마이크 끊김·서버 거절) 또는 뺀 조각 알림 */
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef<ConversationSession | null>(null);
  /** 화면을 떠났다(마이크를 켜는 사이 떠나면 켜진 마이크를 바로 놓는다) */
  const unmountedRef = useRef(false);
  const callbacks = useLatestRef({
    onProgress,
    onFinished,
    onStale,
    onDiscarded,
    onError,
  });

  /** 지금 구간을 끝낸다(마지막 조각이 줄에 들어갈 때까지 기다린다). */
  const stopRun = async (session: ConversationSession) => {
    const run = session.live;
    if (!run) return;
    session.live = null;
    session.baseSeconds += runSeconds(run);
    if (run.recorder.state !== "inactive") run.recorder.stop();
    releaseRun(run);
    await run.stopped;
  };

  /**
   * 처음(idle)으로 돌아간다. idle이면 마이크가 꺼져 있어야 하므로, 켜진 구간이 남아 있으면 그 조각은 버리고
   * 끈다(정상 흐름에서는 끝내기·버리기가 먼저 끈다 — 상태가 어긋나도 보이지 않는 녹음이 남지 않게).
   */
  const reset = () => {
    const session = sessionRef.current;
    if (session?.live) {
      session.discarded = true;
      void stopRun(session);
    }
    sessionRef.current = null;
    setStatus("idle");
    meter.set({ seconds: 0, level: 0 });
    setFailure(null);
    setNotice(null);
  };

  const pause = async (reason: string | null = null) => {
    const session = sessionRef.current;
    if (!session?.live) return;
    await stopRun(session);
    meter.set({ seconds: Math.floor(session.baseSeconds), level: 0 });
    setNotice(reason);
    if (sessionRef.current === session && !session.finishRequested) {
      setStatus("paused");
    }
  };

  const finishOnServer = async (session: ConversationSession) => {
    try {
      const dictation = await api.dictation.finishConversation(visitId);
      if (sessionRef.current === session) reset();
      callbacks.current.onFinished(dictation, session.dropped);
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 404 || status === 422) {
        // 404: 이을 조각이 없다(녹음한 것이 없었거나, 앞 요청이 응답 전에 끊겼지만 서버는 이미 초안을 만들었다).
        // 422: 말소리가 없어 서버가 조각을 지웠다. 둘 다 끝났으므로 처음으로 돌아가고 구술·진행을 다시 받는다.
        if (sessionRef.current === session) reset();
        callbacks.current.onStale();
        if (status === 422) {
          callbacks.current.onError(
            getErrorMessage(error, "기록 초안을 만들지 못했습니다"),
          );
        }
        return;
      }
      if (sessionRef.current !== session) return;
      setFailure(getErrorMessage(error, "기록 초안을 만들지 못했습니다"));
    }
  };

  /** 보낼 조각을 하나 꺼내 WAV로 바꾼다. 읽지 못한 조각은 빼고(큰 조각이면 알린다) 다음 것을 본다. */
  const nextToSend = async (session: ConversationSession) => {
    while (!session.sending && session.queue.length > 0) {
      const { recording, ...segment } = session.queue.shift()!;
      try {
        session.sending = { ...segment, wav: await toWav16kMono(recording) };
      } catch {
        if (recording.size > TINY_SEGMENT_BYTES) {
          const dropped = addDropped(
            session,
            "녹음 조각 하나를 읽지 못해 초안에서 뺐습니다",
          );
          if (sessionRef.current === session) setNotice(dropped);
        }
      }
    }
    return session.sending;
  };

  /**
   * 조각 하나를 보낸다. 연결 오류면 간격을 두고 다시 보내고, 다 써도 실패하면 그 조각을 남겨 두고 멈춘다
   * ("stopped" — retry·다음 조각이 다시 부른다). 서버가 거절하면(4xx) 빼고 알린 뒤 녹음을 멈춘다("dropped").
   */
  const sendSegment = async (
    session: ConversationSession,
    { wav, ...segment }: NonNullable<ConversationSession["sending"]>,
  ): Promise<"sent" | "dropped" | "stopped"> => {
    let attempt = 0;
    while (!session.discarded) {
      try {
        const progress = await api.dictation.conversationSegment(
          visitId,
          wav,
          segment,
        );
        session.sending = null;
        if (session.discarded) return "stopped";
        if (sessionRef.current === session) setFailure(null);
        callbacks.current.onProgress(progress);
        return "sent";
      } catch (error) {
        if (session.discarded) return "stopped";
        if (!isRetryable(error)) {
          // 서버가 거절했다(동의가 지워짐·확정됨·너무 김 등). 다시 보내도 같으므로 빼고, 녹음도 멈춘다.
          session.sending = null;
          const message = getErrorMessage(
            error,
            "대화 녹음 조각을 보내지 못했습니다",
          );
          const dropped = addDropped(
            session,
            `${message} — 그 부분은 초안에서 빠집니다`,
          );
          if (sessionRef.current === session) setNotice(dropped);
          void pause(session.dropped);
          return "dropped";
        }
        const delay = RETRY_DELAYS_MS[attempt];
        attempt += 1;
        if (delay === undefined) {
          if (sessionRef.current === session) {
            setFailure(getErrorMessage(error, "대화 녹음을 보내지 못했습니다"));
          }
          return "stopped";
        }
        await sleep(delay);
      }
    }
    return "stopped";
  };

  /** 조각을 차례로 보내고, 끝내기를 눌렀으면 다 보낸 뒤 초안을 만든다. */
  const pumpLoop = async (session: ConversationSession) => {
    let sending = await nextToSend(session);
    while (sending && !session.discarded) {
      if ((await sendSegment(session, sending)) === "stopped") return;
      sending = await nextToSend(session);
    }
    if (session.finishRequested && !session.discarded) {
      await finishOnServer(session);
    }
  };

  // React Compiler가 건너뛰지 않게 ??= 를 쓰지 않는다(CLAUDE.md).
  const pump = (session: ConversationSession) => {
    if (!session.pumping) {
      session.pumping = pumpLoop(session).finally(() => {
        session.pumping = null;
      });
    }
    return session.pumping;
  };

  /** 녹음기 하나(조각 하나). 멈추면 조각을 줄에 넣고 보낸다. */
  const startSegmentRecorder = (
    session: ConversationSession,
    run: Pick<LiveRun, "runId" | "runStartedAt" | "microphone">,
    index: number,
  ) => {
    const recorder = createRecorder(run.microphone.stream);
    const stopped = new Promise<void>((resolve) => {
      // 조각은 멈출 때 한 번에 받는다(조각마다 하나의 파일).
      recorder.ondataavailable = (event) => {
        if (session.discarded || event.data.size === 0) return;
        session.queue.push({
          runId: run.runId,
          runStartedAt: run.runStartedAt,
          index,
          recording: event.data,
        });
        void pump(session);
      };
      recorder.onstop = () => resolve();
    });
    recorder.start();
    return { recorder, stopped };
  };

  const finish = async () => {
    const session = sessionRef.current;
    if (!session) return;
    session.finishRequested = true;
    await stopRun(session);
    meter.set({ level: 0 });
    setNotice(null);
    setFailure(null);
    setStatus("finishing");
    void pump(session);
  };

  const openRun = async (session: ConversationSession) => {
    let microphone: Microphone;
    try {
      microphone = await openMicrophone();
    } catch (error) {
      if (!(error instanceof MicrophoneError)) throw error;
      callbacks.current.onError(error.message);
      return false;
    }
    // 마이크를 켜는 사이 화면을 떠났거나 버렸으면 바로 놓는다(보이지 않는 녹음을 하지 않는다).
    if (
      unmountedRef.current ||
      sessionRef.current !== session ||
      session.discarded
    ) {
      microphone.release();
      return false;
    }

    const now = Date.now();
    const identity = {
      runId: crypto.randomUUID(),
      runStartedAt: new Date(now).toISOString(),
      microphone,
    };
    const first = startSegmentRecorder(session, identity, 0);
    const run: LiveRun = {
      ...identity,
      recorder: first.recorder,
      stopped: first.stopped,
      nextIndex: 1,
      segmentStartedAt: now,
      startedAt: now,
      timer: 0,
      releaseScreen: holdScreenOn(),
    };
    run.timer = window.setInterval(() => {
      const total = session.baseSeconds + runSeconds(run);
      meter.set({ seconds: Math.floor(total), level: microphone.readLevel() });
      if (total >= CONVERSATION_MAX_SECONDS) {
        void finish();
        return;
      }
      if (
        (Date.now() - run.segmentStartedAt) / 1000 >=
        CONVERSATION_SEGMENT_SECONDS
      ) {
        // 새 녹음기를 먼저 켜고 앞 녹음기를 끈다(조각 사이가 비지 않게).
        const previous = run.recorder;
        const next = startSegmentRecorder(session, run, run.nextIndex);
        run.nextIndex += 1;
        run.recorder = next.recorder;
        run.stopped = next.stopped;
        run.segmentStartedAt = Date.now();
        previous.stop();
      }
    }, 250);
    // 통화가 오거나 다른 앱이 마이크를 가져가면 끊긴다. 보낸 조각은 남으므로 멈춤으로 둔다.
    microphone.stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      if (session.live === run) {
        void pause(
          "마이크가 끊겨 녹음을 멈췄습니다. [이어서 녹음]을 누르면 이어 붙입니다",
        );
      }
    });
    session.live = run;
    return true;
  };

  /** 녹음을 시작한다. 서버에 끝내지 않은 녹음이 있으면 그 뒤에 이어 붙인다(초안을 만들 때 함께 잇는다). */
  const start = async () => {
    if (status !== "idle" && status !== "paused") return;
    const session = sessionRef.current ?? newSession(pending?.seconds ?? 0);
    if (session.opening || session.live) return;
    sessionRef.current = session;
    session.opening = true;
    // 다시 녹음하면 걸려 있던 끝내기(실패해 멈춘 것)는 거둔다 — 끝낼 때 다시 누른다.
    session.finishRequested = false;
    setStatus("starting");
    setNotice(null);
    setFailure(null);
    meter.set({ seconds: Math.floor(session.baseSeconds) });
    const opened = await openRun(session);
    session.opening = false;
    if (sessionRef.current !== session) return;
    if (opened) setStatus("recording");
    // 마이크를 켜지 못했다. 이 화면에서 녹음한 것이 없으면 처음으로, 있으면 멈춤으로 둔다.
    else if (session.baseSeconds === (pending?.seconds ?? 0)) reset();
    else setStatus("paused");
  };

  /** 서버에 있는 끝내지 않은 녹음으로 바로 초안을 만든다(녹음하지 않고). */
  const finishPending = () => {
    if (status !== "idle" || !pending) return;
    sessionRef.current = newSession(pending.seconds);
    meter.set({ seconds: Math.floor(pending.seconds) });
    void finish();
  };

  /** 보내기·초안 만들기를 다시 시도한다. */
  const retry = () => {
    const session = sessionRef.current;
    if (!session) return;
    setFailure(null);
    void pump(session);
  };

  /**
   * 녹음을 버린다: 마이크를 끄고, 보내는 중인 조각이 끝나기를 기다린 뒤(늦게 도착한 조각이 다시 생기지 않게)
   * 보내지 않은 조각과 서버에 보낸 조각을 지운다.
   */
  const discard = async () => {
    const session = sessionRef.current;
    const wasLive = session?.live != null;
    if (session) {
      session.discarded = true;
      await stopRun(session);
      await session.pumping;
    }
    try {
      await api.dictation.discardConversation(visitId);
    } catch (error) {
      const message = getErrorMessage(error, "대화 녹음을 지우지 못했습니다");
      if (!session) {
        callbacks.current.onError(message);
        return;
      }
      // 지우지 못했다: 버리기 전 상태로 되돌린다(끝내던 중이면 끝내기, 아니면 멈춤). [다시 시도]는 남은 조각
      // 보내기, [버리기]는 다시 지우기. 녹음 중이던 조각은 이미 버렸으므로 알린다.
      session.discarded = false;
      if (sessionRef.current === session) {
        setStatus(session.finishRequested ? "finishing" : "paused");
        if (wasLive) {
          setNotice(
            addDropped(session, "녹음 중이던 마지막 부분은 지워졌습니다"),
          );
        }
        setFailure(message);
      }
      return;
    }
    if (sessionRef.current === session) reset();
    callbacks.current.onDiscarded();
  };

  // 녹음·보내기 중에 창을 닫거나 새로 고치려 하면 묻는다(보낸 조각은 남지만 녹음 중인 조각은 잃는다).
  const active = status !== "idle";
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  // 화면을 떠나면 마이크를 끈다. 녹음 중이던 조각은 보내 본다(보낸 조각과 함께 서버에 남는다).
  useEffect(() => {
    // StrictMode는 마운트 → 정리 → 마운트를 한 번 더 돌린다(정리에서 세운 표시를 되돌린다).
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const session = sessionRef.current;
      if (session?.live) void stopRun(session);
    };
  }, []);

  return {
    status,
    /** 녹음 길이·입력 크기(useConversationSeconds·useConversationLevel로 읽는다) */
    meter,
    failure,
    notice,
    start,
    pause: () => void pause(),
    finish: () => void finish(),
    finishPending,
    retry,
    discard,
  };
}

export type ConversationRecorder = ReturnType<typeof useConversationRecorder>;
