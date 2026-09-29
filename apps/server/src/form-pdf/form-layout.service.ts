import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  cleanLayoutAdjustments,
  EMPTY_LAYOUT_ADJUSTMENTS,
  FORMS_WITH_ORIGINAL_PDF,
  FormLayoutAdjustmentsSchema,
  hasOriginalPdf,
  type FormId,
  type FormLayoutAdjustments,
  type FormLayoutDetail,
  type FormLayoutSummary,
  type OriginalPdfFormId,
  type SaveFormLayoutSchema,
} from "@repo/shared-types";
import type { z } from "zod";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { handlePrismaError, PrismaService } from "../prisma/index.js";
import {
  buildLayoutPreviewPdf,
  type LayoutAdjustmentsByForm,
} from "./build.js";
import { describeLayout } from "./overlay/describe.js";
import { templatePageSize } from "./overlay/render.js";

const rowArgs = {
  include: { updatedBy: { select: { id: true, name: true } } },
} as const;

interface LayoutRow {
  formId: string;
  adjustments: unknown;
  updatedAt: Date;
  updatedBy: { id: string; name: string };
}

const STALE_MESSAGE =
  "그사이 다른 운영자가 이 서식의 조정을 저장했습니다. 다시 불러온 뒤 고쳐 주세요.";

/** 저장한 값(JSON)을 조정으로 읽는다. 지금 없는 칸 ID(자리 선언이 바뀐 경우)는 뺀다. */
function readAdjustments(
  formId: OriginalPdfFormId,
  value: unknown,
): FormLayoutAdjustments {
  const parsed = FormLayoutAdjustmentsSchema.safeParse(value);
  if (!parsed.success) return EMPTY_LAYOUT_ADJUSTMENTS;
  const { ids } = describeLayout(formId);
  return {
    ...parsed.data,
    items: Object.fromEntries(
      Object.entries(parsed.data.items).filter(([id]) => ids.has(id)),
    ),
  };
}

function toSummary(
  formId: OriginalPdfFormId,
  row: LayoutRow | null,
  adjustments: FormLayoutAdjustments,
): FormLayoutSummary {
  return {
    formId,
    adjustedCount: Object.keys(adjustments.items).length,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

/**
 * 원본 서식 조정: 운영자가 서식마다 칸 자리·글자 모양을 조정해 저장하면 모든 기관의 원본 서식 PDF에
 * 적용한다. 확정본 PDF는 볼 때마다 그리므로 이전 확정본도 새 자리로 나온다(기록 값·hash와 무관).
 */
@Injectable()
export class FormLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  /** 원본 서식이 있는 서식 ID인지 확인한다(아니면 404). */
  private formIdOf(value: string): OriginalPdfFormId {
    if (!hasOriginalPdf(value as FormId)) {
      throw new NotFoundException("원본 서식이 없는 서식입니다");
    }
    return value as OriginalPdfFormId;
  }

  /** PDF를 그릴 때 쓰는 서식별 조정(원본 서식은 4개라 모두 읽는다). */
  async allAdjustments(): Promise<LayoutAdjustmentsByForm> {
    const rows = await this.prisma.formLayoutAdjustment.findMany({
      select: { formId: true, adjustments: true },
    });
    return Object.fromEntries(
      rows
        .filter((row) => hasOriginalPdf(row.formId as FormId))
        .map((row) => {
          const formId = row.formId as OriginalPdfFormId;
          return [formId, readAdjustments(formId, row.adjustments)];
        }),
    );
  }

  async list(): Promise<FormLayoutSummary[]> {
    const rows = await this.prisma.formLayoutAdjustment.findMany(rowArgs);
    return FORMS_WITH_ORIGINAL_PDF.map((formId) => {
      const row = rows.find((r) => r.formId === formId) ?? null;
      return toSummary(
        formId,
        row,
        row
          ? readAdjustments(formId, row.adjustments)
          : EMPTY_LAYOUT_ADJUSTMENTS,
      );
    });
  }

  async detail(value: string): Promise<FormLayoutDetail> {
    const formId = this.formIdOf(value);
    const row = await this.prisma.formLayoutAdjustment.findUnique({
      where: { formId },
      ...rowArgs,
    });
    return this.toDetail(formId, row);
  }

  /** 저장한다. 화면이 불러온 뒤 다른 운영자가 저장했으면 409. */
  async save(
    actor: AuthenticatedUser,
    value: string,
    dto: z.output<typeof SaveFormLayoutSchema>,
  ): Promise<FormLayoutDetail> {
    const formId = this.formIdOf(value);
    const { ids } = describeLayout(formId);
    const unknown = Object.keys(dto.adjustments.items).filter(
      (id) => !ids.has(id),
    );
    if (unknown.length > 0) {
      throw new BadRequestException(
        `이 서식에 없는 칸입니다: ${unknown.slice(0, 3).join(", ")}`,
      );
    }
    const data = {
      adjustments: cleanLayoutAdjustments(dto.adjustments),
      updatedById: actor.id,
    };
    try {
      const row =
        dto.expectedUpdatedAt === null
          ? await this.prisma.formLayoutAdjustment.create({
              data: { formId, ...data },
              ...rowArgs,
            })
          : await this.prisma.formLayoutAdjustment.update({
              where: { formId, updatedAt: new Date(dto.expectedUpdatedAt) },
              data,
              ...rowArgs,
            });
      return await this.toDetail(formId, row);
    } catch (error) {
      handlePrismaError(error, {
        conflict: STALE_MESSAGE,
        staleWrite: STALE_MESSAGE,
      });
    }
  }

  /** 조정을 지워 기본 자리로 되돌린다. */
  async reset(value: string): Promise<FormLayoutDetail> {
    const formId = this.formIdOf(value);
    await this.prisma.formLayoutAdjustment.deleteMany({ where: { formId } });
    return this.toDetail(formId, null);
  }

  /** 저장하지 않은 조정으로 표본 PDF를 그린다. */
  preview(
    value: string,
    adjustments: FormLayoutAdjustments,
  ): Promise<Uint8Array> {
    return buildLayoutPreviewPdf(this.formIdOf(value), adjustments);
  }

  private async toDetail(
    formId: OriginalPdfFormId,
    row: LayoutRow | null,
  ): Promise<FormLayoutDetail> {
    const adjustments = row
      ? readAdjustments(formId, row.adjustments)
      : EMPTY_LAYOUT_ADJUSTMENTS;
    const { items, repeatOffsets } = describeLayout(formId);
    return {
      ...toSummary(formId, row, adjustments),
      page: await templatePageSize(formId),
      items,
      repeatOffsets,
      adjustments,
    };
  }
}
