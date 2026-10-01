import type { ReactNode } from "react";
import {
  findOption,
  formatFieldValue,
  isEmptyValue,
  OPTION_DETAIL_MAX_LENGTH,
  reusableFieldValue,
  withParticle,
  type ChoiceFieldDef,
  type FieldDef,
  type FormDef,
  type NumberFieldDef,
  type NumberPair,
  type PastFieldValues,
  type TextFieldDef,
} from "@repo/shared-types";
import { TriangleAlert } from "lucide-react";
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckChips, RadioChips } from "@/components/ui/choice-chips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PastChangedBadge,
  PastDiffLine,
  PastFillBadge,
  PastValueHint,
} from "@/features/forms/components/past-value-hint";
import { fieldElementId, inputId } from "@/features/forms/lib/field-ids";
import { Textarea } from "@/components/ui/textarea";
import {
  sameFieldState,
  sameFieldValue,
  toFieldState,
  toOptionState,
  type FieldState,
  type OptionState,
} from "@/features/forms/lib/form-state";
import type { FormPast, PastFill } from "@/features/forms/lib/past-fill";
import { cn } from "@/lib/utils";

/*
 * 서식 정의로 입력 화면을 그린다. 칸 종류마다 입력 부품이 정해져 있다.
 * - 하나 고르기·여러 개 고르기: 칩. 고른 항목에 괄호 내용(기타·부위·시간 등)이 있으면 아래에 입력 칸
 * - 숫자: 단위가 붙은 입력. 서식이 짝으로 정한 두 칸(혈압 수축기/이완기)은 한 줄
 * - 글: 한 줄 또는 여러 줄. 권장 글자 수(공단 앱 200자)를 넘으면 경고
 */

const emptyOption = (value: string) => toOptionState({ value });

function FieldLabel({
  field,
  htmlFor,
  badge,
}: {
  field: FieldDef;
  htmlFor?: string;
  /** 라벨 옆 표시(지난 기록에서 채움) */
  badge?: ReactNode;
}) {
  // 확정 전에 반드시 채울 칸
  const mark = field.required && (
    <span className="text-destructive ml-1" aria-label="필수">
      *
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-base font-semibold">
            {field.label}
            {mark}
          </Label>
        ) : (
          <span className="text-base font-semibold">
            {field.label}
            {mark}
          </span>
        )}
        {badge}
      </div>
      {field.description && (
        <span className="text-muted-foreground text-sm">
          {field.description}
        </span>
      )}
    </div>
  );
}

/** 고른 항목의 괄호 내용·시간 입력. */
function OptionDetailInputs({
  field,
  state,
  onChange,
  id,
}: {
  field: ChoiceFieldDef;
  state: OptionState;
  onChange: (next: OptionState) => void;
  id: string;
}) {
  const option = findOption(field, state.value);
  const detail = option?.detail;
  if (!option || !detail) return null;

  if (detail.kind === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-muted-foreground">
          {option.label} · {detail.label}
        </Label>
        <Input
          id={id}
          value={state.detail}
          maxLength={OPTION_DETAIL_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) =>
            onChange({ ...state, detail: event.target.value })
          }
        />
      </div>
    );
  }

  if (detail.kind === "choice") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground font-semibold">
          {option.label} · {detail.label}
        </span>
        <RadioChips
          label={`${option.label} ${detail.label}`}
          options={detail.options}
          value={state.detail || null}
          onChange={(value) => onChange({ ...state, detail: value ?? "" })}
        />
      </div>
    );
  }

  return (
    <div className="bg-muted/70 flex flex-col gap-3 rounded-xl p-3">
      <div className="flex items-center gap-3">
        <Label htmlFor={id} className="min-w-0 flex-1 font-semibold">
          {option.label} 제공 시간
        </Label>
        <div className="relative w-32">
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            className="pr-10 text-lg tabular-nums"
            value={state.minutes}
            onChange={(event) =>
              onChange({ ...state, minutes: event.target.value })
            }
          />
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            분
          </span>
        </div>
      </div>
      {detail.note && (
        <Textarea
          aria-label={`${option.label} 메모`}
          rows={2}
          className="min-h-20"
          placeholder="제공한 내용을 적어 주세요"
          value={state.note}
          onChange={(event) => onChange({ ...state, note: event.target.value })}
        />
      )}
    </div>
  );
}

function SingleInput({
  field,
  value,
  onChange,
  id,
}: {
  field: ChoiceFieldDef;
  value: OptionState | null;
  onChange: (value: OptionState | null) => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RadioChips
        label={field.label}
        options={field.options}
        value={value?.value ?? null}
        onChange={(next) => onChange(next ? emptyOption(next) : null)}
      />
      {value && (
        <OptionDetailInputs
          field={field}
          state={value}
          onChange={onChange}
          id={`${id}-detail`}
        />
      )}
    </div>
  );
}

