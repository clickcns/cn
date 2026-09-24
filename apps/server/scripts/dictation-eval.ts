/*
 * 구술 녹음 → 서식 초안 평가 도구. 화면 없이 파이프라인만 돌려 결과를 확인한다.
 *
 *   pnpm --filter @repo/server dictation:eval <녹음 파일...> [--forms HOME_CARE_NURSE] [--name 김영자] [--notes "천골 욕창"] [--json]
 *
 * --forms: 채울 서식(쉼표로 여러 개). 기본 LTC_NURSING. 재택의료 의사는 PRIMARY_CARE_CHECK,HOME_CARE_DOCTOR
 * 16kHz 모노 WAV가 아니면 ffmpeg로 바꾼다(ffmpeg 필요). 설정은 apps/server/.env를 읽는다.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import "dotenv/config";
import {
  fieldEvidence,
  FORM_IDS,
  FORMS,
  formatFieldValue,
  formFields,
  type FormId,
} from "@repo/shared-types";
import { SpeechEnvSchema } from "../src/config/config.service.js";
import {
  DictationPipeline,
  type DictationContext,
} from "../src/dictation/dictation.pipeline.js";
import { LlmClient } from "../src/llm/llm.client.js";
import { SttClient } from "../src/speech/stt.client.js";
import {
  readPcmWav,
  STT_SAMPLE_RATE,
  WavFormatError,
} from "../src/speech/wav.js";

function loadPcm(file: string): Buffer {
  try {
    return readPcmWav(readFileSync(file)).pcm;
  } catch (error) {
    if (!(error instanceof WavFormatError)) throw error;
  }
  const result = spawnSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-i",
      file,
      "-ac",
      "1",
      "-ar",
      String(STT_SAMPLE_RATE),
      "-f",
      "s16le",
      "-",
    ],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg 변환 실패: ${result.stderr?.toString() || result.error?.message}`,
    );
  }
  return result.stdout;
}

function parseFormIds(text: string): FormId[] {
  const ids = text.split(",").map((id) => id.trim());
  const unknown = ids.filter((id) => !FORM_IDS.includes(id as FormId));
  if (unknown.length > 0) {
    throw new Error(
      `모르는 서식: ${unknown.join(", ")} (가능: ${FORM_IDS.join(", ")})`,
    );
  }
  return ids as FormId[];
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      forms: { type: "string", default: "LTC_NURSING" },
      name: { type: "string", default: "수급자" },
      notes: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  if (positionals.length === 0) {
    console.error(
      "사용법: dictation:eval <녹음 파일...> [--forms 서식ID,...] [--name 이름] [--notes 메모] [--json]",
    );
    process.exit(1);
  }

  const env = SpeechEnvSchema.parse(process.env);
  if (!env.LLM_API_KEY) {
    throw new Error("LLM_API_KEY가 없습니다(apps/server/.env)");
  }
  const stt = new SttClient(env.STT_GRPC_URL);
  const llm = new LlmClient({
    baseUrl: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    reasoningEffort: env.LLM_REASONING_EFFORT,
  });
  const pipeline = new DictationPipeline(stt, llm);
  const context: DictationContext = {
    recipient: {
      name: values.name,
      careGrade: null,
      notes: values.notes ?? null,
    },
    formIds: parseFormIds(values.forms),
  };

  try {
    for (const file of positionals) {
      const pcm = loadPcm(file);
      const audioSeconds = pcm.length / (STT_SAMPLE_RATE * 2);

      const sttStarted = Date.now();
      const sentences = await pipeline.transcribe(pcm, context, {
        take: 1,
        firstNumber: 1,
      });
      const sttSeconds = (Date.now() - sttStarted) / 1000;

      const llmStarted = Date.now();
      const result = await pipeline.draft(sentences, context);
      const llmSeconds = (Date.now() - llmStarted) / 1000;

      const summary = {
        file: basename(file),
        audioSeconds: Number(audioSeconds.toFixed(1)),
        sttSeconds,
        llmSeconds,
        model: llm.model,
        usage: result.usage,
      };
      if (values.json) {
        console.log(
          JSON.stringify({ ...summary, sentences, ...result }, null, 2),
        );
        continue;
      }

      console.log(
        `\n=== ${summary.file} — 녹음 ${summary.audioSeconds}초 · 음성인식 ${sttSeconds}초 · 초안 ${llmSeconds}초 (${llm.model})`,
      );
      if (result.usage) {
        console.log(
          `토큰: 입력 ${result.usage.promptTokens} · 출력 ${result.usage.completionTokens}`,
        );
      }
      console.log("\n[문장]");
      for (const sentence of sentences) {
        console.log(`  ${sentence.id} ${sentence.text}`);
      }
      for (const formId of context.formIds) {
        const form = FORMS[formId];
        const draft = result.draft[formId];
        console.log(`\n[초안] ${form.code} ${form.title}`);
        for (const field of formFields(form)) {
          const text = formatFieldValue(field, draft?.values[field.key]);
          if (!text) continue;
          const { ids } = draft ? fieldEvidence(draft, field.key) : { ids: [] };
          console.log(`  ${field.label}: ${text}  [${ids.join(",")}]`);
        }
      }
      console.log("\n[자동 검사]");
      if (result.issues.length === 0) console.log("  문제 없음");
      // 두 서식에 같은 문제가 나오면 한 번만 적는다.
      const printed = new Set<string>();
      for (const issue of result.issues) {
        const line = `  (${issue.severity}) ${issue.message}`;
        if (!printed.has(line)) console.log(line);
        printed.add(line);
      }
      console.log("\n[되묻기]");
      if (result.questions.length === 0) console.log("  없음");
      for (const question of result.questions) {
        console.log(`  - ${question.question}`);
      }
    }
  } finally {
    stt.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
