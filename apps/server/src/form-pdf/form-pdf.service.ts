import { Injectable, NotFoundException } from "@nestjs/common";
import {
  addMonths,
  formatKstDate,
  formatMonthLabel,
  kstStartOfDay,
  type FormPdfStyle,
  type VisitRecordVersionDetail,
} from "@repo/shared-types";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { resolveOrganizationFilter } from "../core/utils/org-scope.js";
import { PrismaService } from "../prisma/index.js";
import {
  toVisitRecordVersionDetail,
  versionActorsArgs,
} from "../visit/visit.mapper.js";
import { visitScope } from "../visit/visit.service.js";
import { buildNurseMonthPdf, buildVisitPdf } from "./build.js";
import type { PdfVisitRecord } from "./pdf-record.js";

export interface PdfFile {
  bytes: Uint8Array;
  filename: string;
}

/** 확정본 한 벌 → 서식별 PDF 기록. 방문일은 실제 방문 시작(없으면 예정일)의 한국 날짜. */
function toPdfRecords(
  version: VisitRecordVersionDetail,
  scheduledAt: Date,
): PdfVisitRecord[] {
  const { snapshot } = version;
  const visitDate = formatKstDate(
    snapshot.startedAt ? new Date(snapshot.startedAt) : scheduledAt,
  );
  return snapshot.formIds.map((formId) => ({
    formId,
    data: snapshot.forms[formId] ?? {},
    header: snapshot.header,
    profession: snapshot.profession,
    visitDate,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    version: version.version,
    confirmedAt: version.confirmedAt,
    confirmedByName: version.confirmedBy.name,
    hashMatches: version.hashMatches,
  }));
}

/** 서식 PDF. 확정본(보관한 값)으로만 만든다 — 작성 중인 기록은 출력하지 않는다. */
@Injectable()
export class FormPdfService {
  constructor(private readonly prisma: PrismaService) {}

  /** 확정본 한 벌의 서식 모두(서식 순서대로). 방문을 볼 수 있는 사람이면 뽑는다. */
  async visitVersionPdf(
    actor: AuthenticatedUser,
    visitId: string,
    version: number,
    style: FormPdfStyle,
  ): Promise<PdfFile> {
    const row = await this.prisma.visitRecordVersion.findFirst({
      where: { visitId, version, visit: visitScope(actor) },
      include: {
        ...versionActorsArgs.include,
        visit: { select: { scheduledAt: true } },
      },
    });
    if (!row) throw new NotFoundException("확정본을 찾을 수 없습니다");
    const records = toPdfRecords(
      toVisitRecordVersionDetail(row),
      row.visit.scheduledAt,
    );
    const first = records[0];
    const name = first
      ? `${first.header.recipient.name}_${first.visitDate}_${row.version}차`
      : `방문기록_${row.version}차`;
    return {
      bytes: await buildVisitPdf(records, style, name),
      filename: `${name}.pdf`,
    };
  }

  /**
   * 제7호 월간 기록지: 수급자의 그 달 확정된 간호사 방문(제7호가 있는 방문)의 지금 확정본을
   * 날짜순으로. 다른 직원의 방문도 들어가므로 기관 관리자·운영자만 뽑는다(컨트롤러 @Roles).
   */
  async nurseMonthPdf(
    actor: AuthenticatedUser,
    recipientId: string,
    month: string,
  ): Promise<PdfFile> {
    const recipient = await this.prisma.recipient.findFirst({
      where: {
        id: recipientId,
        organizationId: resolveOrganizationFilter(actor),
      },
      select: { name: true },
    });
    if (!recipient) throw new NotFoundException("수급자를 찾을 수 없습니다");

    const visits = await this.prisma.visit.findMany({
      where: {
        recipientId,
        status: "CONFIRMED",
        formIds: { has: "HOME_CARE_NURSE" },
        scheduledAt: {
          gte: kstStartOfDay(`${month}-01`),
          lt: kstStartOfDay(`${addMonths(month, 1)}-01`),
        },
      },
      select: {
        scheduledAt: true,
        // 되돌리지 않은 확정본이 지금 확정본이다.
        versions: { where: { reopenedAt: null }, ...versionActorsArgs },
      },
      orderBy: { scheduledAt: "asc" },
    });
    const records = visits
      .flatMap((visit) =>
        visit.versions.flatMap((row) =>
          toPdfRecords(
            toVisitRecordVersionDetail(row),
            visit.scheduledAt,
          ).filter((record) => record.formId === "HOME_CARE_NURSE"),
        ),
      )
      .sort((a, b) =>
        (a.startedAt ?? a.visitDate).localeCompare(b.startedAt ?? b.visitDate),
      );
    if (records.length === 0) {
      throw new NotFoundException("이 달에 확정된 간호사 방문 기록이 없습니다");
    }
    const name = `${recipient.name}_${month}_제7호`;
    const altered = records.filter((record) => !record.hashMatches).length;
    const footer = `케어노트 출력 · ${formatMonthLabel(month)} 확정 방문 ${records.length}건(확정본 기준)${altered ? ` · 보관 값이 원본과 다른 방문 ${altered}건` : ""}`;
    return {
      bytes: await buildNurseMonthPdf(records, name, footer),
      filename: `${name}.pdf`,
    };
  }
}
