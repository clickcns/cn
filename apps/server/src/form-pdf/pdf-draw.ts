import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { LayoutAlign, LayoutPoint, LayoutRect } from "@repo/shared-types";
import {
  PDFDocument,
  PDFHexString,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import subsetFont from "subset-font";

/*
 * 서식 PDF를 그리는 기본 도구. 좌표는 모두 **좌상단 원점, pt**다(PDF 원본에서 뽑은 좌표를
 * 그대로 쓰려고). pdf-lib 은 좌하단 원점이라 그릴 때만 뒤집는다.
 */

export const ASSETS_DIR = join(__dirname, "assets");

export type Point = LayoutPoint;

/** 좌상단(x0, y0) ~ 우하단(x1, y1) */
export type Rect = LayoutRect;

export interface Fonts {
  regular: PDFFont;
  semibold: PDFFont;
}

export const INK = rgb(0.05, 0.1, 0.35); // 손글씨처럼 원본 인쇄(검정)와 구분되는 짙은 남색
export const BLACK = rgb(0, 0, 0);
export const GRAY = rgb(0.45, 0.45, 0.45);
const WHITE = rgb(1, 1, 1);

const FONT_FILES = {
  regular: "Pretendard-Regular.ttf",
  semibold: "Pretendard-SemiBold.ttf",
} as const satisfies Record<keyof Fonts, string>;
const FONT_KEYS = Object.keys(FONT_FILES) as (keyof Fonts)[];

const fontFiles = new Map<string, Promise<Buffer>>();
function fontBytes(name: string): Promise<Buffer> {
  let bytes = fontFiles.get(name);
  if (!bytes) {
    bytes = readFile(join(ASSETS_DIR, "fonts", name));
    fontFiles.set(name, bytes);
  }
  return bytes;
}

type FontChars = Record<keyof Fonts, Set<string>>;

/** 넘친 글을 자를 때 붙이는 글자. 1차에서는 자르지 않으므로 처음부터 넣어 둔다. */
const ELLIPSIS = "…";

const emptyChars = (): FontChars => ({
  regular: new Set(),
  semibold: new Set(),
});

async function embedFonts(
  embed: (key: keyof Fonts) => Promise<PDFFont>,
): Promise<Fonts> {
  const [regular, semibold] = await Promise.all(FONT_KEYS.map(embed));
  return { regular, semibold };
}

function collect(chars: Set<string>, text: string): void {
  for (const char of text) chars.add(char);
}

/**
 * 1차용 글꼴: 그리지 않고 넘어온 글자만 모은다. 폭을 0으로 보므로 줄 나눔·글자 줄이기 없이
 * 모든 글이 그대로 넘어온다(글꼴 배치를 하지 않아 빠르다). 자리 표시로 표준 글꼴을 쓴다.
 */
function collectingFonts(doc: PDFDocument, chars: FontChars): Promise<Fonts> {
  return embedFonts(async (key) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    font.widthOfTextAtSize = (text) => {
      collect(chars[key], text);
      return 0;
    };
    font.encodeText = (text) => {
      collect(chars[key], text);
      return PDFHexString.of("");
    };
    return font;
  });
}

/**
 * 모은 글자만 담은 글꼴을 넣고, 이 글꼴로 그린 글자를 drawn 에 모은다. 부분 글꼴은
 * HarfBuzz(subset-font)로 만든다 — pdf-lib 의 자체 부분 글꼴(fontkit)은 이 글꼴의 글자를
 * 빈칸으로 만든다. 레이아웃 대체 글자(숫자 사이 hyphen.case 등)는 빼야 pdf-lib 이 너비를
 * 제대로 적는다(noLayoutClosure).
 */
function subsetFonts(
  doc: PDFDocument,
  chars: FontChars,
  drawn: FontChars,
): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  return embedFonts(async (key) => {
    const subset = await subsetFont(
      await fontBytes(FONT_FILES[key]),
      [...chars[key]].join("") || " ",
      { targetFormat: "truetype", noLayoutClosure: true },
    );
    const font = await doc.embedFont(subset);
    const encode = font.encodeText.bind(font);
    font.encodeText = (text) => {
      collect(drawn[key], text);
      return encode(text);
    };
    // 같은 글을 여러 번 잰다(칸 맞추기·줄 나누기, 제7호는 다섯 칸). 폭은 크기에 비례하므로 1pt 폭을 기억한다.
    const measure = font.widthOfTextAtSize.bind(font);
    const widths = new Map<string, number>();
    font.widthOfTextAtSize = (text, size) => {
      let width = widths.get(text);
      if (width === undefined) {
        width = measure(text, 1);
        widths.set(text, width);
      }
      return width * size;
    };
    return font;
  });
}

