"""Political geography: polling units (INEC locator) and constituency composition (INEC workbook), joined at ward level.

polling unit -> ward -> LGA -> federal constituency(ies) and senatorial district.
A ward resolves to more than one federal constituency only inside the five LGAs that INEC's workbook splits into
"I"/"II" constituencies without naming wards (OI-9). Those are listed explicitly; everything else must be exactly one.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import xlrd

from .crawl_pu import parse_options, parse_states
from .paths import PU_RAW_DIR
from .states import STATE_NAMES

WORKBOOK_STATE_SUFFIX = {
    "AB": "ABIA", "AD": "ADAMAWA", "AK": "AKWA IBOM", "AN": "ANAMBRA", "BA": "BAUCHI", "BY": "BAYELSA",
    "BN": "BENUE", "BO": "BORNO", "CR": "CROSS RIVER", "DT": "DELTA", "EB": "EBONYI", "ED": "EDO",
    "EK": "EKITI", "EN": "ENUGU", "FCT": "FCT", "GM": "GOMBE", "IM": "IMO", "JG": "JIGAWA",
    "KD": "KADUNA", "KN": "KANO", "KT": "KATSINA", "KB": "KEBBI", "KG": "KOGI", "KW": "KWARA",
    "LA": "LAGOS", "NW": "NASARAWA", "NG": "NIGER", "OG": "OGUN", "OD": "ONDO", "OS": "OSUN",
    "OY": "OYO", "PL": "PLATEAU", "RV": "RIVERS", "SO": "SOKOTO", "TR": "TARABA", "YB": "YOBE", "ZF": "ZAMFARA",
}
assert set(WORKBOOK_STATE_SUFFIX.values()) == STATE_NAMES

CODE_RE = re.compile(r"^(SD|FC)/(\d{3})/([A-Z]{2,3})$")


def key(text: str) -> str:
    """Comparison key: uppercase letters and digits only."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


class GeoError(Exception):
    pass


@dataclass
class WorkbookUnit:
    kind: str  # "SD" or "FC"
    code: str
    state: str
    name: str
    composition: str
    row: int  # 1-based spreadsheet row, for provenance
    lgas: list[str] = field(default_factory=list)  # locator LGA names
    split_lga: str | None = None  # set when composition is "Part of <LGA>"
    resolved_by: str = ""  # override | split | composition | name
    unread_composition: list[str] = field(default_factory=list)  # fragments left when the name was used instead


def read_workbook(path: str) -> list[WorkbookUnit]:
    book = xlrd.open_workbook(path)
    units: list[WorkbookUnit] = []
    for sheet_name, kind in (("SEN. DIST.", "SD"), ("FED. CONST.", "FC")):
        sheet = book.sheet_by_name(sheet_name)
        for r in range(sheet.nrows):
            cells = [str(c.value).strip() for c in sheet.row(r)]
            if len(cells) < 4:
                continue
            m = CODE_RE.match(cells[2].replace(" ", ""))
            if not m:
                continue
            if m.group(1) != kind:
                raise GeoError(f"{sheet_name} row {r + 1}: code {cells[2]} in wrong sheet")
            state = WORKBOOK_STATE_SUFFIX[m.group(3)]
            units.append(WorkbookUnit(kind, cells[2].replace(" ", ""), state, re.sub(r"\s+", " ", cells[1]).strip(),
                                      re.sub(r"\s+", " ", cells[3]).strip(), r + 1))
    return units


# ---------------------------------------------------------------- locator


@dataclass
class LocatorLga:
    state_code: str
    code: str
    name: str
    wards: list[tuple[str, str, list[tuple[str, str]]]]  # (ward code, ward name, [(pu code, pu name)])


def _split_label(label: str, digits: int) -> tuple[str, str]:
    m = re.match(rf"^\s*(\d{{{digits}}})\s*-\s*(.*)$", label, re.S)
    if not m:
        raise GeoError(f"locator label without a {digits}-digit code: {label!r}")
    return m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()


