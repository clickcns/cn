"""
원본 서식 PDF에서 좌표를 뽑아 원본 위에 채우는 자리(src/form-pdf/overlay)의 초안을 만든다.

  # 1) 서식 정의를 JSON으로
  pnpm --filter @repo/server exec tsx scripts/form-def-json.ts HOME_CARE_DOCTOR > def.json
  # 2) 좌표 초안(선택지마다 □/○ 가운데와 괄호 칸)
  python scripts/form-pdf-coords.py 원본.pdf --def def.json
  # 좌표만 보기(글자·□/○·표 선)
  python scripts/form-pdf-coords.py 원본.pdf --dump

글자층이 있는 PDF(HWP에서 PDF로 저장한 것 등)는 선택지 이름을 찾아 바로 왼쪽의 □/○를
붙인다. 찾지 못한 선택지는 "TODO"로 남긴다. 글자가 윤곽선(도형)인 PDF는 글자를 읽을 수 없어
--dump 로 □(작은 네모 선)·○(작은 곡선)의 위치만 보여 준다. 초안은 반드시 미리보기
(scripts/form-pdf-preview.ts)로 눈으로 확인한 뒤 layouts.ts 에 옮긴다.
필요: pip install pymupdf
"""
import argparse
import json
import re
from collections import defaultdict

import fitz

MARKS = {"□": "box", "☐": "box", "○": "circle", "◯": "circle"}


def page_chars(page):
    """글자마다 (문자, x0, x1, 가운데 y). 좌상단 원점, pt."""
    chars = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                for ch in span["chars"]:
                    x0, y0, x1, y1 = ch["bbox"]
                    chars.append((ch["c"], x0, x1, (y0 + y1) / 2))
    return chars


def lines_of(chars, tolerance=2.5):
    """가운데 y가 가까운 글자끼리 한 줄로(x 순)."""
    rows = []
    for c in sorted(chars, key=lambda c: (c[3], c[1])):
        for row in rows:
            if abs(row["y"] - c[3]) <= tolerance:
                row["chars"].append(c)
                break
        else:
            rows.append({"y": c[3], "chars": [c]})
    for row in rows:
        row["chars"].sort(key=lambda c: c[1])
    return rows


def outline_marks(page):
    """윤곽선 글자 PDF: 작은 네모 선(□)·작은 곡선 원(○)을 도형 크기로 찾는다."""
    found = defaultdict(list)
    for d in page.get_drawings():
        r = d["rect"]
        kinds = "".join(sorted({i[0] for i in d["items"]}))
        if not (5 <= r.width <= 9 and 5 <= r.height <= 9 and abs(r.width - r.height) < 0.5):
            continue
        shape = "box" if kinds in ("l", "re") else "circle" if kinds == "c" else None
        if shape:
            found[(shape, round(r.width, 1))].append((round(r.x0 + r.width / 2, 1), round(r.y0 + r.height / 2, 1)))
    return found


def dump(page):
    chars = page_chars(page)
    print(f"# page {page.rect.width:.1f} x {page.rect.height:.1f} (좌상단 원점, pt)")
    if chars:
        print("\n# 글자 줄 (y: x=글자)")
        for row in lines_of(chars):
            text = "".join(c[0] for c in row["chars"])
            print(f"y {row['y']:6.1f} | x {row['chars'][0][1]:6.1f} | {text}")
        print("\n# □/○ 가운데")
        for c in chars:
            if c[0] in MARKS:
                print(f"{MARKS[c[0]]:6} ({(c[1] + c[2]) / 2:.1f}, {c[3]:.1f})")
    else:
        print("\n# 글자층이 없다(윤곽선 글자). 크기별 □/○ 후보:")
        for (shape, size), points in sorted(outline_marks(page).items()):
            print(f"{shape} {size}pt: {len(points)}개")
            for x, y in sorted(points, key=lambda p: (p[1], p[0])):
                print(f"   ({x}, {y})")
    print("\n# 표 가로선 (y: x0-x1)")
    hs = set()
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l" and abs(item[1].y - item[2].y) < 0.5 and abs(item[1].x - item[2].x) > 25:
                hs.add((round(item[1].y, 1), round(min(item[1].x, item[2].x)), round(max(item[1].x, item[2].x))))
    for y, x0, x1 in sorted(hs):
        print(f"{y:6.1f}: {x0}-{x1}")


def normalize(text):
    return re.sub(r"\s+", "", text)


def draft(page, definition):
    rows = lines_of(page_chars(page))
    # 줄마다 공백을 뺀 글자열과 각 글자의 위치
    flat = []
    for row in rows:
        kept = [c for c in row["chars"] if not c[0].isspace()]
        flat.append((row, "".join(c[0] for c in kept), kept))
    used = set()

    def find_option(label):
        target = normalize(label)
        for row, text, kept in flat:
            start = text.find(target)
            while start >= 0:
                key = (row["y"], start)
                if key not in used:
                    marks = [c for c in kept[:start] if c[0] in MARKS]
                    if marks and kept[start][1] - marks[-1][2] < 20:
                        used.add(key)
                        mark = marks[-1]
                        after = kept[start + len(target):]
                        return mark, row["y"], after
                start = text.find(target, start + 1)
        return None

    out = [f"// {definition['formId']} 초안 — 미리보기로 확인한 뒤 layouts.ts 에 옮긴다", "fields: {"]
    for field in definition["fields"]:
        if not field["options"]:
            out.append(f"  {field['key']}: {{ kind: \"{field['type']}\", box: rect(0, 0, 0, 0) }}, // TODO {field['label']}")
            continue
        out.append(f"  {field['key']}: {{")
        out.append('    kind: "options",')
        out.append("    options: {")
        for option in field["options"]:
            hit = find_option(option["label"])
            if not hit:
                out.append(f"      {option['value']}: box(0, 0), // TODO 찾지 못함: {option['label']}")
                continue
            mark, y, after = hit
            fn = MARKS[mark[0]]
            cx = (mark[1] + mark[2]) / 2
            detail = ""
            if option["detail"]:
                opening = next((c for c in after if c[0] == "("), None)
                closing = next((c for c in after if c[0] == ")"), None)
                if opening and closing:
                    detail = f", rect({opening[2] + 2:.1f}, {y - 6:.1f}, {closing[1] - 2:.1f}, {y + 6:.1f})"
                else:
                    detail = ", rect(0, 0, 0, 0) /* TODO 괄호 */"
            out.append(f"      {option['value']}: {fn}({cx:.1f}, {mark[3]:.1f}{detail}),")
        out.append("    },")
        out.append("  },")
    out.append("},")
    print("\n".join(out))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--def", dest="definition", help="form-def-json.ts 출력")
    parser.add_argument("--dump", action="store_true")
    parser.add_argument("--page", type=int, default=0)
    args = parser.parse_args()
    page = fitz.open(args.pdf)[args.page]
    if args.dump or not args.definition:
        dump(page)
    if args.definition:
        with open(args.definition, encoding="utf-8") as f:
            draft(page, json.load(f))


if __name__ == "__main__":
    main()
