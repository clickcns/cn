import {
  addKstDays,
  checkVisitTimes,
  formatKstDate,
  formatKstTime,
  isIsoDate,
} from "@repo/shared-types";
import { Clock, TriangleAlert } from "lucide-react";
import {
  useController,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  toVisitTimes,
  type RecordFormValues,
} from "@/features/visits/lib/record-form";
import { formatDateLabel, minutesBetween } from "@/lib/date";

interface VisitTimeSectionProps {
  control: Control<RecordFormValues>;
  register: UseFormRegister<RecordFormValues>;
  setValue: UseFormSetValue<RecordFormValues>;
}

const TIME_FIELDS = [
  { name: "startTime", label: "시작" },
  { name: "endTime", label: "종료" },
] as const;

type TimeFieldName = (typeof TIME_FIELDS)[number]["name"];

type VisitTimeValues = Pick<
  RecordFormValues,
  "visitDate" | "startTime" | "endTime" | "endsNextDay"
>;

/**
 * 입력 중인 방문 시간의 총 소요 시간(분)과, 저장 규칙에 어긋나면 그 문구.
 * 저장할 때와 같은 변환(toVisitTimes)·규칙(checkVisitTimes)을 쓴다.
 */
function describeVisitTimes(values: VisitTimeValues): {
  minutes: number | null;
  warning: string | null;
} {
  const times = toVisitTimes(values);
  if (!times.ok) return { minutes: null, warning: times.message };
  const { startedAt, endedAt } = times;
  if (!startedAt || !endedAt) return { minutes: null, warning: null };
  const warning = checkVisitTimes(startedAt, endedAt);
  return {
    minutes: warning ? null : minutesBetween(startedAt, endedAt),
    warning,
  };
}

export function VisitTimeSection({
  control,
  register,
  setValue,
}: VisitTimeSectionProps) {
  const [visitDate, startTime, endTime] = useWatch({
    control,
    name: ["visitDate", "startTime", "endTime"],
  });
  const { field: endsNextDayField } = useController({
    control,
    name: "endsNextDay",
  });
  const endsNextDay = endsNextDayField.value;

  const { minutes, warning } = describeVisitTimes({
    visitDate,
    startTime,
    endTime,
    endsNextDay,
  });
  const isValidDate = isIsoDate(visitDate);
  const nextDayLabel = isValidDate
    ? `(${formatDateLabel(addKstDays(visitDate, 1))})`
    : "";
  // 종료가 시작보다 빠르면 "다음 날 종료"를 고를 수 있게만 한다.
  // 자동으로 켜지 않는다(오타가 23시간짜리 방문이 되지 않게).
  const showEndsNextDay =
    endsNextDay || (Boolean(startTime && endTime) && endTime < startTime);

  const setNow = (name: TimeFieldName) => {
    const now = new Date();
    const today = formatKstDate(now);
    const options = { shouldDirty: true };
    setValue(name, formatKstTime(now), options);

    if (name === "startTime") {
      setValue("visitDate", today, options);
    } else if (isValidDate) {
      // 방문 날짜 다음 날에 끝내면 다음 날 종료, 같은 날이면 당일 종료.
      if (today === visitDate) {
        setValue("endsNextDay", false, options);
      } else if (today === addKstDays(visitDate, 1)) {
        setValue("endsNextDay", true, options);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>방문 시간</CardTitle>
        {minutes !== null && (
          <span className="text-primary font-semibold">총 {minutes}분</span>
        )}
      </CardHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="visit-date">방문 날짜</Label>
        <Input
          id="visit-date"
          type="date"
          className="text-lg tabular-nums"
          aria-invalid={isValidDate ? undefined : true}
          {...register("visitDate")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        {TIME_FIELDS.map((field) => {
          const id = `visit-${field.name}`;
          return (
            <div key={field.name} className="flex flex-col gap-2">
              <Label htmlFor={id}>{field.label} 시각</Label>
              <div className="flex gap-2">
                <Input
                  id={id}
                  type="time"
                  className="flex-1 text-lg tabular-nums"
                  {...register(field.name)}
                />
                <Button variant="soft" onClick={() => setNow(field.name)}>
                  <Clock />
                  지금
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {warning && (
        <p className="text-warning flex items-start gap-1.5 font-semibold">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          {warning}
        </p>
      )}

      {showEndsNextDay && (
        <div className="bg-muted/70 flex min-h-14 items-center justify-between gap-4 rounded-xl px-4 py-1">
          <Label
            htmlFor="visit-ends-next-day"
            className="flex-1 cursor-pointer py-2 font-medium"
          >
            자정을 넘겨 다음 날{nextDayLabel}에 끝났습니다
          </Label>
          <Switch
            id="visit-ends-next-day"
            checked={endsNextDay}
            onCheckedChange={endsNextDayField.onChange}
            onBlur={endsNextDayField.onBlur}
          />
        </div>
      )}
    </Card>
  );
}