def read_locator() -> dict[str, tuple[str, list[LocatorLga]]]:
    """``{state_name: (state_code, [LocatorLga])}`` from the cached crawl. Raises if any response is missing."""
    states = parse_states((PU_RAW_DIR / "locator.html").read_text(encoding="utf-8", errors="replace"))
    out: dict[str, tuple[str, list[LocatorLga]]] = {}

    def load(kind: str, parent: str):
        p = PU_RAW_DIR / kind / f"{parent}.json"
        if not p.exists():
            raise GeoError(f"polling-unit crawl incomplete: missing {kind}/{parent}.json (run `crawl-pu`)")
        return parse_options(json.loads(p.read_bytes()))

    for s_id, s_label in states:
        s_code, s_name = _split_label(s_label, 2)
        if s_name not in STATE_NAMES:
            raise GeoError(f"unknown state in locator: {s_label!r}")
        lgas = []
        for l_id, l_label in load("lgas", s_id):
            l_code, l_name = _split_label(l_label, 2)
            wards = []
            for w_id, w_label in load("wards", l_id):
                w_code, w_name = _split_label(w_label, 2)
                pus = [_split_label(p_label, 3) for _, p_label in load("pus", w_id)]
                wards.append((w_code, w_name, pus))
            lgas.append(LocatorLga(s_code, l_code, l_name, wards))
        out[s_name] = (s_code, lgas)
    return out


# ---------------------------------------------------------------- composition

FILLER = re.compile(
    r"THE\s*ENTIRE\s*GEOGRAPHICAL\s*AREAS?\s*OF|THE\s*\w+\s*GEOGRAPHICAL\s*AREAS?\s*OF|\bTHE\s*PRESENT|"
    r"L\.?\s*G\.?\s*[AS]\.?\s*S?\.?(?=\W|$)|\bL\.A\.AS\b|\bLGAS?\b|AREA\s*COUNCILS?",
)
DIRECTIONS = r"(NORTH\s*EAST|NORTH\s*WEST|SOUTH\s*EAST|SOUTH\s*WEST|NORTH|SOUTH|EAST|WEST|CENTRAL)"


def fragments(text: str) -> list[str]:
    """Split workbook composition text into candidate LGA names.

    "Isiala Ngwa North and South L.G.As" -> ["ISIALA NGWA NORTH", "ISIALA NGWA SOUTH"].
    Slashes are kept: some LGA names contain one ("Askira/Uba"), so `match_fragments` tries joined neighbours first.
    """
    t = FILLER.sub(" ", text.upper())
    t = re.sub(rf"\b([A-Z][A-Z\- ]*?)\s+{DIRECTIONS}\s+AND\s+{DIRECTIONS}\b", r"\1 \2, \1 \3", t)
    parts = re.split(r",|&|\bAND\b|/", t)
    return [re.sub(r"\s+", " ", p).strip(" .-") for p in parts if key(p)]


def _lga_keys(lga_names: list[str]) -> dict[str, str]:
    out = {}
    for n in lga_names:
        out[key(n)] = n
        out.setdefault(key(re.sub(r"\(.*?\)", "", n)), n)  # "ESIT EKET (UQUO)" also answers to ESITEKET
    return out


def match_fragments(frags: list[str], lga_names: list[str], spellings: dict[str, str]) -> tuple[list[str], list[str]]:
    """Exact key matches, plus reviewed spelling variants. Returns (LGA names, unmatched fragments)."""
    keys = _lga_keys(lga_names)
    found: list[str] = []
    unmatched: list[str] = []
    i = 0
    while i < len(frags):
        for width in (3, 2, 1):  # joined neighbours first: "ASKIRA" + "UBA" -> ASKIRAUBA
            chunk = frags[i:i + width]
            if len(chunk) < width:
                continue
            k = key("".join(chunk))
            name = keys.get(k) or (spellings.get(k) if spellings.get(k) in lga_names else None)
            if name:
                found.append(name)
                i += width
                break
        else:
            unmatched.append(frags[i])
            i += 1
    return list(dict.fromkeys(found)), unmatched


