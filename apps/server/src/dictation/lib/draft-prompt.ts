import {
  CARE_GRADE_LABELS,
  dictationFields,
  FORMS,
  optionValues,
  type CareGrade,
  type ChoiceFieldDef,
  type DictationSentence,
  type FieldDef,
  type FormId,
} from "@repo/shared-types";
import { z } from "zod";

/*
 * 구술 문장 → 서식 초안 LLM 요청. 응답 스키마와 프롬프트를 서식 정의에서 만든다.
 * LLM은 값마다 근거 문장 ID와 숫자 원문(quote)을 함께 돌려주고, validate-draft.ts가 코드로 다시 대조한다.
 */

const evidence = z
  .array(z.string())
  .describe('근거 문장 ID 목록. 예: ["S2"]. 근거가 없으면 값을 비운다');

const numberAnswer = z.object({
  value: z.number().nullable(),
  quote: z
    .string()
    .nullable()
    .describe(
      '근거 문장에 적힌 숫자 표기 그대로(단위·조사 제외). 예: "130", "백삼십"',
    ),
  evidence,
});
export type NumberAnswer = z.output<typeof numberAnswer>;

const hasDetailText = (field: ChoiceFieldDef) =>
  field.options.some(
    (option) =>
      option.detail?.kind === "text" || option.detail?.kind === "choice",
  );
const hasMinutes = (field: ChoiceFieldDef) =>
  field.options.some((option) => option.detail?.kind === "minutes");

function answerSchema(field: FieldDef): z.ZodType {
  switch (field.type) {
    case "number":
      return numberAnswer;
    case "text":
      return z.object({ text: z.string(), evidence });
    case "single":
      return z.object({
        value: z.enum(optionValues(field)).nullable(),
        ...(hasDetailText(field) ? { detail: z.string().nullable() } : {}),
        evidence,
      });
    case "multi":
      return z.object({
        items: z.array(
          z.object({
            value: z.enum(optionValues(field)),
            ...(hasDetailText(field) ? { detail: z.string().nullable() } : {}),
            ...(hasMinutes(field)
              ? { minutes: numberAnswer, note: z.string().nullable() }
              : {}),
            evidence,
          }),
        ),
      });
  }
}

/** LLM 응답 스키마: { 서식ID: { 칸키: 답 } }. 구술로 채우는 칸만 싣는다. */
export function buildDraftSchema(formIds: readonly FormId[]) {
  return z.object(
    Object.fromEntries(
      formIds.map((formId) => [
        formId,
        z.object(
          Object.fromEntries(
            dictationFields(FORMS[formId]).map((field) => [
              field.key,
              answerSchema(field),
            ]),
          ),
        ),
      ]),
    ),
  );
}

/** 검사 전 LLM 응답. 모양은 buildDraftSchema가 강제한다. */
export type LlmDraft = Record<string, Record<string, unknown>>;

function describeField(field: FieldDef): string[] {
  const hint = field.hint ? ` — ${field.hint}` : "";
  switch (field.type) {
    case "number": {
      const sign = field.signed ? ", 증가는 양수·감소는 음수" : "";
      return [
        `- ${field.key} [숫자, ${field.unit}, ${field.min}~${field.max}${sign}]: ${field.label}${hint}`,
      ];
    }
    case "text": {
      const length = field.softLimit
        ? `${field.softLimit.length}자 이내(${field.softLimit.target})`
        : `${field.maxLength}자 이내`;
      return [`- ${field.key} [글, ${length}]: ${field.label}${hint}`];
    }
    case "single":
    case "multi": {
      const kind = field.type === "single" ? "하나 선택" : "해당 항목 모두";
      const options = field.options.map((option) => {
        const parts = [`${option.value}=${option.label}`];
        if (option.detail?.kind === "text") {
          parts.push(`(detail에 ${option.detail.label})`);
        } else if (option.detail?.kind === "choice") {
          const choices = option.detail.options
            .map((choice) => `${choice.value}=${choice.label}`)
            .join("/");
          parts.push(`(detail에 ${option.detail.label}: ${choices})`);
        } else if (option.detail?.kind === "minutes") {
          parts.push("(minutes=제공 시간(분), note=한 일)");
        }
        if (option.hint) parts.push(`: ${option.hint}`);
        return parts.join(" ");
      });
      return [
        `- ${field.key} [${kind}]: ${field.label}${hint}`,
        `  선택지: ${options.join("; ")}`,
      ];
    }
  }
}

