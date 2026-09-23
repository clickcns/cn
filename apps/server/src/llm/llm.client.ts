import { z } from "zod";

export interface LlmClientOptions {
  /** OpenAI 호환 API 주소. 예: https://generativelanguage.googleapis.com/v1beta/openai */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 생각(추론) 정도. Gemini는 thinking level로 바꿔 받는다. */
  reasoningEffort?: "low" | "medium" | "high";
  timeoutMs?: number;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LlmJsonResult<T> {
  data: T;
  usage: LlmUsage | null;
}

export class LlmError extends Error {}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * OpenAI 호환 chat completions 클라이언트. JSON 스키마로 응답 형태를 강제하고 zod로 다시 검사한다.
 * Gemini·vLLM·Ollama 등 OpenAI 호환 API면 주소·모델만 바꿔 쓸 수 있다.
 */
export class LlmClient {
  constructor(private readonly options: LlmClientOptions) {}

  get model(): string {
    return this.options.model;
  }

  async generateJson<T extends z.ZodType>(
    schema: T,
    request: { name: string; system: string; user: string },
  ): Promise<LlmJsonResult<z.output<T>>> {
    const { baseUrl, apiKey, model, reasoningEffort, timeoutMs } = this.options;
    // 스키마 버전 표시($schema)는 받지 않는 API가 있어 뺀다.
    const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) };
    delete jsonSchema.$schema;

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          reasoning_effort: reasoningEffort,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.name,
              strict: true,
              schema: jsonSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new LlmError(
        `LLM 서버에 연결하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new LlmError(`LLM 요청 실패(${response.status}): ${detail}`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new LlmError("LLM 응답이 비어 있습니다");

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new LlmError("LLM 응답이 JSON이 아닙니다");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new LlmError(
        `LLM 응답 형식이 맞지 않습니다: ${issue?.path.join(".")} ${issue?.message}`,
      );
    }

    const usage = body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
        }
      : null;
    return { data: parsed.data, usage };
  }
}
