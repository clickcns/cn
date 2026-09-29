import {
  findOption,
  OPTION_DETAIL_MAX_LENGTH,
  withParticle,
  type ChoiceFieldDef,
  type FieldDef,
  type FormDef,
  type NumberFieldDef,
  type NumberPair,
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
import { fieldElementId, inputId } from "@/features/forms/lib/field-ids";
import { Textarea } from "@/components/ui/textarea";
import {
  toOptionState,
  type FieldState,
  type OptionState,
} from "@/features/forms/lib/form-state";
import { cn } from "@/lib/utils";

/*
 * 서식 정의로 입력 화면을 그린다. 칸 종류마다 입력 부품이 정해져 있다.
 * - 하나 고르기·여러 개 고르기: 칩. 고른 항목에 괄호 내용(기타·부위·시간 등)이 있으면 아래에 입력 칸
 * - 숫자: 단위가 붙은 입력. 서식이 짝으로 정한 두 칸(혈압 수축기/이완기)은 한 줄
 * - 글: 한 줄 또는 여러 줄. 권장 글자 수(공단 앱 200자)를 넘으면 경고
 */

const emptyOption = (value: string) => toOptionState({ value });

function FieldLabel({ field, htmlFor }: { field: FieldDef; htmlFor?: string }) {
  // 확정 전에 반드시 채울 칸
  const mark = field.required && (
    <span className="text-destructive ml-1" aria-label="필수">
      *
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
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
        className="pr-18 text-lg tabular-nums"
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

/** 칸 하나: 폼 상태와 연결하고 종류에 맞는 입력을 그린다. */
function FieldControl<T extends FieldValues>({
  field,
  control,
  basePath,
}: {
  field: FieldDef;
  control: Control<T>;
  basePath: string;
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
  return (
    <div
      id={fieldElementId(basePath, field.key)}
      className={cn(
        "flex scroll-mt-24 flex-col gap-2",
        field.type === "number" && "min-w-0",
      )}
    >
      <FieldLabel field={field} htmlFor={labelled ? id : undefined} />
      {input}
    </div>
  );
}

/** 서식이 짝으로 정한 숫자 두 칸을 "앞 / 뒤" 한 줄로(혈압 수축기/이완기). */
function NumberPairControl<T extends FieldValues>({
  label,
  first,
  second,
  control,
  basePath,
}: {
  label: string;
  first: NumberFieldDef;
  second: NumberFieldDef;
  control: Control<T>;
  basePath: string;
}) {
  const firstField = useController({
    control,
    name: `${basePath}.${first.key}` as Path<T>,
  }).field;
  const secondField = useController({
    control,
    name: `${basePath}.${second.key}` as Path<T>,
  }).field;

  return (
    <fieldset className="col-span-2 flex flex-col gap-2">
      <legend className="mb-2 text-base font-semibold">{label}</legend>
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
}: {
  fields: NumberFieldDef[];
  pairs: readonly NumberPair[];
  control: Control<T>;
  basePath: string;
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
        />
      ))}
      {rest.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          control={control}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

/**
 * 서식 한 장의 입력 화면. basePath는 폼 상태에서 이 서식이 있는 경로(예: "forms.HOME_CARE_NURSE").
 */
export function FormFields<T extends FieldValues>({
  form,
  control,
  basePath,
}: {
  form: FormDef;
  control: Control<T>;
  basePath: string;
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
                />
              ) : (
                <FieldControl
                  key={block.field.key}
                  field={block.field}
                  control={control}
                  basePath={basePath}
                />
              ),
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
