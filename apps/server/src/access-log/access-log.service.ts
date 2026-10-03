import { Injectable } from "@nestjs/common";
import {
  ACCESS_ACTION_LABELS,
  ACCESS_LOG_EXPORT_MAX_ROWS,
  ACCESS_LOG_SHOWN_SUBJECTS,
  accessSubjects,
  accessTargetText,
  formatKstDate,
  formatKstTime,
  ROLE_LABELS,
  type AccessLogEntry,
  type AccessLogPage,
  type AccessLogQuerySchema,
  type AccessTargetType,
} from "@repo/shared-types";
import type { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import type { AccessLog, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/index.js";
import {
  responseErrorMessage,
  type AccessLogHolder,
} from "./access-log.context.js";
import {
  accessActor,
  accessLogWhere,
  buildAccessLog,
  paramId,
  resultId,
  scopeOrganizationId,
  type AccessActor,
  type AccessOutcome,
  type ResolvedTarget,
} from "./access-log.entry.js";

const EXPORT_BATCH = 1_000;

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 접속기록 남기기·보기. 남기기는 응답이 끝날 때(접속기록 가드), 보기·내려받기는 기관 관리자(자기
 * 기관)와 운영자가 한다. 표는 고칠 수 없다(DB 트리거).
 */
@Injectable()
export class AccessLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    logger.setContext(AccessLogService.name);
  }

  /** 대상 하나의 정보주체·기관(사용자는 바꾸기 전 권한도). 찾지 못하거나 실패하면 빈 값. */
  async resolveTarget(
    type: AccessTargetType,
    id: string | null,
  ): Promise<ResolvedTarget> {
    const empty: ResolvedTarget = {
      type,
      id,
      recipientIds: [],
      organizationId: null,
      before: null,
    };
    if (!id) return empty;
    try {
      switch (type) {
        case "visit": {
          const visit = await this.prisma.visit.findUnique({
            where: { id },
            select: { recipientId: true, organizationId: true },
          });
          return visit
            ? {
                ...empty,
                recipientIds: [visit.recipientId],
                organizationId: visit.organizationId,
              }
            : empty;
        }
        case "recipient": {
          const recipient = await this.prisma.recipient.findUnique({
            where: { id },
            select: { organizationId: true },
          });
          return recipient
            ? {
                ...empty,
                recipientIds: [id],
                organizationId: recipient.organizationId,
              }
            : empty;
        }
        case "user": {
          const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
              role: true,
              profession: true,
              organizationId: true,
              isActive: true,
            },
          });
          return user
            ? { ...empty, organizationId: user.organizationId, before: user }
            : empty;
        }
        case "organization":
          return { ...empty, organizationId: id };
      }
    } catch {
      return empty;
    }
  }

  /**
   * 응답이 끝난 요청 한 줄. 토큰이 만료돼 막힌 요청(401)은 누구의 것인지 몰라 남기지 않는다(로그인
   * 실패는 남긴다). 남기지 못하면 그 줄을 서버 로그에 그대로 남긴다(기록 값·비밀번호는 처음부터 없다).
   */
  async record(
    request: Request,
    response: Response,
    holder: AccessLogHolder,
  ): Promise<void> {
    const { spec } = holder;
    const outcome: AccessOutcome = {
      status: response.statusCode,
      result: holder.result,
      error: responseErrorMessage(response),
    };
    if (outcome.status === 401 && spec.action !== "LOGIN") return;
    let data: Prisma.AccessLogCreateInput | null = null;
    try {
      const actor = accessActor(request, outcome.result);
      const target = await this.targetOf(request, holder, outcome);
      const list = spec.target?.kind === "list" ? spec.target : null;
      const subjects =
        list && outcome.result !== undefined
          ? {
              ...accessSubjects(list.recipients?.(outcome.result) ?? []),
              ...(list.count ? { count: list.count(outcome.result) } : {}),
            }
          : {
              ids: target?.recipientIds ?? [],
              count: target?.recipientIds.length ?? 0,
            };
      const organizationIds = await this.organizationsOf(
        request,
        actor,
        target,
        subjects.ids,
        spec.action === "LOGIN" && outcome.status >= 400,
      );
      data = buildAccessLog(spec, request, outcome, {
        actor,
        target,
        subjects,
        organizationIds,
      });
      await this.prisma.accessLog.create({ data });
    } catch (error) {
      this.logger.error(
        { err: error, accessLog: data, path: request.path, label: spec.label },
        "접속기록을 남기지 못했습니다",
      );
    }
  }

  /** 대상: 인터셉터가 찾기 시작한 것, 새로 만든 것(응답의 id), 가드에서 막혀 못 찾은 경로 값. */
  private async targetOf(
    request: Request,
    holder: AccessLogHolder,
    outcome: AccessOutcome,
  ): Promise<ResolvedTarget | null> {
    const target = holder.spec.target;
    if (!target || target.kind === "list") return null;
    if (holder.prepared) return holder.prepared;
    if (target.from === "result") {
      return outcome.status < 400
        ? this.resolveTarget(target.kind, resultId(outcome.result))
        : null;
    }
    return {
      type: target.kind,
      id: paramId(request),
      recipientIds: [],
      organizationId: null,
      before: null,
    };
  }

  /**
   * 기록의 기관들: 대상의 기관, 목록이면 나온 수급자의 기관들, 로그인 실패면 입력한 아이디의 기관,
   * 그 밖에는 요청한 기관(운영자) 또는 사용자 기관. 기관 관리자는 자기 기관이 든 기록을 본다.
   */
  private async organizationsOf(
    request: Request,
    actor: AccessActor,
    target: ResolvedTarget | null,
    subjectIds: string[],
    loginFailed: boolean,
  ): Promise<string[]> {
    if (target?.organizationId) return [target.organizationId];
    if (subjectIds.length > 0) {
      const rows = await this.prisma.recipient.findMany({
        where: { id: { in: subjectIds } },
        select: { organizationId: true },
        distinct: ["organizationId"],
      });
      return rows.map((row) => row.organizationId);
    }
    if (loginFailed) {
      const user = await this.prisma.user.findUnique({
        where: { username: actor.username },
        select: { organizationId: true },
      });
      return user?.organizationId ? [user.organizationId] : [];
    }
    const organizationId = scopeOrganizationId(actor, request);
    return organizationId ? [organizationId] : [];
  }

  async list(
    actor: AuthenticatedUser,
    query: z.output<typeof AccessLogQuerySchema>,
  ): Promise<AccessLogPage> {
    const where = accessLogWhere(actor, query);
    const [total, rows] = await Promise.all([
      this.prisma.accessLog.count({ where }),
      this.prisma.accessLog.findMany({
        where,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: await this.toEntries(rows, query.recipientId),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * CSV(엑셀에서 열리게 BOM). 최신순 ACCESS_LOG_EXPORT_MAX_ROWS줄까지 나눠 읽고, 넘으면 마지막 줄에
   * 알린다.
   */
  async exportCsv(
    actor: AuthenticatedUser,
    query: z.output<typeof AccessLogQuerySchema>,
  ): Promise<string> {
    const where = accessLogWhere(actor, query);
    const lines = [
      [
        "일시",
        "아이디",
        "이름",
        "역할",
        "작업",
        "작업 이름",
        "대상",
        "정보주체 수",
        "접속지",
        "결과",
        "경로",
        "상세",
      ].join(","),
    ];
    let truncated = false;
    for (let skip = 0; ; skip += EXPORT_BATCH) {
      const take = Math.min(EXPORT_BATCH, ACCESS_LOG_EXPORT_MAX_ROWS - skip);
      const rows = await this.prisma.accessLog.findMany({
        where,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip,
        take: take + 1,
      });
      for (const entry of await this.toEntries(
        rows.slice(0, take),
        query.recipientId,
      )) {
        const at = new Date(entry.at);
        lines.push(
          [
            `${formatKstDate(at)} ${formatKstTime(at, { seconds: true })}`,
            entry.actor.username,
            entry.actor.name,
            entry.actor.role ? ROLE_LABELS[entry.actor.role] : "",
            ACCESS_ACTION_LABELS[entry.action],
            entry.label,
            accessTargetText(entry),
            entry.subjectCount,
            entry.ip,
            entry.status,
            `${entry.method} ${entry.path}`,
            entry.detail ? JSON.stringify(entry.detail) : "",
          ]
            .map(csvCell)
            .join(","),
        );
      }
      if (rows.length <= take) break;
      if (skip + take >= ACCESS_LOG_EXPORT_MAX_ROWS) {
        truncated = true;
        break;
      }
    }
    if (truncated) {
      lines.push(
        csvCell(
          `(최근 ${ACCESS_LOG_EXPORT_MAX_ROWS.toLocaleString("ko-KR")}줄까지만 담았습니다. 기간을 나눠 내려받아 주세요)`,
        ),
      );
    }
    return `\uFEFF${lines.join("\r\n")}\r\n`;
  }

  /**
   * 정보주체·사용자·기관의 지금 이름을 붙인다(기록에는 id만). 정보주체는 화면·CSV가 쓰는 앞쪽 몇 명과
   * 수급자로 좁혀 본 그 수급자만 보낸다(전체 수는 subjectCount).
   */
  private async toEntries(
    rows: AccessLog[],
    recipientId?: string,
  ): Promise<AccessLogEntry[]> {
    const shownIds = (row: AccessLog) => {
      const ids = row.recipientIds.slice(0, ACCESS_LOG_SHOWN_SUBJECTS);
      return recipientId &&
        !ids.includes(recipientId) &&
        row.recipientIds.includes(recipientId)
        ? [recipientId, ...ids.slice(0, ACCESS_LOG_SHOWN_SUBJECTS - 1)]
        : ids;
    };
    const targetIds = (type: AccessTargetType) => [
      ...new Set(
        rows.flatMap((row) =>
          row.targetType === type && row.targetId ? [row.targetId] : [],
        ),
      ),
    ];
    const recipientIds = [...new Set(rows.flatMap(shownIds))];
    const userIds = targetIds("user");
    const organizationIds = targetIds("organization");
    const [recipients, users, organizations] = await Promise.all([
      recipientIds.length
        ? this.prisma.recipient.findMany({
            where: { id: { in: recipientIds } },
            select: { id: true, name: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        : [],
      organizationIds.length
        ? this.prisma.organization.findMany({
            where: { id: { in: organizationIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const names = new Map(
      [...recipients, ...users, ...organizations].map((item) => [
        item.id,
        item.name,
      ]),
    );
    return rows.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      actor: {
        id: row.actorId,
        username: row.actorUsername,
        name: row.actorName,
        role: row.actorRole,
      },
      action: row.action,
      label: row.label,
      target:
        row.targetType && row.targetId
          ? {
              type: row.targetType as AccessTargetType,
              id: row.targetId,
              name: names.get(row.targetId) ?? null,
            }
          : null,
      recipients: shownIds(row).map((id) => ({
        id,
        name: names.get(id) ?? null,
      })),
      subjectCount: row.subjectCount,
      ip: row.ip,
      method: row.method,
      path: row.path,
      status: row.status,
      detail: (row.detail as Record<string, unknown> | null) ?? null,
    }));
  }
}
