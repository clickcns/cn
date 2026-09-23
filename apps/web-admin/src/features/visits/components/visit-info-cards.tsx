import {
  PROGRAM_LABELS,
  staffDisplayName,
  type VisitRecipient,
  type VisitSummary,
} from "@repo/shared-types";
import { CalendarClockIcon, UserRoundIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/components/ui/description-list";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import {
  formatBirthDate,
  formatCareGrade,
  formatDateTime,
  formatDuration,
  formatGender,
  formatVisitTimeRange,
  orDash,
} from "@/lib/format";

export function VisitInfoCard({
  visit,
  organizationName,
}: {
  visit: VisitSummary;
  organizationName?: string;
}) {
  const items: DescriptionItem[] = [
    { label: "방문 예정 일시", value: formatDateTime(visit.scheduledAt) },
    {
      label: "방문 시작 · 종료",
      value:
        visit.startedAt || visit.endedAt ? (
          <>
            {formatVisitTimeRange(
              visit.scheduledAt,
              visit.startedAt,
              visit.endedAt,
            )}
            {visit.startedAt && visit.endedAt && (
              <span className="text-muted-foreground ml-1.5">
                ({formatDuration(visit.startedAt, visit.endedAt)})
              </span>
            )}
          </>
        ) : (
          "—"
        ),
    },
    { label: "사업", value: PROGRAM_LABELS[visit.program] },
    {
      label: "담당자",
      value: staffDisplayName(visit.staff),
    },
    { label: "상태", value: <VisitStatusBadge status={visit.status} /> },
    { label: "확정 일시", value: formatDateTime(visit.confirmedAt) },
  ];
  if (organizationName) items.push({ label: "기관", value: organizationName });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="text-primary size-4" />
          방문 정보
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList items={items} />
      </CardContent>
    </Card>
  );
}

export function RecipientInfoCard({
  recipient,
}: {
  recipient: VisitRecipient;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundIcon className="text-primary size-4" />
          수급자 정보
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          columns={2}
          items={[
            { label: "이름", value: recipient.name },
            {
              label: "장기요양등급",
              value: formatCareGrade(recipient.careGrade),
            },
            { label: "성별", value: formatGender(recipient.gender) },
            { label: "연락처", value: orDash(recipient.phone) },
            {
              label: "장기요양인정번호",
              value: orDash(recipient.ltcCertNumber),
              wide: true,
            },
            {
              label: "생년월일",
              value: formatBirthDate(recipient.birthDate),
              wide: true,
            },
            { label: "주소", value: orDash(recipient.address), wide: true },
            { label: "보호자", value: orDash(recipient.guardianName) },
            { label: "보호자 연락처", value: orDash(recipient.guardianPhone) },
            {
              label: "메모",
              value: (
                <span className="whitespace-pre-wrap">
                  {orDash(recipient.notes)}
                </span>
              ),
              wide: true,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
