import {
  FORMS,
  formatDateLabel,
  formatFieldValue,
  formatSelectedOption,
  type FieldDef,
  type FormDef,
  type NumberPair,
} from "@repo/shared-types";
import { rgb, type PDFDocument, type PDFPage } from "pdf-lib";
import {
  BLACK,
  drawCheck,
  drawChoiceMark,
  drawDot,
  drawFooter,
  drawLine,
  GRAY,
  INK,
  strokeRect,
  wrapText,
  type Fonts,
  type Rect,
} from "../pdf-draw.js";
import {
  footerText,
  numberValue,
  recordTexts,
  selectedOptions,
  textValue,
  type PdfVisitRecord,
} from "../pdf-record.js";

/*
 * 표준 서식: 서식 정의(항목·선택지·순서)만으로 서식 모양의 PDF를 그린다. 원본 PDF 좌표가 필요 없어
 * 원본이 없는 서식(제14호 등)과 개정된 서식도 서식 정의만 고치면 그대로 나온다.
 * 표 모양은 원본과 같게 "1. 기본 사항"(머리) 다음에 서식 정의의 절(section)을 차례로 둔다.
 */

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { left: 45, right: 45, top: 42, bottom: 48 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const LABEL_WIDTH = 108;
const PAD = 4;
const BODY_SIZE = 8.5;
const LINE = BODY_SIZE * 1.45;
const LABEL_FILL = rgb(0.95, 0.95, 0.95);
const BAND_FILL = rgb(0.87, 0.87, 0.87);
const MARK = 7;

/** 선택지 배치: x 는 내용 칸 안 가로 위치, line 은 몇째 줄인지. */
interface PlacedOption {
  x: number;
  line: number;
  label: string;
  checked: boolean;
}

class StandardWriter {
  private page!: PDFPage;
  private y = 0;
  /** 서식 첫 장에는 제목, 이어지는 장에는 "(계속)"만 쓴다. */
  private isFirstPageOfForm = true;
  /** 숫자 짝(혈압)의 첫 칸 키 → 짝. 짝의 나머지 칸은 건너뛴다. */
  private readonly pairs: Map<string, NumberPair>;
  private readonly pairedKeys: Set<string>;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    private readonly record: PdfVisitRecord,
    private readonly form: FormDef,
  ) {
    const pairs = form.numberPairs ?? [];
    this.pairs = new Map(pairs.map((pair) => [pair.keys[0], pair]));
    this.pairedKeys = new Set(pairs.flatMap((pair) => pair.keys));
  }

  write(): void {
    this.newPage();
    this.band("1. 기본 사항");
    for (const [label, value] of this.basicRows()) this.textRow(label, value);
    this.form.sections.forEach((section, index) => {
      this.band(`${index + 2}. ${section.title}`);
      for (const field of section.fields) {
        const pair = this.pairs.get(field.key);
        if (pair) this.pairRow(pair, field);
        else if (!this.pairedKeys.has(field.key)) this.fieldRow(field);
      }
    });
  }

  private pairRow(pair: NumberPair, field: FieldDef): void {
    const [a, b] = pair.keys.map((key) => numberValue(this.record.data, key));
    const unit = field.type === "number" ? field.unit : "";
    this.textRow(
      pair.label,
      a === null && b === null ? "" : `${a ?? ""}/${b ?? ""} ${unit}`,
    );
  }

  private basicRows(): [string, string][] {
    const h = recordTexts(this.record);
    const start = h.start.text;
    const end = h.end.text;
    const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
    return [
      [
        "방문일",
        join(
          `${this.record.visitDate.slice(0, 4)}년 ${formatDateLabel(this.record.visitDate)}`,
          start || end ? `${start} ~ ${end}` : "",
        ),
      ],
      ["기관", join(h.orgName, h.orgCode && `기관기호 ${h.orgCode}`)],
      [
        "수급자",
        join(
          h.recipientName,
          h.birthDate && `생년월일 ${h.birthDate}`,
          h.careGrade,
          h.ltcCertNumber && `장기요양인정번호 ${h.ltcCertNumber}`,
        ),
      ],
      ["주소", h.address],
      [
        "담당자",
        join(
          h.staffName,
          h.profession,
          h.licenseNumber && `면허(자격)번호 ${h.licenseNumber}`,
        ),
      ],
    ];
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = MARGIN.top;
    if (this.isFirstPageOfForm) {
      drawLine(
        this.page,
        `[${this.form.code} 서식]`,
        this.box(MARGIN.left, this.y, CONTENT_WIDTH, 10),
        {
          font: this.fonts.regular,
          size: 7.5,
          color: BLACK,
        },
      );
      drawLine(
        this.page,
        this.form.title,
        this.box(MARGIN.left, this.y + 12, CONTENT_WIDTH, 24),
        {
          font: this.fonts.semibold,
          size: 15,
          color: BLACK,
          align: "center",
        },
      );
      this.y += 44;
      this.isFirstPageOfForm = false;
    } else {
      drawLine(
        this.page,
        `${this.form.title} (계속)`,
        this.box(MARGIN.left, this.y, CONTENT_WIDTH, 12),
        {
          font: this.fonts.regular,
          size: 8,
          color: GRAY,
        },
      );
      this.y += 18;
    }
    drawFooter(
      this.page,
      this.fonts,
      this.box(MARGIN.left, PAGE.height - 30, CONTENT_WIDTH, 10),
      footerText(this.record),
    );
  }

  private box(x: number, y: number, width: number, height: number): Rect {
    return { x0: x, y0: y, x1: x + width, y1: y + height };
  }

  private ensure(height: number): void {
    if (this.y + height > PAGE.height - MARGIN.bottom) this.newPage();
  }

  private band(title: string): void {
    this.ensure(20 + LINE * 2);
    const box = this.box(MARGIN.left, this.y, CONTENT_WIDTH, 18);
    strokeRect(this.page, box, { fill: BAND_FILL });
    drawLine(
      this.page,
      title,
      { ...box, x0: box.x0 + PAD },
      {
        font: this.fonts.semibold,
        size: 9.5,
        color: BLACK,
      },
    );
    this.y += 18;
  }

  /** 라벨 칸 + 내용 칸 한 줄. draw 는 내용 칸 안쪽 좌상단에서 그린다. */
  private row(
    label: string,
    contentHeight: number,
    draw: (x: number, y: number) => void,
  ): void {
    const labelLines = wrapText(
      label,
      this.fonts.regular,
      BODY_SIZE,
      LABEL_WIDTH - PAD * 2,
    );
    const height = Math.max(contentHeight, labelLines.length * LINE) + PAD * 2;
    this.ensure(height);
    const labelBox = this.box(MARGIN.left, this.y, LABEL_WIDTH, height);
    const contentBox = this.box(
      MARGIN.left + LABEL_WIDTH,
      this.y,
      CONTENT_WIDTH - LABEL_WIDTH,
      height,
    );
    strokeRect(this.page, labelBox, { fill: LABEL_FILL });
    strokeRect(this.page, contentBox);
    const labelTop = this.y + (height - labelLines.length * LINE) / 2;
    labelLines.forEach((line, index) => {
      drawLine(
        this.page,
        line,
        this.box(
          labelBox.x0 + PAD,
          labelTop + index * LINE,
          LABEL_WIDTH - PAD * 2,
          LINE,
        ),
        {
          font: this.fonts.regular,
          size: BODY_SIZE,
          color: BLACK,
          align: "center",
        },
      );
    });
    draw(contentBox.x0 + PAD, this.y + PAD);
    this.y += height;
  }

  private textRow(label: string, value: string, multiline = false): void {
    const width = CONTENT_WIDTH - LABEL_WIDTH - PAD * 2;
    const lines = value
      ? wrapText(value, this.fonts.regular, BODY_SIZE, width)
      : [];
    const minLines = multiline ? 3 : 1;
    const height = Math.max(lines.length, minLines) * LINE;
    this.row(label, height, (x, y) => {
      lines.forEach((line, index) => {
        drawLine(this.page, line, this.box(x, y + index * LINE, width, LINE), {
          font: this.fonts.regular,
          size: BODY_SIZE,
        });
      });
    });
  }

  private fieldRow(field: FieldDef): void {
    const data = this.record.data;
    switch (field.type) {
      case "text":
        this.textRow(field.label, textValue(data, field.key), field.multiline);
        return;
      case "number":
        this.textRow(field.label, formatFieldValue(field, data[field.key]));
        return;
      default:
        this.choiceRow(field);
    }
  }

  private choiceRow(
    field: Extract<FieldDef, { type: "single" | "multi" }>,
  ): void {
    const width = CONTENT_WIDTH - LABEL_WIDTH - PAD * 2;
    const selected = new Map(
      selectedOptions(this.record.data, field.key).map((option) => [
        option.value,
        option,
      ]),
    );
    const font = this.fonts.regular;
    const placed: PlacedOption[] = [];
    let x = 0;
    let line = 0;
    for (const option of field.options) {
      const chosen = selected.get(option.value);
      // 고른 항목은 화면과 같은 글(괄호·제공 시간·메모), 안 고른 글 괄호는 빈 괄호로.
      const label = chosen
        ? formatSelectedOption(field, chosen)
        : option.detail?.kind === "text"
          ? `${option.label}(      )`
          : option.label;
      const itemWidth =
        MARK + 3 + font.widthOfTextAtSize(label, BODY_SIZE) + 10;
      if (x > 0 && x + itemWidth > width) {
        x = 0;
        line += 1;
      }
      placed.push({ x, line, label, checked: !!chosen });
      x += itemWidth;
    }
    const shape = field.type === "multi" ? "box" : "circle";
    this.row(field.label, (line + 1) * LINE, (left, top) => {
      for (const option of placed) {
        const cy = top + option.line * LINE + LINE / 2;
        const mark = { x: left + option.x + MARK / 2, y: cy };
        drawChoiceMark(this.page, mark, shape, MARK);
        if (option.checked) {
          if (shape === "box") drawCheck(this.page, mark, MARK);
          else drawDot(this.page, mark, 2.2);
        }
        drawLine(
          this.page,
          option.label,
          this.box(
            left + option.x + MARK + 3,
            top + option.line * LINE,
            width,
            LINE,
          ),
          { font, size: BODY_SIZE, color: option.checked ? INK : BLACK },
        );
      }
    });
  }
}

/** 방문 한 건의 서식 한 장(길면 여러 장)을 서식 정의로 그려 붙인다. */
export function addStandardPages(
  doc: PDFDocument,
  fonts: Fonts,
  record: PdfVisitRecord,
): void {
  new StandardWriter(doc, fonts, record, FORMS[record.formId]).write();
}
