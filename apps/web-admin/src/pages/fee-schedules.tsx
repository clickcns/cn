import {
  addMonths,
  formatKstDate,
  formatMonthLabel,
  monthOf,
  scheduleForMonth,
  type HomeCareFeeSchedule,
} from "@repo/shared-types";
import { CircleHelpIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tour } from "@/components/ui/tour";
import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import { FeeScheduleDialog } from "@/features/fee-schedules/components/fee-schedule-dialog";
import { FeeScheduleHistory } from "@/features/fee-schedules/components/fee-schedule-history";
import { FeeValuesTable } from "@/features/fee-schedules/components/fee-values-table";
import { useFeeSchedules } from "@/features/fee-schedules/hooks/use-fee-schedules";
import { feeScheduleTourSteps } from "@/features/fee-schedules/lib/fee-schedule-tour";

/**
 * 수가 관리: 재택의료 수입이 쓰는 수가·비율·한도. 이번 달에 쓰는 묶음과 이력(시행 월 늦은 순,
 * 지운 것 포함, 맨 아래 코드 기본값)을 보이고, 운영자는 지침이 바뀌면 새 묶음을 시행 월과 함께
 * 넣는다(모든 기관 공통). 기관 관리자는 보기만 한다.
 */
export default function FeeSchedulesPage() {
  const isAdmin = useIsAdmin();
  const thisMonth = monthOf(formatKstDate());
  const query = useFeeSchedules();
  const list = query.data;
  // null: 닫힘, { editing: null }: 새로 넣기, { editing: 묶음 }: 그 묶음 고치기
  const [dialog, setDialog] = useState<{
    editing: HomeCareFeeSchedule | null;
  } | null>(null);
  const [touring, setTouring] = useState(false);

  const current = list ? scheduleForMonth(list.schedules, thisMonth) : null;
  const upcoming = list?.schedules
    .filter(
      (schedule) => !schedule.deletedAt && schedule.effectiveMonth > thisMonth,
    )
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))[0];

  return (
    <>
      <PageHeader
        title="수가 관리"
        description={
          <>
            재택의료 수입이 쓰는 수가·비율·한도입니다. 지침이 바뀌면 새 수가를
            시행 월과 함께 넣습니다(모든 기관 공통, 고치거나 지운 수가도 이력에
            남습니다). 지침 받는 곳과 쪽수는{" "}
            <a
              data-tour="fee-doc"
              href="/dev/fees"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              수가 근거 문서
            </a>
            에 있습니다.
            {!isAdmin && " 수가는 운영자만 바꿀 수 있습니다."}
          </>
        }
        actions={
          list && (
            <>
              <Button variant="outline" onClick={() => setTouring(true)}>
                <CircleHelpIcon />
                사용 안내
              </Button>
              {isAdmin && (
                <Button
                  data-tour="fee-new"
                  onClick={() => setDialog({ editing: null })}
                >
                  <PlusIcon />새 수가 넣기
                </Button>
              )}
            </>
          )
        }
      />

      {query.isError ? (
        <Card>
          <ErrorState
            error={query.error}
            title="수가를 불러오지 못했습니다"
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : !list ? (
        <Card>
          <LoadingState />
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card data-tour="fee-current" className="grid gap-4 p-5">
            <div className="grid gap-1">
              <h2 className="text-[15px] font-semibold">
                {formatMonthLabel(thisMonth)}에 쓰는 수가
              </h2>
              <p className="text-muted-foreground text-xs">
                근거: {current?.source ?? list.defaults.source}
                {upcoming &&
                  ` · ${formatMonthLabel(upcoming.effectiveMonth)}부터 새 수가(예정)`}
              </p>
            </div>
            <FeeValuesTable fees={current?.fees ?? list.defaults.fees} />
          </Card>

          <Card data-tour="fee-history" className="overflow-hidden">
            <FeeScheduleHistory
              list={list}
              thisMonth={thisMonth}
              current={current}
              canEdit={isAdmin}
              onEdit={(schedule) => setDialog({ editing: schedule })}
            />
          </Card>

          <FeeScheduleDialog
            open={dialog !== null}
            onOpenChange={(open) => {
              if (!open) setDialog(null);
            }}
            list={list}
            editing={dialog?.editing ?? null}
            thisMonth={thisMonth}
            defaultMonth={addMonths(thisMonth, 1)}
          />
          <Tour
            steps={feeScheduleTourSteps(isAdmin)}
            open={touring}
            onClose={() => setTouring(false)}
          />
        </div>
      )}
    </>
  );
}
