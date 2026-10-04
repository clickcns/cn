import type { VitalTrend } from "@repo/shared-types";
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

/** "2026-09-22" → "9/22" */
function shortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const DOT = { r: 3, fill: "currentColor", strokeWidth: 0 };

/**
 * 활력징후 하나의 작은 그래프(기록된 값만 — 기준선·정상 범위·색 경고 없음). 화면 읽기는 옆 표가 맡아
 * 그림은 숨긴다. 혈압은 수축기 실선·이완기 점선, 체중 변화(그 자체가 변화량)는 0을 기준으로 한 막대.
 * Recharts는 이 파일에만 두고 lazy로 불러 기록 화면 첫 로딩에 넣지 않는다.
 */
export default function VitalsChart({ trend }: { trend: VitalTrend }) {
  const { fields } = trend.sign;
  const data = trend.points.map((point) => ({
    date: shortDate(point.date),
    ...Object.fromEntries(
      point.values.map((value, index) => [`v${index}`, value]),
    ),
  }));
  const bars = fields[0]!.signed;

  return (
    <div className="text-primary h-24 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 10, bottom: 0, left: 10 }}
          accessibilityLayer={false}
        >
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={["auto", "auto"]} />
          {bars ? (
            <>
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar
                dataKey="v0"
                fill="currentColor"
                radius={2}
                isAnimationActive={false}
              />
            </>
          ) : (
            fields.map((field, index) => (
              <Line
                key={field.key}
                dataKey={`v${index}`}
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={index > 0 ? "4 3" : undefined}
                dot={DOT}
                isAnimationActive={false}
              />
            ))
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
