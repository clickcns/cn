import { useEffect, useRef, useState } from "react";
import {
  createRecorder,
  holdScreenOn,
  MicrophoneError,
  openMicrophone,
  type Microphone,
} from "@/features/dictation/lib/microphone";
import { useLatestRef } from "@/hooks/use-latest-ref";

export type RecorderStatus = "idle" | "starting" | "recording";

interface RecordingSession {
  recorder: MediaRecorder;
  microphone: Microphone;
  chunks: Blob[];
  startedAt: number;
  timer: number;
  /** 화면 켜짐 유지를 놓는다 */
  releaseScreen: () => void;
  /** 취소면 녹음을 버린다. */
  cancelled: boolean;
}

function release(session: RecordingSession) {
  window.clearInterval(session.timer);
  session.microphone.release();
  session.releaseScreen();
}

/**
 * 마이크 녹음. 녹음 중에는 경과 시간과 입력 크기(0~1)를 알려 주고,
 * maxSeconds가 되면 저절로 끝낸다. 녹음하는 동안 화면이 꺼지지 않게 한다(지원하는 브라우저만).
 * 시작하지 못하면 onError 로 문구를 알린다.
 */
export function useRecorder({
  maxSeconds,
  onRecorded,
  onError,
}: {
  maxSeconds: number;
  onRecorded: (recording: Blob) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const sessionRef = useRef<RecordingSession | null>(null);
  /** 화면을 떠났다(마이크를 켜는 사이 떠나면 켜진 마이크를 바로 놓는다) */
  const unmountedRef = useRef(false);
  const onRecordedRef = useLatestRef(onRecorded);
  const onErrorRef = useLatestRef(onError);

  // 화면을 떠나면 녹음을 버리고 마이크를 놓는다.
  useEffect(() => {
    // StrictMode는 마운트 → 정리 → 마운트를 한 번 더 돌린다(정리에서 세운 표시를 되돌린다).
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const session = sessionRef.current;
      if (!session) return;
      session.cancelled = true;
      if (session.recorder.state !== "inactive") session.recorder.stop();
      release(session);
    };
  }, []);

  const start = async () => {
    if (status !== "idle") return;
    setStatus("starting");
    let microphone: Microphone;
    try {
      microphone = await openMicrophone();
    } catch (error) {
      if (!(error instanceof MicrophoneError)) throw error;
      onErrorRef.current(error.message);
      setStatus("idle");
      return;
    }
    if (unmountedRef.current) {
      microphone.release();
      return;
    }

    const recorder = createRecorder(microphone.stream);
    const session: RecordingSession = {
      recorder,
      microphone,
      chunks: [],
      startedAt: Date.now(),
      timer: 0,
      releaseScreen: holdScreenOn(),
      cancelled: false,
    };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) session.chunks.push(event.data);
    };
    recorder.onstop = () => {
      release(session);
      if (sessionRef.current === session) sessionRef.current = null;
      setStatus("idle");
      setLevel(0);
      if (!session.cancelled) {
        onRecordedRef.current(
          new Blob(session.chunks, { type: recorder.mimeType }),
        );
      }
    };
    session.timer = window.setInterval(() => {
      const elapsed = (Date.now() - session.startedAt) / 1000;
      setSeconds(Math.floor(elapsed));
      setLevel(microphone.readLevel());
      if (elapsed >= maxSeconds && recorder.state === "recording") {
        recorder.stop();
      }
    }, 100);

    sessionRef.current = session;
    setSeconds(0);
    recorder.start(1000);
    setStatus("recording");
  };

  const stop = () => {
    const session = sessionRef.current;
    if (session && session.recorder.state !== "inactive") {
      session.recorder.stop();
    }
  };

  const cancel = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.cancelled = true;
    stop();
  };

  return { status, seconds, level, start, stop, cancel };
}
