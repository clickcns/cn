import {
  ACCESS_ACTION_LABELS,
  ACCESS_LOG_MAX_SUBJECTS,
  accessSubjectsShown,
  formatKstDate,
  formatKstTime,
  kstWeekday,
  LOGIN_CLIENT_LABELS,
  PROFESSION_LABELS,
  PROGRAM_LABELS,
  ROLE_LABELS,
  VISIT_STATUS_LABELS,
  type AccessAction,
  type AccessLogEntry,
} from "@repo/shared-types";
import { Link } from "react-router";
import { z } from "zod";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/lib/routes";

/** 점검할 때 눈에 띄어야 하는 작업(로그인 실패·삭제·내려받기·권한 변경)에 색을 준다. */
const ACTION_VARIANT: Record<AccessAction, BadgeVariant> = {
  LOGIN: "outline",
  LOGOUT: "outline",
  LOGIN_FAILED: "destructive",
  VIEW: "neutral",
  CREATE: "primary",
  UPDATE: "primary",
  DELETE: "destructive",
  DOWNLOAD: "warning",
  PERMISSION: "warning",
};

/** 상세에 나오는 검색 조건·칸 이름(서버 요청의 이름 그대로 남긴다). 모르는 이름은 그대로 보인다. */
const DETAIL_LABELS: Record<string, string> = {
  from: "시작일",
  to: "종료일",
  date: "날짜",
  month: "달",
  q: "검색",
  status: "상태",
  program: "사업",
  page: "쪽",
  pageSize: "쪽당",
  limit: "개수",
  recipientId: "수급자",
  staffId: "담당자",
  actorId: "사용자",
  organizationId: "기관",
  action: "작업",
  failedOnly: "실패만",
  style: "양식",
  version: "차수",
  formId: "서식",
  formIds: "서식",
  client: "앱",
  beforeVisitId: "기준 방문",
  cursor: "이어 보기",
  withVisits: "방문 항목",
  groupBy: "묶음",
  role: "역할",
  profession: "직종",
  isActive: "사용",
  includeInactive: "중지 포함",
  forms: "서식 값",
  startedAt: "시작 시각",
  endedAt: "종료 시각",
  scheduledAt: "방문 일시",
  expectedScheduledAt: "본 일시",
  name: "이름",
  password: "비밀번호",
  licenseNumber: "면허번호",
  note: "메모",
};
const VALUE_LABELS: Record<string, string> = {
  ...ACCESS_ACTION_LABELS,
  ...VISIT_STATUS_LABELS,
  ...PROGRAM_LABELS,
  ...PROFESSION_LABELS,
  ...ROLE_LABELS,
  ...LOGIN_CLIENT_LABELS,
  true: "예",
  false: "아니오",
};
const UUID = z.uuid();

function detailValue(value: unknown): string {
  if (typeof value === "string") {
    return UUID.safeParse(value).success
      ? "지정"
      : (VALUE_LABELS[value] ?? value);
  }
  if (typeof value === "boolean") return VALUE_LABELS[String(value)];
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** 상세: 바꾼 칸 이름, 검색 조건, 실패 까닭. 값(기록 내용·비밀번호)은 처음부터 남기지 않는다. */
function detailText(detail: AccessLogEntry["detail"]): string | null {
  if (!detail) return null;
  const parts: string[] = [];
  const { fields, changes, error, ...rest } = detail;
  if (Array.isArray(fields) && fields.length > 0) {
    parts.push(
      `바꾼 칸 ${fields.map((field: string) => DETAIL_LABELS[field] ?? field).join(", ")}`,
    );
  }
  if (changes && typeof changes === "object") {
    for (const [key, change] of Object.entries(
      changes as Record<string, { before: unknown; after: unknown }>,
    )) {
      parts.push(
        `${DETAIL_LABELS[key] ?? key} ${change.before === null ? "없음" : detailValue(change.before)} → ${detailValue(change.after)}`,
      );
    }
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) continue;
    parts.push(`${DETAIL_LABELS[key] ?? key} ${detailValue(value)}`);
  }
  if (typeof error === "string") parts.push(`오류: ${error}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * 접속기록 표: 일시(초까지)·사용자·작업·대상(정보주체 이름을 누르면 그 수급자 기록만)·접속지·결과.
 */
export function AccessLogTable({
  items,
  onRecipient,
}: {
  items: AccessLogEntry[];
  onRecipient: (recipientId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">일시</TableHead>
          <TableHead className="w-44">사용자</TableHead>
          <TableHead>작업</TableHead>
          <TableHead>대상</TableHead>
          <TableHead className="w-36">접속지</TableHead>
          <TableHead className="w-24">결과</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((entry) => {
          const at = new Date(entry.at);
          const day = formatKstDate(at);

          const detail = detailText(entry.detail);
          const { shown, more } = accessSubjectsShown(entry);
          return (
            <TableRow key={entry.id} className="align-top">
              <TableCell className="tabular-nums">
                <div>
                  {day} ({kstWeekday(day)})
                </div>
                <div className="text-muted-foreground text-xs">
                  {formatKstTime(at, { seconds: true })}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium">{entry.actor.name ?? "—"}</div>
                <div className="text-muted-foreground text-xs">
                  {entry.actor.username}
                  {entry.actor.role && ` · ${ROLE_LABELS[entry.actor.role]}`}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={ACTION_VARIANT[entry.action]}>
                    {ACCESS_ACTION_LABELS[entry.action]}
                  </Badge>
                  <span>{entry.label}</span>
                </div>
                {detail && (
                  <div className="text-muted-foreground mt-1 text-xs break-all">
                    {detail}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {shown.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      title="이 수급자 기록만 보기"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={() => onRecipient(recipient.id)}
                    >
                      {recipient.name ?? "(알 수 없음)"}
                    </button>
                  ))}
                  {more > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {shown.length > 0 ? `외 ${more}명` : `${more}명`}
                      {entry.subjectCount > ACCESS_LOG_MAX_SUBJECTS &&
                        ` (앞 ${ACCESS_LOG_MAX_SUBJECTS}명까지 기록)`}
                    </span>
                  )}
                  {shown.length === 0 && entry.target?.name && (
                    <span>{entry.target.name}</span>
                  )}
                  {entry.target?.type === "visit" &&
                    entry.action !== "DELETE" && (
                      <Link
                        to={ROUTES.visitDetail(entry.target.id)}
                        className="text-muted-foreground text-xs underline-offset-4 hover:underline"
                      >
                        방문 보기
                      </Link>
                    )}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{entry.ip}</TableCell>
              <TableCell>
                {entry.status < 400 ? (
                  <span className="text-muted-foreground text-sm">성공</span>
                ) : (
                  <Badge variant="destructive">실패 {entry.status}</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
