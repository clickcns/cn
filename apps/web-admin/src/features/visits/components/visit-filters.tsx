import {
  isIsoDate,
  PROGRAM_LABELS,
  PROGRAMS,
  VISIT_STATUS_LABELS,
  VISIT_STATUSES,
} from "@repo/shared-types";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useScopeOrganizationId,
  useShowsAllOrganizations,
} from "@/features/organizations/hooks/use-organization-scope";
import { useVisitStaff } from "@/features/users/hooks/use-users";
import { staffLabel } from "@/features/users/lib/staff-label";
import type { VisitFilters as VisitFilterValues } from "@/features/visits/hooks/use-visit-filters";

interface VisitFiltersProps {
  filters: VisitFilterValues;
  onChange: (key: keyof VisitFilterValues, value: string | undefined) => void;
  onReset: () => void;
  canReset: boolean;
  /** 달력 보기는 달로 기간을 정하므로 기간 칸을 숨긴다. */
  showDateRange?: boolean;
}

export function VisitFilters({
  filters,
  onChange,
  onReset,
  canReset,
  showDateRange = true,
}: VisitFiltersProps) {
  const scopeOrganizationId = useScopeOrganizationId();
  const showsAllOrganizations = useShowsAllOrganizations();
  // 지난 방문을 찾을 수 있게 비활성 계정도 목록에 둔다.
  const { staff, isPending: staffPending } = useVisitStaff(
    scopeOrganizationId,
    { includeInactive: true },
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {showDateRange && (
        <div className="grid gap-1.5">
          <Label htmlFor="visit-filter-from">기간</Label>
          <div className="flex items-center gap-1.5">
            <DateInput
              id="visit-filter-from"
              aria-label="시작일"
              containerClassName="w-38"
              value={filters.from}
              max={filters.to}
              // 목록 조건은 온전한 날짜일 때만 바꾼다(치는 중인 글자는 칸이 들고 있다).
              onChange={(value) => {
                if (isIsoDate(value)) onChange("from", value);
              }}
            />
            <span className="text-muted-foreground" aria-hidden>
              ~
            </span>
            <DateInput
              aria-label="종료일"
              containerClassName="w-38"
              value={filters.to}
              min={filters.from}
              onChange={(value) => {
                if (isIsoDate(value)) onChange("to", value);
              }}
            />
          </div>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="visit-filter-status">상태</Label>
        <Select
          id="visit-filter-status"
          containerClassName="w-32"
          value={filters.status ?? ""}
          onChange={(event) => onChange("status", event.target.value)}
        >
          <option value="">전체 상태</option>
          {VISIT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {VISIT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="visit-filter-program">사업</Label>
        <Select
          id="visit-filter-program"
          containerClassName="w-44"
          value={filters.program ?? ""}
          onChange={(event) => onChange("program", event.target.value)}
        >
          <option value="">전체 사업</option>
          {PROGRAMS.map((program) => (
            <option key={program} value={program}>
              {PROGRAM_LABELS[program]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="visit-filter-staff">담당자</Label>
        <Select
          id="visit-filter-staff"
          containerClassName="w-56"
          value={filters.staffId ?? ""}
          disabled={staffPending}
          onChange={(event) => onChange("staffId", event.target.value)}
        >
          <option value="">전체 담당자</option>
          {/* 조회 중이거나 기관을 바꿔 목록에 없는 담당자도 선택값은 유지한다. */}
          {filters.staffId &&
            !staff.some((user) => user.id === filters.staffId) && (
              <option value={filters.staffId}>
                {staffPending ? "불러오는 중…" : "선택한 담당자"}
              </option>
            )}
          {staff.map((user) => (
            <option key={user.id} value={user.id}>
              {staffLabel(user, { withOrganization: showsAllOrganizations })}
            </option>
          ))}
        </Select>
      </div>
      {canReset && (
        <Button
          variant="ghost"
          onClick={onReset}
          className="text-muted-foreground"
        >
          <RotateCcwIcon />
          초기화
        </Button>
      )}
    </div>
  );
}