def resolve_composition(unit: WorkbookUnit, lga_names: list[str], overrides: dict[str, dict],
                        spellings: dict[str, str]) -> None:
    """Fill ``unit.lgas`` from the workbook. Order of preference, all INEC text:
    1. a reviewed override (aliases.yaml composition_overrides), for prose the rules can't read;
    2. "Part of <LGA>" -> a split LGA (OI-9);
    3. the COMPOSITION column;
    4. for a federal constituency, its NAME column, which also lists its LGAs ("Aba North/Aba South").
    Raises GeoError naming the unmatched text when none of these reads cleanly.
    """
    if unit.code in overrides:
        ov = overrides[unit.code]
        if re.sub(r"\s+", " ", ov["workbook_text"]).strip() != unit.composition or ov["row"] != unit.row:
            raise GeoError(f"{unit.code}: override was reviewed against row {ov['row']} text {ov['workbook_text']!r}, "
                           f"but the workbook now has row {unit.row} text {unit.composition!r}; review it again")
        names = ov["lgas"]
        missing = [n for n in names if n not in lga_names]
        if missing:
            raise GeoError(f"{unit.code}: override names unknown LGAs {missing}")
        unit.lgas, unit.resolved_by = list(names), "override"
        return
    part = re.match(r"^\s*Part of (.+?)\s*(L\.?G\.?A\.?)?\s*$", unit.composition, re.I)
    if part:
        found, unmatched = match_fragments([part.group(1)], lga_names, spellings)
        if unmatched or len(found) != 1:
            raise GeoError(f"{unit.code}: split LGA {part.group(1)!r} not in locator for {unit.state}")
        unit.split_lga, unit.lgas, unit.resolved_by = found[0], found, "split"
        return
    found, unmatched = match_fragments(fragments(unit.composition), lga_names, spellings)
    if found and not unmatched:
        if unit.kind == "FC":
            by_name, name_unmatched = match_fragments(fragments(unit.name), lga_names, spellings)
            if by_name and not name_unmatched and set(by_name) != set(found):
                raise GeoError(f"{unit.code} {unit.state}: name {unit.name!r} reads as {sorted(by_name)} but composition "
                               f"{unit.composition!r} reads as {sorted(found)}")
        unit.lgas, unit.resolved_by = found, "composition"
        return
    if unit.kind == "FC":
        by_name, name_unmatched = match_fragments(fragments(unit.name), lga_names, spellings)
        if by_name and not name_unmatched:
            unit.lgas, unit.resolved_by = by_name, "name"
            unit.unread_composition = unmatched
            return
    raise GeoError(f"{unit.code} {unit.state} {unit.name!r}: cannot read {unmatched} in {unit.composition!r}")


def propose_spellings(units: list[WorkbookUnit], lga_names_by_state: dict[str, list[str]],
                      spellings: dict[str, dict[str, str]]) -> list[tuple[str, str, str, float]]:
    """For review only: (state, workbook fragment, closest locator LGA, similarity) for every unread fragment."""
    import difflib

    out = []
    for u in units:
        names = lga_names_by_state[u.state]
        sp = spellings.get(u.state, {})
        texts = [u.composition] + ([u.name] if u.kind == "FC" else [])
        for text in texts[:1]:
            _, unmatched = match_fragments(fragments(text), names, sp)
            for frag in unmatched:
                best = max(names, key=lambda n: difflib.SequenceMatcher(None, key(frag), key(n)).ratio())
                out.append((u.state, frag, best, round(difflib.SequenceMatcher(None, key(frag), key(best)).ratio(), 2)))
    return sorted(set(out))


def read_lga_names() -> dict[str, list[str]]:
    """``{state: [LGA names]}`` from the cached locator (needs only the 37 LGA responses)."""
    states = parse_states((PU_RAW_DIR / "locator.html").read_text(encoding="utf-8", errors="replace"))
    out = {}
    for s_id, s_label in states:
        _, s_name = _split_label(s_label, 2)
        payload = json.loads((PU_RAW_DIR / "lgas" / f"{s_id}.json").read_bytes())
        out[s_name] = [_split_label(label, 2)[1] for _, label in parse_options(payload)]
    return out


_SEP = r"[\s/.,\-\u2010-\u2015\u2212]+"  # the card's dashes, a typographic dash, slashes, spaces, dots or commas
DELIM_RE = re.compile(rf"^\s*(\d{{1,2}}){_SEP}(\d{{1,2}}){_SEP}(\d{{1,2}}){_SEP}(\d{{1,3}})\s*$")
BARE_RE = re.compile(r"^\s*(\d{2})(\d{2})(\d{2})(\d{3})\s*$")  # no separators: exactly nine digits


def parse_delimitation_code(text: str) -> str | None:
    """Normalise a PVC delimitation code to ``SS/LL/WW/PPP``, or None if it isn't one.

    Accepts the card's dashes, '/', '.', ',' or spaces between parts, missing leading zeros ("24-15-3-12"), or no
    separators at all (exactly nine digits, "241503012").
    It only normalises; whether the code exists is checked against the polling-unit table, never guessed.
    """
    m = DELIM_RE.match(text or "") or BARE_RE.match(text or "")
    if not m:
        return None
    s, l, w, p = (int(g) for g in m.groups())
    if not (1 <= s <= 37 and l >= 1 and w >= 1 and p >= 1):
        return None
    return f"{s:02d}/{l:02d}/{w:02d}/{p:03d}"
