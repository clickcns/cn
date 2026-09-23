import { join } from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

/** STT 서버가 돌려준 인식 구간 하나(Whisper segment). 시각은 녹음 시작 기준 초. */
export interface SttSegment {
  text: string;
  start: number;
  end: number;
  avgLogprob: number;
  noSpeechProb: number;
}

/** STT 서버 연결 실패·시간 초과 등. message는 사용자에게 보여 줄 수 있는 한국어다. */
export class SttError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

function toSttError(error: grpc.ServiceError): SttError {
  const message =
    error.code === grpc.status.DEADLINE_EXCEEDED
      ? "음성 인식이 제시간에 끝나지 않았습니다"
      : "음성 인식 서버에 연결하지 못했습니다";
  return new SttError(message, `${grpc.status[error.code]}: ${error.details}`);
}

export interface TranscribeOptions {
  /** Whisper initial_prompt. 도메인 용어·수급자 정보를 알려 주면 인식이 나아진다. */
  prompt?: string;
  timeoutMs?: number;
}

/** stt.proto의 SttRequest (keepCase) */
interface SttRequest {
  pcm_data: Buffer;
  language: string;
  language_detection_segments: number;
  language_detection_threshold: number;
  batch_size: number;
  initial_prompt: string;
  post_threshold?: {
    no_speech_prob: number;
    avg_logprob: number;
    compression_ratio: number;
  };
  condition_on_previous_text: boolean;
  temperature: number;
  best_of: number;
  beam_size: number;
}

/** stt.proto의 SttResponse (keepCase) */
interface SttResponse {
  text: string;
  no_speech_prob: number;
  avg_logprob: number;
  compression_ratio: number;
  start: number;
  end: number;
  language: string;
}

type SpeechToTextClient = grpc.Client & {
  Recognize(
    options?: grpc.CallOptions,
  ): grpc.ClientDuplexStream<SttRequest, SttResponse>;
};

const PROTO_PATH = join(__dirname, "stt.proto");
const CHUNK_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

/*
 * 디코딩 설정은 기존 운영(vmedic·구 케어노트)에서 쓰던 값이다.
 * temperature -1은 Whisper 범위(0~1) 밖이지만 STT 서버가 fallback 표시로 쓰는 값으로 보여 그대로 둔다.
 * avg_logprob -1.0: 작은 목소리·불명확한 발화가 통째로 버려지지 않게 기본보다 느슨하게.
 */
const DECODE_OPTIONS = {
  batch_size: 1,
  best_of: 5,
  temperature: -1,
  beam_size: 10,
  condition_on_previous_text: true,
  language_detection_segments: 1,
  language_detection_threshold: 0.5,
} satisfies Partial<SttRequest>;
const POST_THRESHOLD = {
  avg_logprob: -1.0,
  no_speech_prob: 0.75,
  compression_ratio: 2.4,
};

/**
 * cns의 speech-stt-app(gRPC, Whisper) 클라이언트.
 * 16kHz·모노·16비트 PCM을 조각내 스트리밍하고, 인식 구간을 모아 돌려준다.
 */
export class SttClient {
  private readonly client: SpeechToTextClient;

  constructor(url: string) {
    const definition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      defaults: true,
    });
    const loaded = grpc.loadPackageDefinition(definition) as unknown as {
      stt: { SpeechToText: grpc.ServiceClientConstructor };
    };
    this.client = new loaded.stt.SpeechToText(
      url,
      grpc.credentials.createInsecure(),
    ) as unknown as SpeechToTextClient;
  }

  transcribe(
    pcm: Buffer,
    { prompt = "", timeoutMs = DEFAULT_TIMEOUT_MS }: TranscribeOptions = {},
  ): Promise<SttSegment[]> {
    return new Promise((resolve, reject) => {
      const segments: SttSegment[] = [];
      const call = this.client.Recognize({
        deadline: Date.now() + timeoutMs,
      });
      call.on("data", (response: SttResponse) => {
        segments.push({
          text: response.text,
          start: response.start,
          end: response.end,
          avgLogprob: response.avg_logprob,
          noSpeechProb: response.no_speech_prob,
        });
      });
      call.on("error", (error: grpc.ServiceError) => reject(toSttError(error)));
      call.on("end", () => resolve(segments));

      // 언어·프롬프트·후처리 임계값은 첫 조각에만 싣는다(서버 규약).
      for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
        const first = offset === 0;
        call.write({
          ...DECODE_OPTIONS,
          pcm_data: pcm.subarray(offset, offset + CHUNK_BYTES),
          language: first ? "ko" : "",
          initial_prompt: first ? prompt : "",
          post_threshold: first ? POST_THRESHOLD : undefined,
        });
      }
      call.end();
    });
  }

  close(): void {
    this.client.close();
  }
}
