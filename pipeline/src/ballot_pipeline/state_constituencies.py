"""Ward -> state constituency, from the STATE CONST. sheet of INEC's constituency workbook (Phase 5, D-028).

The sheet gives no LGA column. Each constituency's composition is one of:
  "The entire LGA" / "The entire area of X LGA"   every ward of an LGA
  "Ward 01 – 05 & 12 - 17"                        ward numbers within an LGA (INEC's registration-area codes)
  "OGBA/OKE-IRA, OLD IFAKO/KARAOLE, ..."          ward names
  "7 RAS OF ADO EKITI I"                          only a count of wards
  "Part of the LGA"                               no ward detail

Steps, every one checkable:
  1. find each constituency's LGA: named in the text or the constituency name (with the reviewed LGA spellings),
     by its listed ward names, by its ward numbers and name, or from its neighbours in the sheet (the sheet is grouped by LGA);
  2. assign wards: all wards, the numbered wards, or the named wards;
  3. per LGA, wards no constituency claims go to the one constituency left without a definite ward list (a count, "part of",
     or a partly matched list); a count must then equal the wards it receives;
  4. anything still open is "unresolved": its wards list every constituency of the LGA that could hold them (OI-6),
     and the site shows all of them, never one.
Reviewed readings in aliases.yaml (`state_constituency_overrides`) settle what the rules can't, each quoting INEC's text.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import xlrd

from .geo import WORKBOOK_STATE_SUFFIX, key

ABBREVIATIONS = {  # INEC's own short forms in the workbook, as read in the reviewed senatorial overrides (D-018)
    "K/HAUSA": "KAFIN HAUSA", "K/KASAMMA": "KIRIKA SAMMA", "M/MADORI": "MALAM MADORI", "S/TANKARA": "SULE-TANKARKAR",
    "S/TANKAR": "SULE-TANKARKAR", "K/NAMODA": "KAURA NAMODA", "T/MAFARA": "TALATA MAFARA",
}
SUFFIX = re.compile(r"\s*(\((.*?)\)|\b(I|II|III|IV|V|VI|NORTH|SOUTH|EAST|WEST|CENTRAL|URBAN|RURAL)\b|L\.?G\.?A\.?)\s*$")


@dataclass
class SC:
    code: str
    state: str
    name: str
    comp: str
    row: int
    kind: str = ""
    nums: list[int] = field(default_factory=list)
    count: int | None = None
    lgas: list[str] = field(default_factory=list)  # locator LGA names
    lga_by: str = ""  # how the LGA was found
    wards: set[str] = field(default_factory=set)  # ward codes SS/LL/WW
    unmatched: list[str] = field(default_factory=list)  # listed ward names not found


def read_sheet(path: str) -> list[SC]:
    sheet = xlrd.open_workbook(path).sheet_by_name("STATE CONST.")
    out = []
    for r in range(sheet.nrows):
        c = [str(x.value).strip() for x in sheet.row(r)]
        if len(c) <= 3 or "SC" not in c[2].upper():
            continue
        # INEC prints a few codes without the second slash ("SC/076GM", "SC/561KB", "SC/762OD"); every data row must be read
        m = re.match(r"^SC/(\d+)/?([A-Z]+)$", c[2].replace(" ", ""))
        if not m or m.group(2) not in WORKBOOK_STATE_SUFFIX:
            raise ValueError(f"STATE CONST. row {r + 1}: unreadable code {c[2]!r}")
        out.append(SC(f"SC/{m.group(1)}/{m.group(2)}", WORKBOOK_STATE_SUFFIX[m.group(2)], re.sub(r"\s+", " ", c[1]).strip(),
                      re.sub(r"\s+", " ", c[3]).strip(), r + 1))
    # INEC prints one code twice (Delta's IKA SOUTH, serial 251, and ISOKO NORTH, serial 252, are both "SC/252/DT"): a clashing
    # row is identified by its code and sheet row, so neither constituency can take the other's place
    counts = Counter(s.code for s in out)
    for s in out:
        if counts[s.code] > 1:
            s.code = f"{s.code}@row{s.row}"
    return out


def parse_composition(sc: SC) -> None:
    c = sc.comp
    if re.search(r"entire", c, re.I):
        sc.kind = "entire"
    elif re.search(r"part of", c, re.I):
        sc.kind = "part"
    elif m := re.match(r"^\s*(\d+)\s*RAS?\s*OF\s*(.+)$", c, re.I):
        sc.kind, sc.count = "count", int(m.group(1))
    elif re.match(r"^\s*wards?\b", c, re.I) and re.search(r"\d", c):
        nums: set[int] = set()
        for part in re.split(r",|&|\band\b", re.sub(r"^\s*wards?\s*", "", c, flags=re.I)):
            part = part.strip()
            if rm := re.match(r"^(\d+)\s*[–\-]\s*(\d+)$", part):
                nums |= set(range(int(rm.group(1)), int(rm.group(2)) + 1))
            elif part.isdigit():
                nums.add(int(part))
            elif part:
                sc.kind = "names"
                return
        sc.kind, sc.nums = "nums", sorted(nums)
    else:
        sc.kind = "names"


def fragments(text: str) -> list[str]:
    return [key(x) for x in re.split(r",|;|\band\b|&", text, flags=re.I) if key(x)]


class StateGeoIndex:
    def __init__(self, state: dict, spellings: dict[str, str]):
        self.state = state
        self.lgas = {l["name"]: l for l in state["lgas"]}
        self.keys: dict[str, str] = {}
        for l in state["lgas"]:
            self.keys.setdefault(key(l["name"]), l["name"])
            self.keys.setdefault(key(re.sub(r"\(.*?\)", "", l["name"])), l["name"])
        for k, v in spellings.items():
            self.keys.setdefault(k, v)
        for short, full in ABBREVIATIONS.items():
            if full in self.lgas:
                self.keys.setdefault(key(short), full)
        self.ward_by_num = {n: {int(w["code"].split("/")[2]): w for w in l["wards"]} for n, l in self.lgas.items()}

    def lgas_in_text(self, text: str) -> list[str]:
        t = key(text)
        out = []
        for k in sorted(self.keys, key=len, reverse=True):
            if k and k in t and self.keys[k] not in out:
                out.append(self.keys[k])
                t = t.replace(k, "")
        return out

    def lga_from_name(self, name: str) -> list[str]:
        n = name
        for _ in range(5):
            if key(n) in self.keys:
                return [self.keys[key(n)]]
            n2 = SUFFIX.sub("", n).strip()
            if n2 == n:
                break
            n = n2
        return []

    def lga_close_to(self, name: str) -> list[str]:
        """An LGA whose name is at least 85% similar to the constituency name (minus suffixes), and clearly the closest."""
        import difflib

        n = name
        for _ in range(5):
            n2 = SUFFIX.sub("", n).strip()
            if n2 == n:
                break
            n = n2
        scored = sorted(((difflib.SequenceMatcher(None, key(n), key(l)).ratio(), l) for l in self.lgas), reverse=True)
        if scored and scored[0][0] >= 0.85 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.1):
            return [scored[0][1]]
        return []

    def lgas_in_name(self, name: str) -> list[str]:
        """Every LGA a multi-LGA constituency name names ("KURA/GURUN MALLAM", "IREWOLE/ISOKAN", "OYO WEST & OYO EAST")."""
        from .geo import fragments as lga_fragments  # expands "ATAKUNMOSA EAST AND WEST" -> both names

        out: list[str] = []
        for part in [p for chunk in re.split(r"/|&", name) for p in lga_fragments(chunk)]:
            part = part.strip()
            if len(key(part)) < 3:
                continue
            for l in self.lga_from_name(part) or self.lga_close_to(part):
                if l not in out:
                    out.append(l)
        return out

    def ward_matches(self, lga: str, names: list[str], spelled: dict[str, str] | None = None) -> tuple[set[str], list[str]]:
        wards = self.lgas[lga]["wards"]
        by_key = defaultdict(list)
        for w in wards:
            by_key[key(w["name"])].append(w["code"])
        for frag, code in (spelled or {}).items():  # reviewed spellings (ward_spellings.yaml) for this constituency
            if any(w["code"] == code for w in wards):
                by_key.setdefault(frag, [code])
        found, missing = set(), []
        i = 0
        while i < len(names):
            for width in (3, 2, 1):  # INEC wraps "OKO/EPE/ITULA I" etc.; try joined neighbours first
                k = "".join(names[i:i + width])
                if len(names[i:i + width]) == width and k in by_key and len(by_key[k]) == 1:
                    found.add(by_key[k][0])
                    i += width
                    break
            else:
                missing.append(names[i])
                i += 1
        return found, missing


def map_state_constituencies(sheet_path: str, geo_by_state: dict[str, dict], spellings_by_state: dict[str, dict[str, str]],
                             overrides: dict[str, dict], ward_spellings: dict[str, dict[str, str]] | None = None,
                             ) -> tuple[list[SC], dict[str, list[str]], list[str]]:
    """Returns (constituencies, ward code -> [SC codes], errors)."""
    scs = read_sheet(sheet_path)
    errors: list[str] = []
    idx = {st: StateGeoIndex(g, spellings_by_state.get(st, {})) for st, g in geo_by_state.items()}
    for sc in scs:
        parse_composition(sc)

    # 1. LGA of each constituency
    for sc in scs:
        ix = idx[sc.state]
        ov = overrides.get(sc.code)
        if ov:
            if re.sub(r"\s+", " ", ov["workbook_text"]).strip() != sc.comp:
                errors.append(f"{sc.code}: override reviewed against {ov['workbook_text']!r}, workbook now says {sc.comp!r}")
            sc.lgas, sc.lga_by = list(ov["lgas"]), "override"
            if ov.get("kind"):
                sc.kind = {"remainder": "part"}.get(ov["kind"], ov["kind"])
            for l in sc.lgas:
                if l not in ix.lgas:
                    errors.append(f"{sc.code}: override names unknown LGA {l!r}")
            continue
        if sc.kind == "entire":
            plural = bool(re.search(r"\bLGAs\b", sc.comp, re.I)) or bool(re.search(r"/|&|\bAND\b", sc.name))
            sc.lgas = (ix.lgas_in_text(re.sub(r"(?i)the entire (area of )?|lgas?\b", "", sc.comp))
                       or (ix.lgas_in_name(sc.name) if plural else []) or ix.lga_from_name(sc.name)
                       or ix.lgas_in_text(sc.name) or ix.lga_close_to(sc.name))
            sc.lga_by = "text" if sc.lgas else ""
        elif sc.kind == "count":
            place = re.sub(r"^\s*\d+\s*RAS?\s*OF\s*", "", sc.comp, flags=re.I)
            sc.lgas = (ix.lgas_in_name(place) if re.search(r"/|&|\bAND\b", place, re.I) else []) or ix.lgas_in_text(place)[:1] \
                or ix.lga_from_name(sc.name)
            sc.lga_by = "text" if sc.lgas else ""
        elif sc.kind == "names" and re.search(r"/|&|\bAND\b", sc.name) and len(ix.lgas_in_name(sc.name)) >= 2:
            sc.lgas, sc.lga_by = ix.lgas_in_name(sc.name), "names several LGAs"
        elif sc.kind == "names":
            fr = fragments(sc.comp)
            scored = sorted(((len(ix.ward_matches(l, fr)[0]), l) for l in ix.lgas), reverse=True)
            if scored and scored[0][0] and scored[0][0] * 2 >= len(fr) and (len(scored) == 1 or scored[1][0] < scored[0][0]):
                sc.lgas, sc.lga_by = [scored[0][1]], "ward names"
        if not sc.lgas and sc.kind in ("nums", "part", "names", "count"):
            sc.lgas = ix.lga_from_name(sc.name) or ix.lga_close_to(sc.name)
            sc.lga_by = "name" if sc.lgas else ""
        if not sc.lgas and sc.kind == "nums":
            toks = [key(t) for t in re.split(r"/|-", sc.name) if len(key(t)) >= 3]
            scored = []
            for l, wmap in ix.ward_by_num.items():
                if not all(n in wmap for n in sc.nums):
                    continue
                names = [key(wmap[n]["name"]) for n in sc.nums]
                scored.append((sum(1 for t in toks if any(t in w for w in names)), l))
            scored.sort(reverse=True)
            if scored and scored[0][0] > 0 and (len(scored) == 1 or scored[1][0] < scored[0][0]):
                sc.lgas, sc.lga_by = [scored[0][1]], "ward numbers and names"

    # Rounds of evidence for constituencies still without an LGA, each re-run until nothing changes.
    by_state = defaultdict(list)
    for sc in scs:
        by_state[sc.state].append(sc)
    for lst in by_state.values():
        lst.sort(key=lambda s: s.row)

    def claimed_nums(st: str, lga: str) -> set[int]:
        return {n for s in by_state[st] if s.lgas == [lga] and s.kind == "nums" for n in s.nums}

    def neighbours(st: str, sc: SC) -> set[str]:
        lst = by_state[st]
        i = lst.index(sc)
        prev = next((s.lgas for s in reversed(lst[:i]) if s.lgas), [])
        nxt = next((s.lgas for s in lst[i + 1:] if s.lgas), [])
        return set(prev) | set(nxt)

    def ward_name_lgas(st: str, text: str, wards_of=None) -> list[tuple[float, str]]:
        import difflib

        toks = [key(x) for x in re.split(r"/|,|&", text) if len(key(x)) >= 3]
        out = []
        for l in idx[st].lgas:
            names = [key(w["name"]) for w in (wards_of(l) if wards_of else idx[st].lgas[l]["wards"])]
            if not names or not toks:
                continue
            score = max(max((difflib.SequenceMatcher(None, t, n).ratio() if t not in n else 1.0) for n in names) for t in toks)
            out.append((score, l))
        return sorted(out, reverse=True)

    changed = True
    while changed:
        changed = False
        for st, lst in by_state.items():
            ix = idx[st]
            # partitions: consecutive unplaced numbered constituencies covering exactly 1..N of an LGA with N wards and no claims
            run: list[SC] = []
            for sc in lst + [None]:
                if sc is not None and not sc.lgas and sc.kind == "nums":
                    run.append(sc)
                    continue
                if len(run) >= 2:
                    union = sorted(n for s in run for n in s.nums)
                    if union == list(range(1, len(union) + 1)):
                        fits = [l for l, w in ix.ward_by_num.items() if len(w) == len(union) and not claimed_nums(st, l)
                                and not any(s.lgas == [l] for s in lst)]
                        if len(fits) == 1:
                            for s in run:
                                s.lgas, s.lga_by = list(fits), "ward-number partition"
                            changed = True
                run = []
            for sc in lst:
                if sc.lgas:
                    continue
                if sc.kind == "nums":
                    cands = [l for l, w in ix.ward_by_num.items()
                             if all(n in w for n in sc.nums) and not (set(sc.nums) & claimed_nums(st, l))]
                    near = [l for l in cands if l in neighbours(st, sc)]
                    scored = ward_name_lgas(st, sc.name, lambda l: [ix.ward_by_num[l][n] for n in sc.nums]
                                            if all(n in ix.ward_by_num[l] for n in sc.nums) else [])
                    scored = [x for x in scored if x[1] in cands]
                    pick = (cands if len(cands) == 1 else near if len(near) == 1 else
                            [scored[0][1]] if scored and scored[0][0] >= 0.8 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.1)
                            else [])
                    if pick:
                        sc.lgas, sc.lga_by = pick, "ward-number fit"
                        changed = True
                elif sc.kind in ("count", "entire"):
                    m = re.match(r"^\s*\d+\s*RAS?\s*OF\s*(.+)$", sc.comp, re.I)
                    place = m.group(1) if m else sc.name
                    scored = ward_name_lgas(st, re.sub(r"(?i)\blgas?\b", "", place))
                    if scored and scored[0][0] >= 0.85 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.1):
                        sc.lgas, sc.lga_by = [scored[0][1]], "has a ward of that name"
                        changed = True
            # elimination: one LGA with no constituency and one unplaced "entire" constituency
            placed = {l for s in lst for l in s.lgas}
            free_lgas = [l for l in ix.lgas if l not in placed]
            free_entire = [s for s in lst if not s.lgas and s.kind == "entire"]
            if len(free_lgas) == 1 and len(free_entire) == 1:
                free_entire[0].lgas, free_entire[0].lga_by = free_lgas, "elimination"
                changed = True

    for sc in scs:
        if not sc.lgas:
            errors.append(f"{sc.code} {sc.state} {sc.name!r}: no LGA found for {sc.comp!r} (add a reviewed override)")

    # 2. wards of each constituency
    for sc in scs:
        ix = idx[sc.state]
        if not sc.lgas:
            continue
        if sc.kind == "entire":
            sc.wards = {w["code"] for l in sc.lgas for w in ix.lgas[l]["wards"]}
        elif sc.kind == "nums":
            wmap = ix.ward_by_num[sc.lgas[0]]
            missing = [n for n in sc.nums if n not in wmap]
            if missing:
                pass  # handled by the numbering check below (the LGA is treated as renumbered)
            sc.wards = {wmap[n]["code"] for n in sc.nums if n in wmap}
        elif sc.kind == "names":
            remaining = fragments(sc.comp)
            for l in sc.lgas:  # a constituency over several LGAs: match its listed wards in each
                found, remaining = ix.ward_matches(l, remaining, (ward_spellings or {}).get(sc.code))
                sc.wards |= found
            sc.unmatched = remaining

    # 2b. numbering check: where an LGA's constituencies are given by ward numbers, the numbers must not overlap, and if
    # every constituency of the LGA is numbered they must cover 1..N exactly. Otherwise INEC has renumbered the LGA's wards
    # since 2011, so its numbered constituencies keep no wards and the LGA's wards stay unresolved between them (OI-6).
    by_lga_all = defaultdict(list)
    for sc in scs:
        for l in sc.lgas:
            by_lga_all[(sc.state, l)].append(sc)
    renumbered: set[tuple[str, str]] = set()
    for (st, l), group in by_lga_all.items():
        numbered = [s for s in group if s.kind == "nums" and s.lgas == [l]]
        if not numbered:
            continue
        flat = [n for s in numbered for n in s.nums]
        n_wards = len(idx[st].ward_by_num[l])
        overlap = len(flat) != len(set(flat))
        out_of_range = any(n > n_wards for n in flat)
        incomplete = len(numbered) == len(group) and sorted(flat) != list(range(1, n_wards + 1))
        if overlap or out_of_range or incomplete:
            renumbered.add((st, l))
            for s in numbered:
                s.wards = set()
                s.kind = "renumbered"

    # 3. per LGA: give unclaimed wards to the single constituency without a definite list
    ward_scs: dict[str, list[str]] = defaultdict(list)
    for sc in scs:
        for w in sc.wards:
            ward_scs[w].append(sc.code)
    by_lga = defaultdict(list)
    for sc in scs:
        for l in sc.lgas:
            by_lga[(sc.state, l)].append(sc)
    for (st, l), group in by_lga.items():
        all_wards = {w["code"] for w in idx[st].lgas[l]["wards"]}
        unclaimed = sorted(all_wards - set().union(*(s.wards for s in group)))
        if not unclaimed:
            continue
        open_ = [s for s in group if s.kind in ("count", "part", "renumbered") or s.unmatched]
        if (st, l) in renumbered:  # no single remainder: every open constituency of the LGA stays possible
            for w in unclaimed:
                ward_scs[w].extend(x.code for x in open_)
            continue
        if len(open_) == 1:
            s = open_[0]
            s.wards |= set(unclaimed)
            for w in unclaimed:
                ward_scs[w].append(s.code)
        else:
            for w in unclaimed:  # OI-6: every constituency of the LGA that could hold it
                ward_scs[w].extend(sorted({x.code for x in (open_ or group)}))
    for w in ward_scs:
        ward_scs[w] = sorted(set(ward_scs[w]))
    return scs, dict(ward_scs), errors


def count_anomalies(scs: list[SC]) -> list[str]:
    """INEC's "N RAS OF X" against the wards the constituency received: a difference means wards changed since 2011."""
    return [f"{s.code} {s.name}: INEC's workbook says {s.count} wards, the locator gives {len(s.wards)}"
            for s in scs if s.kind == "count" and s.count is not None and s.wards and len(s.wards) != s.count]
