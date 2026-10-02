import {
  addMonths,
  formatKstDate,
  formatMonthLabel,
  monthOf,
  scheduleForMonth,
} from "@repo/shared-types";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { useIsAdmin } from "@/features/auth/hooks/use-current-user";
import { CreateFeeScheduleDialog } from "@/features/fee-schedules/components/create-fee-schedule-dialog";
import { FeeScheduleHistory } from "@/features/fee-schedules/components/fee-schedule-history";
import { FeeValuesTable } from "@/features/fee-schedules/components/fee-values-table";
import { useFeeSchedules } from "@/features/fee-schedules/hooks/use-fee-schedules";

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
  const [creating, setCreating] = useState(false);

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
            시행 월과 함께 넣습니다(모든 기관 공통, 넣은 수가는 고치지 않고 새로
            넣습니다). 지침 받는 곳과 쪽수는{" "}
            <a
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
          isAdmin &&
          list && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />새 수가 넣기
            </Button>
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
          <Card className="grid gap-4 p-5">
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

          <Card className="overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="text-[15px] font-semibold">이력</h2>
              <p className="text-muted-foreground text-xs">
                줄을 누르면 값과 전 수가에서 바뀐 칸을 봅니다.
              </p>
            </div>
            <FeeScheduleHistory
              list={list}
              thisMonth={thisMonth}
              current={current}
              canEdit={isAdmin}
            />
          </Card>

          <CreateFeeScheduleDialog
            open={creating}
            onOpenChange={setCreating}
            list={list}
            thisMonth={thisMonth}
            defaultMonth={addMonths(thisMonth, 1)}
          />
        </div>
      )}
    </>
  );
}
