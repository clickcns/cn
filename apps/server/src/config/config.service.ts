import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { z } from "zod";

const DEV_ACCESS_SECRET = "access-secret-dev";
const DEV_REFRESH_SECRET = "refresh-secret-dev";

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3210),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1).default(DEV_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(1).default(DEV_REFRESH_SECRET),
  /** access token 유효 시간(초). 기본 15분. */
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  /** refresh token 유효 시간(초). 기본 14일. */
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(1_209_600),
  /**
   * 신뢰할 프록시(express trust proxy). 요청 제한이 보는 클라이언트 IP를 정한다.
   * 기본은 loopback(프록시 없음). 인그레스 뒤에 두면 앞단 프록시 수(예: "1")를 넣는다.
   * 사설망 전체를 신뢰하면 사용자가 X-Forwarded-For를 위조해 로그인 제한을 우회할 수 있다.
   */
  TRUST_PROXY: z.string().default("loopback"),
  /**
   * 음성인식 서버(cns speech-stt-app, gRPC). 기본값은 개발용 NodePort다.
   * 클러스터 안에 배포하면 speech-stt-app.default.svc.cluster.local:50051을 쓴다.
   */
  STT_GRPC_URL: z.string().min(1).default("211.254.168.186:30051"),
  /** 기록 초안 LLM — OpenAI 호환 API. 기본은 Gemini. */
  LLM_BASE_URL: z
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta/openai"),
  /** 비어 있으면 음성인식까지만 하고 초안은 만들지 않는다. */
  LLM_API_KEY: z.string().default(""),
  LLM_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  LLM_REASONING_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
});

type Env = z.infer<typeof EnvSchema>;

/** 음성 구술 파이프라인 설정. 평가 스크립트도 같은 스키마로 .env를 읽는다. */
export const SpeechEnvSchema = EnvSchema.pick({
  STT_GRPC_URL: true,
  LLM_BASE_URL: true,
  LLM_API_KEY: true,
  LLM_MODEL: true,
  LLM_REASONING_EFFORT: true,
});
export type SpeechEnv = z.infer<typeof SpeechEnvSchema>;

@Injectable()
export class ConfigService {
  private readonly env: Env;

  constructor(private readonly configService: NestConfigService) {
    this.env = EnvSchema.parse(
      Object.fromEntries(
        Object.keys(EnvSchema.shape).map((key) => [
          key,
          this.configService.get(key),
        ]),
      ),
    );

    if (this.isProduction) {
      const usesDevSecret =
        this.env.JWT_ACCESS_SECRET.startsWith(DEV_ACCESS_SECRET) ||
        this.env.JWT_REFRESH_SECRET.startsWith(DEV_REFRESH_SECRET);
      if (usesDevSecret) {
        throw new Error(
          "운영 환경에서는 JWT_ACCESS_SECRET·JWT_REFRESH_SECRET을 개발용 기본값이 아닌 값으로 설정해야 합니다",
        );
      }
    }
  }

  get port(): number {
    return this.env.PORT;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === "production";
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get jwtAccessTtlSec(): number {
    return this.env.JWT_ACCESS_TTL_SEC;
  }

  get jwtRefreshTtlSec(): number {
    return this.env.JWT_REFRESH_TTL_SEC;
  }

  get speech(): SpeechEnv {
    return SpeechEnvSchema.parse(this.env);
  }

  /** 숫자면 프록시 단계 수, 아니면 express가 아는 이름·IP 목록 그대로. */
  get trustProxy(): string | number {
    const value = this.env.TRUST_PROXY;
    return /^\d+$/.test(value) ? Number(value) : value;
  }
}