/**
 * 글꼴에 쓴 글자만 넣어 PDF를 만든다. 1차는 그리지 않고 글자만 모으고, 2차는 그 글자로 만든
 * 부분 글꼴로 그린다. 1차는 폭을 0으로 보므로 2차에서만 생기는 글(이어지는 장의 "(계속)" 등)이
 * 있을 수 있다. 그러면 그 글자를 더해 다시 그린다(모은 글자는 늘기만 해서 끝난다).
 */
export async function renderPdf(
  title: string,
  render: (doc: PDFDocument, fonts: Fonts) => Promise<void>,
): Promise<Uint8Array> {
  const chars = emptyChars();
  for (const key of FONT_KEYS) chars[key].add(ELLIPSIS);
  const draft = await PDFDocument.create();
  await render(draft, await collectingFonts(draft, chars));

  for (;;) {
    const doc = await PDFDocument.create();
    doc.setTitle(title, { showInWindowTitleBar: true });
    doc.setCreator("케어노트");
    doc.setProducer("케어노트");
    doc.setLanguage("ko-KR");
    const drawn = emptyChars();
    await render(doc, await subsetFonts(doc, chars, drawn));
    const missing = FONT_KEYS.filter((key) =>
      [...drawn[key]].some((char) => !chars[key].has(char)),
    );
    if (missing.length === 0) return doc.save();
    for (const key of missing) drawn[key].forEach((c) => chars[key].add(c));
  }
}

/** 좌상단 기준 y(글자 기준선)를 pdf-lib 좌표로. */
function flipY(page: PDFPage, y: number): number {
  return page.getHeight() - y;
}

export interface TextOptions {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  align?: LayoutAlign;
}

/** 한 줄 글자를 칸 안에(세로 가운데) 쓴다. 넘치면 글자 크기를 줄이고(최소 5pt), 그래도 넘치면 자른다. */
export function drawLine(
  page: PDFPage,
  text: string,
  box: Rect,
  { font, size, color = INK, align = "left" }: TextOptions,
): void {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const width = box.x1 - box.x0;
  // 폭은 글자 크기에 비례하므로 한 번 재서 들어가는 크기(0.25pt 단위)를 바로 구한다.
  const measured = font.widthOfTextAtSize(clean, size);
  const fontSize =
    measured <= width
      ? size
      : Math.max(5, Math.floor(((size * width) / measured) * 4) / 4);
  let fitted = clean;
  let textWidth = (measured * fontSize) / size;
  if (textWidth > width) {
    fitted = fitWidth(clean, font, fontSize, width);
    textWidth = font.widthOfTextAtSize(fitted, fontSize);
  }
  const x =
    align === "right"
      ? box.x1 - textWidth
      : align === "center"
        ? box.x0 + (width - textWidth) / 2
        : box.x0;
  const baseline = (box.y0 + box.y1) / 2 + fontSize * 0.36;
  page.drawText(fitted, {
    x,
    y: flipY(page, baseline),
    size: fontSize,
    font,
    color,
  });
}

/** 출력 표시(쪽 아래 작은 회색 글). */
export function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  box: Rect,
  text: string,
): void {
  drawLine(page, text, box, { font: fonts.regular, size: 6.5, color: GRAY });
}

/** 굵게면 SemiBold, 아니면 Regular. */
export function fontOf(fonts: Fonts, bold: boolean): PDFFont {
  return bold ? fonts.semibold : fonts.regular;
}

/** 너비 안에 들어가게 뒤를 잘라 "…"(ELLIPSIS)을 붙인다. */
function fitWidth(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let end = text.length;
  while (
    end > 0 &&
    font.widthOfTextAtSize(text.slice(0, end) + ELLIPSIS, size) > width
  ) {
    end -= 1;
  }
  return text.slice(0, end) + ELLIPSIS;
}

/** 여러 줄로 나눈다. 한글은 어디서나 끊을 수 있어 글자 단위로, 공백이 있으면 공백에서 끊는다. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    let lastSpace = -1;
    for (const char of paragraph) {
      const next = line + char;
      if (font.widthOfTextAtSize(next, size) <= width || line === "") {
        line = next;
        if (char === " ") lastSpace = line.length - 1;
        continue;
      }
      if (lastSpace > 0 && char !== " ") {
        lines.push(line.slice(0, lastSpace));
        line = line.slice(lastSpace + 1) + char;
      } else {
        lines.push(line.trimEnd());
        line = char === " " ? "" : char;
      }
      lastSpace = line.lastIndexOf(" ");
    }
    lines.push(line);
  }
  return lines;
}

/**
 * 여러 줄 글을 칸 안에 쓴다(위에서부터). 칸에 다 들어가게 글자 크기를 줄이고(최소 5pt),
 * 그래도 넘치면 마지막 줄을 "…"로 끝낸다.
 */
