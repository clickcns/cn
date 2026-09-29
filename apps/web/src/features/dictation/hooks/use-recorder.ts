import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/hooks/use-latest-ref";

export type RecorderStatus = "idle" | "starting" | "recording";

interface RecordingSession {
  recorder: MediaRecorder;
  stream: MediaStream;
  audioContext: AudioContext;
  chunks: Blob[];
  startedAt: number;
  timer: number;
  wakeLock: WakeLockSentinel | null;
  /** 취소면 녹음을 버린다. */
  cancelled: boolean;
}

/** 브라우저가 지원하는 녹음 형식. Chrome·Android는 webm, iOS Safari는 mp4. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") {
    return "마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요";
  }
  if (name === "NotFoundError") return "마이크를 찾을 수 없습니다";
  if (name === "NotReadableError") {
    return "다른 앱이 마이크를 쓰고 있습니다. 통화나 녹음 앱을 닫고 다시 시도해 주세요";
  }
  return "녹음을 시작하지 못했습니다";
}

function release(session: RecordingSession) {
  window.clearInterval(session.timer);
  for (const track of session.stream.getTracks()) track.stop();
  if (session.audioContext.state !== "closed") {
    void session.audioContext.close().catch(() => undefined);
  }
  void session.wakeLock?.release().catch(() => undefined);
}

/**
 * 마이크 녹음. 녹음 중에는 경과 시간과 입력 크기(0~1)를 알려 주고,
 * maxSeconds가 되면 저절로 끝낸다. 녹음하는 동안 화면이 꺼지지 않게 한다(지원하는 브라우저만).
 * 시작하지 못하면 error 에 문구를 두고 onError 로도 알린다.
 */
export function useRecorder({
  maxSeconds,
  onRecorded,
  onError,
}: {
  maxSeconds: number;
  onRecorded: (recording: Blob) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  const onRecordedRef = useLatestRef(onRecorded);
  const onErrorRef = useLatestRef(onError);

  const fail = (message: string) => {
    setError(message);
    onErrorRef.current?.(message);
  };

  // 화면을 떠나면 녹음을 버리고 마이크를 놓는다.
  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (!session) return;
      session.cancelled = true;
      if (session.recorder.state !== "inactive") session.recorder.stop();
      release(session);
    },
    [],
  );

  const start = async () => {
    if (status !== "idle") return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      fail(
        "이 주소에서는 녹음할 수 없습니다. HTTPS 주소나 최신 브라우저로 접속해 주세요",
      );
      return;
    }

    setStatus("starting");
    // iOS는 사용자 동작 안에서 만든 AudioContext만 소리를 받는다.
    const audioContext = new AudioContext();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (cause) {
      void audioContext.close().catch(() => undefined);
      fail(microphoneErrorMessage(cause));
      setStatus("idle");
      return;
    }

    const mimeType = MIME_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    void audioContext.resume().catch(() => undefined);
    const samples = new Float32Array(analyser.fftSize);

    const session: RecordingSession = {
      recorder,
      stream,
      audioContext,
      chunks: [],
      startedAt: Date.now(),
      timer: 0,
      wakeLock: null,
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
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
      if (elapsed >= maxSeconds && recorder.state === "recording") {
        recorder.stop();
      }
    }, 100);

    sessionRef.current = session;
    setSeconds(0);
    recorder.start(1000);
    setStatus("recording");

    const wakeLock =
      (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
    // 화면 켜짐 요청이 끝나기 전에 녹음이 끝났으면 바로 놓는다.
    if (sessionRef.current === session) session.wakeLock = wakeLock;
    else void wakeLock?.release().catch(() => undefined);
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

  return { status, seconds, level, error, start, stop, cancel };
}