function MultiInput({
  field,
  value,
  onChange,
  id,
}: {
  field: ChoiceFieldDef;
  value: OptionState[];
  onChange: (value: OptionState[]) => void;
  id: string;
}) {
  // 서식 순서대로 보여 준다.
  const ordered = field.options
    .map((option) => value.find((item) => item.value === option.value))
    .filter((item) => item !== undefined);

  return (
    <div className="flex flex-col gap-3">
      <CheckChips
        label={field.label}
        options={field.options}
        values={value.map((item) => item.value)}
        onToggle={(optionValue, selected) =>
          onChange(
            selected
              ? [...value, emptyOption(optionValue)]
              : value.filter((item) => item.value !== optionValue),
          )
        }
      />
      {ordered.map((item) => (
        <OptionDetailInputs
          key={item.value}
          field={field}
          state={item}
          id={`${id}-${item.value}`}
          onChange={(next) =>
            onChange(
              value.map((candidate) =>
                candidate.value === item.value ? next : candidate,
              ),
            )
          }
        />
      ))}
    </div>
  );
}

function NumberInput({
  field,
  value,
  onChange,
  id,
  label,
}: {
  field: NumberFieldDef;
  value: string;
  onChange: (value: string) => void;
  id: string;
  label?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        aria-label={label}
        inputMode={field.decimals > 0 || field.signed ? "decimal" : "numeric"}
        enterKeyHint="next"
        autoComplete="off"
        placeholder={field.signed ? "감소는 -" : undefined}
        className={cn("text-lg tabular-nums", field.unit && "pr-18")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
        {field.unit}
      </span>
    </div>
  );
}

function TextInput({
  field,
  value,
  onChange,
  id,
}: {
  field: TextFieldDef;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const length = value.trim().length;
  const { softLimit } = field;
  const overSoftLimit = softLimit !== undefined && length > softLimit.length;

  return (
    <div className="flex flex-col gap-2">
      {field.multiline ? (
        <Textarea
          id={id}
          rows={4}
          maxLength={field.maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          maxLength={field.maxLength}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {softLimit && (
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-warning flex items-center gap-1.5 font-semibold"
            aria-live="polite"
          >
            {overSoftLimit && (
              <>
                <TriangleAlert className="size-5 shrink-0" />
                {withParticle(softLimit.target, "은/는")} {softLimit.length}
                자까지입니다
              </>
            )}
          </p>
          <span
            className={cn(
              "shrink-0 tabular-nums",
              overSoftLimit
                ? "text-warning font-bold"
                : "text-muted-foreground",
            )}
          >
            {length} / {softLimit.length}자
          </span>
        </div>
      )}
    </div>
  );
}

/** 칸의 지금 값이 지난 기록에서 채운 값 그대로인지(고치면 표시를 뗀다). */
const isPastFill = (value: FieldState, fill: PastFill | undefined) =>
  fill !== undefined &&
  !isEmptyValue(value) &&
  sameFieldState(value, fill.state);

/** 지난 기록에서 채운 칸의 테두리(왼쪽 강조선). */
const PAST_FILL_FRAME = "border-primary/50 border-l-4 pl-3";

/**
 * 칸 하나: 폼 상태와 연결하고 종류에 맞는 입력을 그린다.
 * past 를 주면:
 * - 지난 기록에서 채운 값 그대로면 "지난 기록" 표시
 * - 지난 값(past.values)이 있으면: 칸이 비었을 때 라벨 아래 지난 값(누르면 채움), 지난 값과 다르면 "바뀜"과
 *   지난 값 한 줄·[되돌리기]. 방문마다 새로 정하는 칸은 지난 값을 참고로만 보여 준다(채우기·바뀜·되돌리기 없음).
 */
function FieldControl<T extends FieldValues>({
  field,
  control,
  basePath,
  past,
}: {
  field: FieldDef;
  control: Control<T>;
  basePath: string;
  past?: FormPast;
}) {
  const { field: controller } = useController({
    control,
    name: `${basePath}.${field.key}` as Path<T>,
  });
  const value = controller.value as FieldState;
  const onChange = controller.onChange as (value: FieldState) => void;
  const id = inputId(basePath, field.key);

  let input;
  switch (field.type) {
    case "single":
      input = (
        <SingleInput
          field={field}
          value={value as OptionState | null}
          onChange={onChange}
          id={id}
        />
      );
      break;
    case "multi":
      input = (
        <MultiInput
          field={field}
          value={(value as OptionState[] | null) ?? []}
          onChange={onChange}
          id={id}
        />
      );
      break;
    case "number":
      input = (
        <NumberInput
          field={field}
          value={(value as string | null) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
      break;
    case "text":
      input = (
        <TextInput
          field={field}
          value={(value as string | null) ?? ""}
          onChange={onChange}
          id={id}
        />
      );
      break;
  }

  // 칩 묶음에는 라벨로 가리킬 입력 하나가 없으므로 숫자·글 칸만 htmlFor를 단다.
  const labelled = field.type === "number" || field.type === "text";
  const elementId = fieldElementId(basePath, field.key);
  const pastValue = past?.values?.[field.key];
  const filled = past?.fills[field.key];
  const fromPast = isPastFill(value, filled);
  let hint = null;
  let changed = false;
  if (past && pastValue && !fromPast) {
    const fill = reusableFieldValue(field, pastValue.value);
    const fillWithPast =
      fill === null
        ? undefined
        : () => {
            const state = toFieldState(field, fill);
            onChange(state);
            past.onFill({ [field.key]: { state, date: pastValue.date } });
            // 채운 뒤 버튼이 사라지므로 입력(칩 묶음은 칸)으로 포커스를 옮긴다.
            document.getElementById(labelled ? id : elementId)?.focus();
          };
    if (isEmptyValue(value)) {
      hint = (
        <PastValueHint
          label={field.label}
          text={formatFieldValue(field, fill ?? pastValue.value)}
          past={pastValue}
          onFill={fillWithPast}
        />
      );
    } else if (!sameFieldValue(value, toFieldState(field, pastValue.value))) {
      changed = !field.visitSpecific;
      hint = (
        <PastDiffLine
          label={field.label}
          text={formatFieldValue(field, pastValue.value)}
          past={pastValue}
          onRestore={fillWithPast}
        />
      );
    }
  }
  return (
    <div
      id={elementId}
      tabIndex={-1}
      className={cn(
        "flex scroll-mt-24 flex-col gap-2 outline-none",
        field.type === "number" && "min-w-0",
        fromPast && PAST_FILL_FRAME,
      )}
    >
      <FieldLabel
        field={field}
        htmlFor={labelled ? id : undefined}
        badge={
          fromPast && filled ? (
            <PastFillBadge date={filled.date} />
          ) : (
            changed && <PastChangedBadge />
          )
        }
      />
      {hint}
      {input}
    </div>
  );
}

/** 숫자 짝의 지난 값: 두 칸이 모두 비었을 때만, 같은 기록의 두 값을 함께. */
function PairPastHint({
  label,
  first,
  second,
  past,
  onFill,
}: {
  label: string;
  first: NumberFieldDef;
  second: NumberFieldDef;
  past: PastFieldValues;
  onFill: (first: string, second: string, date: string) => void;
}) {
  const a = past[first.key];
  const b = past[second.key];
  const source = a ?? b;
  if (!source) return null;
  const text = `${a ? String(a.value) : "—"} / ${b ? String(b.value) : "—"} ${first.unit}`;
  // 방문마다 새로 재는 칸(혈압 등)이면 참고로만 보여 준다.
  const fillA = a ? reusableFieldValue(first, a.value) : null;
  const fillB = b ? reusableFieldValue(second, b.value) : null;
  return (
    <PastValueHint
      label={label}
      text={text}
      past={source}
      onFill={
        fillA === null && fillB === null
          ? undefined
          : () => onFill(String(fillA ?? ""), String(fillB ?? ""), source.date)
      }
    />
  );
}

/** 서식이 짝으로 정한 숫자 두 칸을 "앞 / 뒤" 한 줄로(혈압 수축기/이완기). */
function NumberPairControl<T extends FieldValues>({
  label,
  first,
  second,
  control,
  basePath,
  past,
}: {
  label: string;
  first: NumberFieldDef;
  second: NumberFieldDef;
  control: Control<T>;
  basePath: string;
  past?: FormPast;
}) {
  const firstField = useController({
    control,
    name: `${basePath}.${first.key}` as Path<T>,
  }).field;
  const secondField = useController({
    control,
    name: `${basePath}.${second.key}` as Path<T>,
  }).field;

  const values = [firstField.value, secondField.value] as FieldState[];
  const fills = [past?.fills[first.key], past?.fills[second.key]];
  // 채운 칸이 있고, 채운 칸이 모두 그 값 그대로일 때.
  const fromPast =
    fills.some(Boolean) &&
    fills.every((fill, index) => !fill || isPastFill(values[index]!, fill));
  const filledDate = (fills[0] ?? fills[1])?.date;
  // 지난 값과 다른지(두 칸 중 하나라도 입력했을 때). 방문마다 새로 재는 짝(혈압)은 지난 값만 보여 준다.
  const pastA = past?.values?.[first.key];
  const pastB = past?.values?.[second.key];
  const pairPast = pastA ?? pastB;
  const pairChanged =
    !fromPast &&
    pairPast !== undefined &&
    values.some((value) => !isEmptyValue(value)) &&
    [pastA, pastB].some(
      (pastValue, index) =>
        !sameFieldValue(
          values[index],
          pastValue ? String(pastValue.value) : "",
        ),
    );

  return (
    <fieldset
      className={cn(
        "col-span-2 flex flex-col gap-2",
        fromPast && PAST_FILL_FRAME,
      )}
    >
      <legend className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold">
        {label}
        {fromPast && filledDate && <PastFillBadge date={filledDate} />}
        {pairChanged && !first.visitSpecific && <PastChangedBadge />}
      </legend>
      {pairChanged && pairPast && (
        <PastDiffLine
          label={label}
          text={`${pastA ? String(pastA.value) : "—"} / ${pastB ? String(pastB.value) : "—"} ${first.unit}`}
          past={pairPast}
        />
      )}
      {past?.values && values.every((value) => isEmptyValue(value)) && (
        <PairPastHint
          label={label}
          first={first}
          second={second}
          past={past.values}
          onFill={(a, b, date) => {
            firstField.onChange(a);
            secondField.onChange(b);
            past.onFill({
              ...(a && { [first.key]: { state: a, date } }),
              ...(b && { [second.key]: { state: b, date } }),
            });
            document.getElementById(inputId(basePath, first.key))?.focus();
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <NumberInput
          field={{ ...first, unit: "" }}
          value={(firstField.value as string | null) ?? ""}
          onChange={firstField.onChange}
          id={inputId(basePath, first.key)}
          label={first.label}
        />
        <span className="text-muted-foreground text-2xl" aria-hidden>
          /
        </span>
        <NumberInput
          field={{ ...second, unit: "" }}
          value={(secondField.value as string | null) ?? ""}
          onChange={secondField.onChange}
          id={inputId(basePath, second.key)}
          label={second.label}
        />
        <span className="text-muted-foreground w-14 shrink-0">
          {first.unit}
        </span>
      </div>
    </fieldset>
  );
}

type Block =
  | { kind: "field"; field: FieldDef }
  | { kind: "numbers"; fields: NumberFieldDef[] };

/** 서식의 숫자 짝 중 이 숫자 칸들 안에 두 칸이 모두 있는 것 */
function pairsIn(
  pairs: readonly NumberPair[],
  fields: readonly NumberFieldDef[],
) {
  return pairs.flatMap((pair) => {
    const [first, second] = pair.keys.map((key) =>
      fields.find((field) => field.key === key),
    );
    return first && second ? [{ label: pair.label, first, second }] : [];
  });
}

/** 이어지는 숫자 칸은 두 줄 격자로 묶는다. */
function toBlocks(fields: readonly FieldDef[]): Block[] {
  const blocks: Block[] = [];
  for (const field of fields) {
    const last = blocks.at(-1);
    if (field.type === "number") {
      if (last?.kind === "numbers") last.fields.push(field);
      else blocks.push({ kind: "numbers", fields: [field] });
    } else {
      blocks.push({ kind: "field", field });
    }
  }
  return blocks;
}

function NumberGrid<T extends FieldValues>({
  fields,
  pairs,
  control,
  basePath,
  past,
}: {
  fields: NumberFieldDef[];
  pairs: readonly NumberPair[];
  control: Control<T>;
  basePath: string;
  past?: FormPast;
}) {
  const paired = pairsIn(pairs, fields);
  const rest = fields.filter(
    (field) =>
      !paired.some((pair) => pair.first === field || pair.second === field),
  );

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
      {paired.map((pair) => (
        <NumberPairControl
          key={pair.first.key}
          {...pair}
          control={control}
          basePath={basePath}
          past={past}
        />
      ))}
      {rest.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          control={control}
          basePath={basePath}
          past={past}
        />
      ))}
    </div>
  );
}

/**
 * 서식 한 장의 입력 화면. basePath는 폼 상태에서 이 서식이 있는 경로(예: "forms.HOME_CARE_NURSE").
 * past(지난 기록 정보)를 주면 빈 칸 옆에 지난 값을, 지난 기록에서 채운 칸에는 표시를 단다.
 */
export function FormFields<T extends FieldValues>({
  form,
  control,
  basePath,
  past,
}: {
  form: FormDef;
  control: Control<T>;
  basePath: string;
  past?: FormPast;
}) {
  return (
    <div className="flex flex-col gap-4">
      {form.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-6">
            {toBlocks(section.fields).map((block) =>
              block.kind === "numbers" ? (
                <NumberGrid
                  key={block.fields[0]!.key}
                  fields={block.fields}
                  pairs={form.numberPairs ?? []}
                  control={control}
                  basePath={basePath}
                  past={past}
                />
              ) : (
                <FieldControl
                  key={block.field.key}
                  field={block.field}
                  control={control}
                  basePath={basePath}
                  past={past}
                />
              ),
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
