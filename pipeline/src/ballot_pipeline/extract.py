"""Read INEC's candidate-list PDFs into rows, keeping page and serial number for provenance (D-004).

The lists are born-digital pdfmake tables with ruling lines. A page carries:
  * a diagonal "INEC" watermark drawn as four giant glyphs (font size > 200), which we drop by size;
  * the title (14pt) and signature block outside the table, which table detection ignores;
  * one table whose first row repeats the column headers.
Ticket races (President) put the principal and the running mate in one table row; the POSITION column
says "Presidential" then "Vice-Presidential", and we split the row at the y of the "Vice" word.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import pdfplumber

EXTRACTOR_VERSION = 5  # bump when output for the same PDF changes; invalidates the build cache
MAX_TEXT_SIZE = 12  # table text is 9-10pt, title 14pt, watermark glyphs 270-345pt

HEADER_FIELDS = {
    "SN": "sn",
    "STATE": "state",
    "CONSTITUENCY": "constituency",
    "POSITION": "position",
    "NAME OF CANDIDATE": "name",
    "PARTY": "party",
    "PWD": "pwd",
    "AGE": "age",
    "GENDER": "gender",
    "QUALIFICATION(S)": "qualifications",
    "REMARKS": "remarks",
}


class ExtractionError(Exception):
    pass


@dataclass
class Person:
    name: str
    pwd: str
    age: str
    gender: str
    qualifications: str
    position: str = ""


def normalise_state(text: str) -> str:
    """INEC prints some states in mixed case ("CROSS River"); state names are structural, so compare upper-case."""
    return re.sub(r"\s+", " ", text).strip().upper()


@dataclass
class Row:
    source_id: str
    page: int  # 1-based
    sn: int
    state: str
    constituency: str
    party: str
    remarks: str
    candidate: Person
    running_mate: Person | None = None
    notes: list[str] = field(default_factory=list)


def _clean(text: str | None) -> str:
    """Join wrapped lines with a space and collapse whitespace. The words themselves are kept verbatim."""
    return re.sub(r"\s+", " ", (text or "").replace("\n", " ")).strip()


def _text_pages(path: str):
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            yield i, page.filter(lambda o: o.get("object_type") != "char" or o.get("size", 0) <= MAX_TEXT_SIZE)


def _header_map(cells: list[str]) -> list[str | None]:
    out = []
    for c in cells:
        key = _clean(c).upper()
        out.append(HEADER_FIELDS.get(key))
    if "sn" not in out or "name" not in out or "party" not in out:
        raise ExtractionError(f"unrecognised header row: {cells}")
    return out


class _Words:
    """All words on a page, extracted once; cells are filled by word-centre containment (fast, no cropping)."""

    def __init__(self, page):
        self.words = page.extract_words(keep_blank_chars=False, use_text_flow=False)

    def in_box(self, x0, top, x1, bottom):
        return [w for w in self.words
                if x0 <= (w["x0"] + w["x1"]) / 2 <= x1 and top <= (w["top"] + w["bottom"]) / 2 <= bottom]

    def text(self, bbox, y_range=None) -> str:
        if bbox is None:
            return ""
        x0, top, x1, bottom = bbox
        if y_range:
            top, bottom = max(top, y_range[0]), min(bottom, y_range[1])
            if bottom <= top:
                return ""
        ws = sorted(self.in_box(x0, top, x1, bottom), key=lambda w: (w["top"], w["x0"]))
        lines: list[list[dict]] = []
        for w in ws:
            if lines and abs(lines[-1][0]["top"] - w["top"]) < 3:
                lines[-1].append(w)
            else:
                lines.append([w])
        out = ""
        for ln in lines:
            part = " ".join(x["text"] for x in sorted(ln, key=lambda w: w["x0"]))
            # A cell wrapped after "/" or "-" ("Yola South/" + "Girei") is one token: rejoin without a space.
            out = out + part if out.endswith(("/", "-")) or not out else out + " " + part
        return _clean(out)



def _inner_split_y(page, bbox) -> float | None:
    """y of the ruling line pdfmake draws inside a ticket cell between principal and running mate.

    Each column has its own inner line (their heights differ when one half wraps), so this is per cell.
    """
    x0, top, x1, bottom = bbox
    ys = sorted({round(ln["top"], 1) for ln in page.lines
                 if abs(ln["top"] - ln["bottom"]) < 1 and top + 2 < ln["top"] < bottom - 2
                 and ln["x0"] < x1 - 2 and ln["x1"] > x0 + 2})
    if len(ys) > 1:
        raise ExtractionError(f"ticket cell {bbox} has {len(ys)} inner lines")
    return ys[0] if ys else None


def extract_pdf(path: str, source_id: str, ticket: bool = False) -> list[Row]:
    rows: list[Row] = []
    for page_no, page in _text_pages(path):
        tables = page.find_tables()
        if not tables:
            continue
        if len(tables) != 1:
            raise ExtractionError(f"{source_id} p{page_no}: expected 1 table, found {len(tables)}")
        table = tables[0]
        words = _Words(page)
        fields: list[str | None] | None = None
        for trow in table.rows:
            texts = [words.text(c) for c in trow.cells]
            if fields is None:
                fields = _header_map(texts)
                continue
            rec = {f: t for f, t in zip(fields, texts) if f}
            for f in ("party", "age"):  # letter-spaced cells ("S D P", "3 4") are one token, as poppler reads them
                if rec.get(f) and re.fullmatch(r"(\S )+\S", rec[f]):
                    rec[f] = rec[f].replace(" ", "")
            if not rec.get("sn"):
                # pdfmake let a row break across a page: append the continuation to the previous row.
                if rows and any(rec.values()):
                    raise ExtractionError(f"{source_id} p{page_no}: row without SN (split row?) {rec}")
                continue
            if not rec["sn"].isdigit():
                raise ExtractionError(f"{source_id} p{page_no}: non-numeric SN {rec['sn']!r}")

            if ticket:
                top, bottom = trow.bbox[1], trow.bbox[3]
                halves: list[dict[str, str]] = [{}, {}]
                for f, cell in zip(fields, trow.cells):
                    if not f or cell is None:
                        continue
                    split = _inner_split_y(page, cell)
                    if split is None:
                        if f not in ("sn", "party"):
                            raise ExtractionError(f"{source_id} p{page_no} SN {rec['sn']}: no inner line in {f} column")
                        continue
                    halves[0][f] = words.text(cell, (top, split))
                    halves[1][f] = words.text(cell, (split, bottom))
                if not halves[1].get("position", "").lower().startswith(("vice", "deputy")):
                    raise ExtractionError(f"{source_id} p{page_no} SN {rec['sn']}: second half is not a Vice or Deputy position")
                people = [Person(h["name"], h["pwd"], h["age"], h["gender"], h["qualifications"], h["position"]) for h in halves]
                remarks = " / ".join(dict.fromkeys(r for r in (halves[0]["remarks"], halves[1]["remarks"]) if r))
                rows.append(Row(source_id, page_no, int(rec["sn"]), normalise_state(halves[0]["state"]), "",
                                rec["party"], remarks, people[0], people[1]))
            else:
                cand = Person(rec["name"], rec.get("pwd", ""), rec.get("age", ""), rec.get("gender", ""),
                              rec.get("qualifications", ""))
                rows.append(Row(source_id, page_no, int(rec["sn"]), normalise_state(rec.get("state", "")), rec.get("constituency", ""),
                                rec["party"], rec.get("remarks", ""), cand))
        if fields is None:
            raise ExtractionError(f"{source_id} p{page_no}: table without header row")
    return rows


def count_sn_independently(path: str) -> list[int]:
    """Second, independent count: serial numbers as `pdftotext -layout` sees them at the start of a line.

    Uses poppler instead of pdfplumber, so a bug in one extractor shows up as disagreement.
    """
    import subprocess

    out = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True, check=True).stdout
    sns = []
    for line in out.splitlines():
        # pdfmake may centre the serial number on a line that holds only the party acronym ("5   …   ADP")
        m = re.match(r"^\s{0,6}(\d{1,4})\s+(?=[A-Z])", line)
        if m:
            sns.append(int(m.group(1)))
    return sns
