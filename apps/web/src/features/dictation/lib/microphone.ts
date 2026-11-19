/*
 * 녹음 공용 부품: 마이크 켜기(입력 크기 읽기 포함), 녹음기 만들기, 화면 켜짐 유지.
 * 구술 녹음(useRecorder)과 방문 중 대화 녹음(useConversationRecorder)이 함께 쓴다.
 */

/** 브라우저가 지원하는 녹음 형식. Chrome·Android는 webm, iOS Safari는 mp4. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

/** 마이크를 켜지 못했다. message는 사용자에게 보여 줄 한국어다. */
export class MicrophoneError extends Error {}

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

export interface Microphone {
  stream: MediaStream;
  /** 지금 입력 크기(0~1). 말할 때 움직이면 마이크가 소리를 받고 있다. */
  readLevel: () => number;
  /** 마이크와 오디오 컨텍스트를 놓는다. */
  release: () => void;
}

/**
 * 마이크를 켠다. 사용자 동작(누르기) 안에서 불러야 한다 — iOS는 사용자 동작 안에서 만든 AudioContext만
 * 소리를 받는다. 켜지 못하면 MicrophoneError(문구)를 던진다.
 */
export async function openMicrophone(): Promise<Microphone> {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new MicrophoneError(
      "이 주소에서는 녹음할 수 없습니다. HTTPS 주소나 최신 브라우저로 접속해 주세요",
    );
  }
  const audioContext = new AudioContext();
  const closeContext = () => {
    if (audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  };
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
    closeContext();
    throw new MicrophoneError(microphoneErrorMessage(cause));
  }

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  void audioContext.resume().catch(() => undefined);
  const samples = new Float32Array(analyser.fftSize);

  return {
    stream,
    readLevel: () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      return Math.min(1, Math.sqrt(sum / samples.length) * 5);
    },
    release: () => {
      for (const track of stream.getTracks()) track.stop();
      closeContext();
    },
  };
}

/** 이 브라우저가 지원하는 형식으로 녹음기를 만든다. */
export function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
}

/**
 * 녹음하는 동안 화면이 꺼지지 않게 한다(지원하는 브라우저만). 화면 켜짐 잠금은 다른 앱으로 갔다 오는 등
 * 문서가 숨으면 브라우저가 스스로 놓으므로, 다시 보일 때 새로 요청한다. 돌려준 함수로 놓는다.
 */
export function holdScreenOn(): () => void {
  let lock: WakeLockSentinel | null = null;
  let released = false;
  const request = async () => {
    const next =
      (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
    // 요청이 끝나기 전에 녹음이 끝났으면 바로 놓는다.
    if (released) void next?.release().catch(() => undefined);
    else lock = next;
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void request();
  };
  void request();
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    void lock?.release().catch(() => undefined);
    lock = null;
  };
}
