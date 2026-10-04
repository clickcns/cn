import {
  BLOOD_PRESSURE_PAIR,
  DIASTOLIC_FIELD,
  GLUCOSE_FIELD,
  PULSE_FIELD,
  RESPIRATION_FIELD,
  SYSTOLIC_FIELD,
  TEMPERATURE_FIELD,
  WEIGHT_CHANGE_FIELD,
} from "./forms/common.js";
import { formatFieldValue, type NumberFieldDef } from "./forms/engine.js";
import { sanitizeFieldValue } from "./forms/reuse.js";
import { recordDate, type RecipientRecord } from "./record-history.js";

/*
 * 활력징후 추이: 지난 기록에 적힌 값과 지난번과의 차이만 보여 준다. 정상·이상 기준이나 판단은 넣지 않는다
 * (진단 보조가 되지 않게). 칸은 서식이 함께 쓰는 정의(forms/common.ts)에서 읽고, 같은 키의 칸은 어느
 * 서식에서나 이 정의다(vital-signs.spec.ts가 확인).
 */

export interface VitalSign {
  id: string;
  label: string;
  /** 서식 칸. 혈압은 수축기·이완기 짝(한 기록에 둘 다 있을 때만 점) */
  fields: readonly NumberFieldDef[];
}

const single = (field: NumberFieldDef): VitalSign => ({
  id: field.key,
  label: field.label,
  fields: [field],
});

export const VITAL_SIGNS: readonly VitalSign[] = [
  {
    id: "bloodPressure",
    label: BLOOD_PRESSURE_PAIR.label,
    fields: [SYSTOLIC_FIELD, DIASTOLIC_FIELD],
  },
  single(PULSE_FIELD),
  single(TEMPERATURE_FIELD),
  single(RESPIRATION_FIELD),
  single(GLUCOSE_FIELD),
  // 그 자체가 변화량(signed)이라 지난번과의 차이를 셈하지 않는다
  single(WEIGHT_CHANGE_FIELD),
];

/** 추이에 쓰는 기록(지난 기록 또는 이번 확정 방문) */
export type VitalRecord = Pick<
  RecipientRecord,
  "id" | "status" | "scheduledAt" | "startedAt" | "forms"
>;

export interface VitalPoint {
  recordId: string;
  /** 방문 날짜(한국 날짜) */
  date: string;
  draft: boolean;
  /** 이번 방문(확정한 이 기록) */
  current: boolean;
  /** fields 순서의 값 */
  values: number[];
  /** 지난 점과의 차(소수 자리 맞춤). 첫 점과 변화량 칸은 null */
  change: number[] | null;
}

export interface VitalTrend {
  sign: VitalSign;
  /** 오래된 → 최근 */
  points: VitalPoint[];
}

const unitOf = (sign: VitalSign) => sign.fields[0]!.unit;

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** 기록 한 건의 그 활력징후 값(한 서식에 짝이 모두 있어야). 없으면 null. */
function vitalValues(record: VitalRecord, sign: VitalSign): number[] | null {
  for (const data of Object.values(record.forms)) {
    if (!data) continue;
    const values = sign.fields.map((field) => {
      const value = sanitizeFieldValue(field, data[field.key]);
      return typeof value === "number" ? value : null;
    });
    if (values.every((value) => value !== null)) return values as number[];
  }
  return null;
}

/**
 * 지난 기록(최신순)과 이번 확정 방문으로 활력징후별 추이. 값이 하나도 없는 활력징후는 뺀다.
 */
export function vitalTrends(
  records: readonly VitalRecord[],
  current?: VitalRecord,
): VitalTrend[] {
  const ordered = [...records].reverse();
  if (current) ordered.push(current);
  return VITAL_SIGNS.flatMap((sign) => {
    const points: VitalPoint[] = [];
    for (const record of ordered) {
      const values = vitalValues(record, sign);
      if (!values) continue;
      const previous = points.at(-1);
      points.push({
        recordId: record.id,
        date: recordDate(record),
        draft: record.status !== "CONFIRMED",
        current: record === current,
        values,
        change:
          sign.fields[0]!.signed || !previous
            ? null
            : values.map((value, index) =>
                roundTo(
                  value - previous.values[index]!,
                  sign.fields[index]!.decimals ?? 0,
                ),
              ),
      });
    }
    return points.length > 0 ? [{ sign, points }] : [];
  });
}

export interface VitalSummary {
  /** 가장 최근 측정 날짜 */
  date: string;
  /** 그 측정이 이번 방문 */
  current: boolean;
  /** 그때 잰 활력징후(추이 순서)와 그 값 */
  latest: { sign: VitalSign; point: VitalPoint }[];
  /** 이번 방문을 뺀, 활력징후를 하나라도 잰 기록 수 */
  measured: number;
}

/** 요약 줄: 가장 최근에 잰 날의 값들. 추이가 없으면 null. */
export function vitalSummary(
  trends: readonly VitalTrend[],
): VitalSummary | null {
  const last = trends.map((trend) => ({
    sign: trend.sign,
    point: trend.points.at(-1)!,
  }));
  if (last.length === 0) return null;
  const date = last.reduce((a, b) => (a.point.date >= b.point.date ? a : b))
    .point.date;
  const latest = last.filter(({ point }) => point.date === date);
  const measured = new Set(
    trends.flatMap((trend) =>
      trend.points
        .filter((point) => !point.current)
        .map((point) => point.recordId),
    ),
  ).size;
  return {
    date,
    current: latest.some(({ point }) => point.current),
    latest,
    measured,
  };
}

/** "132/84 mmHg", "36.6 ℃", 체중 변화는 "증 0.5 kg"·"변화 없음"(서식 표시와 같다) */
export function formatVitalValue(sign: VitalSign, values: number[]): string {
  if (sign.fields.length === 1) {
    return formatFieldValue(sign.fields[0]!, values[0]!);
  }
  return `${values.join("/")} ${unitOf(sign)}`;
}

/** 지난번 대비: "↑4 / ↓2", 모두 같으면 "변화 없음". 비교할 수 없으면 null. */
export function formatVitalChange(change: number[] | null): string | null {
  if (!change) return null;
  if (change.every((value) => value === 0)) return "변화 없음";
  return change
    .map((value) =>
      value === 0 ? "0" : `${value > 0 ? "↑" : "↓"}${Math.abs(value)}`,
    )
    .join(" / ");
}

/** 화면 읽기용: "지난번보다 수축기 혈압 4 mmHg 높음, 이완기 혈압 같음" */
export function vitalChangeLabel(
  sign: VitalSign,
  change: number[] | null,
): string | null {
  if (!change) return null;
  if (change.every((value) => value === 0)) return "지난번과 같음";
  const parts = change.map((value, index) => {
    const name = sign.fields.length > 1 ? sign.fields[index]!.label : null;
    const amount = `${Math.abs(value)} ${unitOf(sign)}`;
    const word = value === 0 ? "같음" : value > 0 ? "높음" : "낮음";
    return [name, value === 0 ? null : amount, word].filter(Boolean).join(" ");
  });
  return `지난번보다 ${parts.join(", ")}`;
}