export function drawParagraph(
  page: PDFPage,
  text: string,
  box: Rect,
  { font, size, color = INK }: TextOptions,
): void {
  const lineGap = 1.25;
  const clean = text.trim();
  if (!clean) return;
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  const wrapAt = (fontSize: number) => wrapText(clean, font, fontSize, width);
  const fits = (fontSize: number) =>
    wrapAt(fontSize).length * fontSize * lineGap <= height;
  // 들어가는 가장 큰 크기를 size 에서 0.25pt씩 줄인 값 중에서 찾는다. 줄 나누기가 비싸 반씩 좁힌다.
  let steps = 0;
  if (!fits(size)) {
    let lo = 1;
    let hi = Math.max(0, Math.floor((size - 5) / 0.25));
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (fits(size - mid * 0.25)) hi = mid;
      else lo = mid + 1;
    }
    steps = hi;
  }
  const fontSize = size - steps * 0.25;
  let lines = wrapAt(fontSize);
  const maxLines = Math.max(1, Math.floor(height / (fontSize * lineGap)));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = fitWidth(
      lines[maxLines - 1] + ELLIPSIS,
      font,
      fontSize,
      width,
    );
  }
  lines.forEach((line, index) => {
    const baseline = box.y0 + fontSize * (0.95 + index * lineGap);
    page.drawText(line, {
      x: box.x0,
      y: flipY(page, baseline),
      size: fontSize,
      font,
      color,
    });
  });
}

/** □ 안에 체크(✓)를 그린다. 글꼴과 상관없이 선으로 그린다. */
export function drawCheck(page: PDFPage, at: Point, size = 7): void {
  const s = size / 2;
  const p = (dx: number, dy: number) => ({
    x: at.x + dx,
    y: flipY(page, at.y + dy),
  });
  const thickness = size * 0.17;
  page.drawLine({
    start: p(-s * 0.75, -s * 0.05),
    end: p(-s * 0.2, s * 0.55),
    thickness,
    color: INK,
  });
  page.drawLine({
    start: p(-s * 0.2, s * 0.55),
    end: p(s * 0.85, -s * 0.8),
    thickness,
    color: INK,
  });
}

/** ○ 안을 채운다(●). */
export function drawDot(page: PDFPage, at: Point, radius = 2.4): void {
  page.drawCircle({ x: at.x, y: flipY(page, at.y), size: radius, color: INK });
}

/** 글자 둘레에 동그라미(제7호 "증/감"처럼 고르는 글자). */
export function drawRing(page: PDFPage, at: Point, radius = 4.2): void {
  page.drawEllipse({
    x: at.x,
    y: flipY(page, at.y),
    xScale: radius,
    yScale: radius * 0.85,
    borderColor: INK,
    borderWidth: 0.8,
  });
}

/** 칸을 흰색으로 덮는다(원본의 쪽 번호·내려받기 표시, 다시 쓸 단위 글자). */
export function cover(page: PDFPage, box: Rect): void {
  page.drawRectangle({
    x: box.x0,
    y: flipY(page, box.y1),
    width: box.x1 - box.x0,
    height: box.y1 - box.y0,
    color: WHITE,
  });
}

/** 네모 테두리(표준 서식의 표). */
export function strokeRect(
  page: PDFPage,
  box: Rect,
  { fill }: { fill?: ReturnType<typeof rgb> } = {},
): void {
  page.drawRectangle({
    x: box.x0,
    y: flipY(page, box.y1),
    width: box.x1 - box.x0,
    height: box.y1 - box.y0,
    borderColor: BLACK,
    borderWidth: 0.6,
    color: fill,
  });
}

/** 빈 □ 또는 ○ 를 그린다(표준 서식의 선택지). */
export function drawChoiceMark(
  page: PDFPage,
  at: Point,
  shape: "box" | "circle",
  size = 7,
): void {
  if (shape === "box") {
    page.drawRectangle({
      x: at.x - size / 2,
      y: flipY(page, at.y + size / 2),
      width: size,
      height: size,
      borderColor: BLACK,
      borderWidth: 0.6,
    });
  } else {
    page.drawCircle({
      x: at.x,
      y: flipY(page, at.y),
      size: size / 2,
      borderColor: BLACK,
      borderWidth: 0.6,
    });
  }
}