function describeForm(formId: FormId): string {
  const form = FORMS[formId];
  return [
    `### ${formId} — ${form.title} (${form.code})`,
    ...dictationFields(form).flatMap(describeField),
  ].join("\n");
}

const RULES = `너는 방문 의료·간호·복지 기록 도우미다.
담당자(의사·간호사·사회복지사)가 방문이나 상담 직후 구술한 내용을 음성인식한 문장 목록(S1, S2…)을 받아,
아래 서식의 칸을 채운 초안을 JSON으로 만든다.

## 절대 규칙
1. 구술에 없는 내용은 만들지 않는다. 말하지 않은 칸은 비운다(value null, items 빈 배열, text 빈 문자열). 정상값·평소값·추측으로 채우지 않는다.
2. 모든 값에 근거 문장 ID(evidence)를 붙인다. 근거가 없으면 값을 넣지 않는다.
3. 숫자는 value에 숫자로, quote에 근거 문장에 적힌 표기 그대로 적는다. 단위와 조사는 quote에서 뺀다.
   예: "혈압 130에 85" → systolic {value:130, quote:"130"}, diastolic {value:85, quote:"85"}
4. 숫자를 고치거나 계산하지 않는다(한글로 읽은 숫자를 숫자로 바꾸는 것만 한다). 잘못 들은 것 같은 숫자는 비운다.
5. 선택 칸은 주어진 선택지 코드만 쓴다. 맞는 선택지가 없고 OTHER(기타)가 있으면 OTHER를 고르고 detail에 내용을 적는다.
6. detail은 선택지 괄호 안 내용(욕창 부위, 검사명, 가족 관계 등)만 짧게 적는다.
7. 유/무를 묻는 칸은 있었다고 말했으면 YES, 없었다고 말했으면 NO, 말하지 않았으면 비운다.
8. 서식이 여러 개면 같은 내용을 각 서식의 해당 칸에 모두 채운다(예: 동행자, 향후 계획).
9. 글 칸은 간결한 기록체("~함", "~임", 명사형)로 쓰고, 보호자 말은 "(보호자 진술)"로 표시한다.
10. 수급자 메모는 용어를 알아듣는 데만 쓴다. 메모 내용을 기록으로 옮기지 않는다.

## 음성인식 오류
문맥상 확실한 의료·복지 용어 오인식은 바로잡아 쓴다(예: "육창" → "욕창", "천골족" → "천골 쪽"). 숫자는 바로잡지 않는다.`;

export function buildDraftSystemPrompt(formIds: readonly FormId[]): string {
  return [RULES, "## 서식", ...formIds.map(describeForm)].join("\n\n");
}

export interface DraftRecipientContext {
  name: string;
  careGrade: CareGrade | null;
  notes: string | null;
}

export function buildDraftUserMessage(
  sentences: readonly DictationSentence[],
  recipient: DraftRecipientContext,
): string {
  const lines = [
    `수급자: ${recipient.name}${recipient.careGrade ? ` (${CARE_GRADE_LABELS[recipient.careGrade]})` : ""}`,
  ];
  if (recipient.notes) lines.push(`수급자 메모: ${recipient.notes}`);
  lines.push("", "구술 문장:");
  for (const sentence of sentences) {
    lines.push(`${sentence.id} ${sentence.text}`);
  }
  return lines.join("\n");
}

/** 음성인식 힌트(Whisper initial_prompt). 용어는 서식 정의(sttTerms)에서 온다. */
export function buildSttPrompt(
  recipient: DraftRecipientContext,
  formIds: readonly FormId[],
): string {
  const terms = [...new Set(formIds.flatMap((id) => FORMS[id].sttTerms))];
  const parts = [
    "방문 직후 기록을 구술합니다.",
    `${terms.join(", ")} 같은 용어가 나옵니다.`,
    `수급자 ${recipient.name}.`,
  ];
  if (recipient.notes) parts.push(recipient.notes.slice(0, 100));
  return parts.join(" ");
}
