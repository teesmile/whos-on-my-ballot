"""Reconcile INEC's 2027 State Assembly list with its 2011 constituency workbook (Phase 5, D-028).

INEC's 2027 list is the authority for which constituencies exist and, where its name carries one, for each constituency's
LGA ("BURRA (NINGI II)", "OMUPO/IGBAJA IFELODUN I", "LAFIAGI / EDU"). The 2011 workbook is used only to split an LGA's
wards between its constituencies, and only when that LGA's 2027 constituencies match the workbook's one-to-one. Wherever
they differ (constituencies created, renamed or moved since 2011), the LGA's wards list every 2027 constituency of the LGA
as unresolved (OI-6) instead of guessing.
"""

from __future__ import annotations

import difflib
import re
from collections import defaultdict
from dataclasses import dataclass, field

from .geo import key
from .state_constituencies import ABBREVIATIONS, SC, StateGeoIndex


@dataclass
class ListSC:
    state: str
    name: str  # INEC's 2027 spelling, verbatim
    base: str  # the name without INEC's LGA hint
    hint: str  # INEC's LGA hint, if any
    lgas: list[str] = field(default_factory=list)
    lga_by: str = ""
    workbook: SC | None = None
    wards: set[str] = field(default_factory=set)


def split_hint(name: str, ix: StateGeoIndex | None = None) -> tuple[str, str]:
    """'BURRA (NINGI II)' -> ('BURRA', 'NINGI II'); 'BALOGUN/OJUMU /OFFA I' -> ('BALOGUN/OJUMU', 'OFFA I');
    'ILESHA/GWANARA BARUTIN I' -> ('ILESHA/GWANARA', 'BARUTIN I') when the trailing words name an LGA; else (name, '')."""
    if m := re.match(r"^(.*?)\s*\((.+)\)\s*$", name):
        return m.group(1).strip(), m.group(2).strip()
    if m := re.match(r"^(.*?\S)\s+/\s*(.+)$", name):
        return m.group(1).strip(), m.group(2).strip()
    if ix is not None and "/" in name and re.search(r"\b(I{1,3}|IV|V)\s*$", name):  # Kwara style: "X/Y LGA I"
        words = name.split()
        for n in range(1, min(4, len(words))):  # trailing 1-3 words (plus an optional numeral) naming an LGA
            tail = words[-n:]
            core = [w for w in tail if not re.fullmatch(r"I{1,3}|IV|V", w)]
            if core and ix.lga_from_name(" ".join(core)):
                head = " ".join(words[:-n])
                if len(key(head)) >= 3:
                    return head, " ".join(tail)
    return name.strip(), ""


def _norm(name: str) -> str:
    n = name.upper()
    for short, full in ABBREVIATIONS.items():
        n = n.replace(short, full)
    return key(n)


WEAK = ("ward-number partition", "ward-number fit", "has a ward of that name", "sheet neighbours")


def reconcile(list_names: dict[str, list[str]], scs: list[SC], idx: dict[str, StateGeoIndex],
              name_links: dict[str, str], lga_overrides: dict[str, dict] | None = None,
              ) -> tuple[list[ListSC], dict[str, list[str]], list[str], list[str]]:
    """list_names: state -> INEC 2027 constituency names. name_links: "STATE|list name" -> workbook name (reviewed).

    Returns (list constituencies, ward code -> [list constituency names], notes, errors).
    """
    notes: list[str] = []
    errors: list[str] = []
    out: list[ListSC] = []
    wb_by_state = defaultdict(list)
    for s in scs:
        wb_by_state[s.state].append(s)

    for st, names in list_names.items():
        ix = idx[st]
        wb = wb_by_state[st]
        used: set[str] = set()
        for name in names:
            base, hint = split_hint(name, ix)
            ls = ListSC(st, name, base, hint)
            # link to the workbook: reviewed link, or any form of the name equal (or 0.85+ similar, clearly closest) to any
            # form of a workbook name; a bracket on either side may hold an old name
            target = name_links.get(f"{st}|{name}")
            mine = {_norm(x) for x in (name, base, hint) if x and len(key(x)) >= 3}
            def forms(s: SC) -> set[str]:
                b, h = split_hint(s.name)
                return {_norm(x) for x in (s.name, b, h) if x and len(key(x)) >= 3}
            cands = [s for s in wb if s.code not in used and ((target and s.name == target) or (not target and mine & forms(s)))]
            if not cands and not target:
                scored = sorted(((max(difflib.SequenceMatcher(None, a, b).ratio() for a in mine for b in forms(s)), s)
                                 for s in wb if s.code not in used and forms(s)), key=lambda x: -x[0])
                if scored and scored[0][0] >= 0.85 and (len(scored) == 1 or scored[0][0] - scored[1][0] >= 0.05):
                    cands = [scored[0][1]]
            if len(cands) == 1:
                ls.workbook = cands[0]
                used.add(cands[0].code)
            # LGA: INEC's 2027 hint first (whole-name lookups before substring search), then the linked workbook
            # constituency, then the name, then an LGA with a ward of that name (constituencies created after 2011)
            def lookup(text: str) -> list[str]:
                core = re.sub(r"\s+\b(I{1,3}|IV|V)\b\s*$", "", text)
                return ix.lga_from_name(core) or ix.lgas_in_name(core)
            hint_lgas = lookup(hint) if hint else []
            base_whole = ix.lga_from_name(base) or (ix.lgas_in_name(base) if re.search(r"/|&|\bAND\b", base, re.I) else [])
            if hint_lgas and base_whole and set(base_whole) != set(hint_lgas) and "(" not in name:
                hint_lgas = list(dict.fromkeys(base_whole + hint_lgas))  # "OYO WEST / OYO EAST": both LGAs
            name_lgas = lookup(base) or lookup(name)
            if not name_lgas:  # "ZARIA CITY", "BASSA KOMU", "IJUMU ARIN": the name starts with its LGA's name
                starts = [l for l in ix.lgas if key(base).startswith(key(l)) and len(key(l)) >= 4]
                if len(starts) == 1:
                    name_lgas = starts
            ov = (lga_overrides or {}).get(f"{st}|{name}")
            if ov:
                bad = [l for l in ov["lgas"] if l not in ix.lgas]
                if bad:
                    errors.append(f"{st} {name!r}: override names unknown LGAs {bad}")
                ls.lgas, ls.lga_by = list(ov["lgas"]), "reviewed reading"
            elif hint_lgas:
                ls.lgas, ls.lga_by = hint_lgas, "INEC 2027 list"
            elif ls.workbook and ls.workbook.lgas:
                ls.lgas, ls.lga_by = list(ls.workbook.lgas), f"workbook ({ls.workbook.lga_by})"
            elif name_lgas:
                ls.lgas, ls.lga_by = name_lgas, "name"
            else:
                parts = [key(p) for p in re.split(r"/", base) if len(key(p)) >= 4] or [key(base)]
                hits = [l for l in ix.lgas if any(any(p == key(w["name"]) or key(w["name"]).startswith(p) for p in parts)
                                                  for w in ix.lgas[l]["wards"])]
                if len(hits) == 1:
                    ls.lgas, ls.lga_by = hits, "has a ward of that name"
            if ls.workbook and ls.workbook.lgas and ls.lgas and set(ls.lgas) != set(ls.workbook.lgas):
                notes.append(f"{st} {name!r}: INEC's 2027 list places it in {ls.lgas}; the workbook reading gave "
                             f"{ls.workbook.lgas} ({ls.workbook.lga_by}). The 2027 list is followed.")
            if not ls.lgas:
                hint_text = ix.lga_close_to(base) or ix.lga_close_to(name)
                errors.append(f"{st} {name!r}: no LGA from INEC's 2027 name or the workbook (add a sourced sha_lga_overrides entry)"
                              + (f"; closest LGA name, unreviewed: {hint_text}" if hint_text else ""))
            out.append(ls)

    # Per LGA: use the workbook's ward split only if the LGA's 2027 constituencies match the workbook's one-to-one
    ward_list: dict[str, list[str]] = defaultdict(list)
    by_lga = defaultdict(list)
    for ls in out:
        for l in ls.lgas:
            by_lga[(ls.state, l)].append(ls)
    for (st, l), group in by_lga.items():
        all_wards = {w["code"] for w in idx[st].lgas[l]["wards"]}
        # a workbook placement made only by a weak rule (and not confirmed by INEC's 2027 name or a reviewed reading)
        # never splits wards: the LGA's wards stay unresolved between its constituencies
        weak = [g for g in group if g.lga_by.startswith("workbook") and any(w in g.lga_by for w in WEAK)]
        linked = [g for g in group if g.workbook and g.workbook.lgas == g.lgas and g not in weak]
        wb_here = [s for s in wb_by_state[st] if l in s.lgas]
        same_roster = (len(linked) == len(group) == len(wb_here)
                       and {g.workbook.code for g in linked} == {s.code for s in wb_here}
                       and all(g.workbook.wards & all_wards for g in linked)  # every constituency must receive wards
                       # review 6: overlapping claims (Katagum: "the entire LGA" beside "wards 05-11") mean the workbook
                       # contradicts itself for this LGA, so it cannot split it
                       and sum(len(g.workbook.wards & all_wards) for g in linked) == len(set().union(*(g.workbook.wards & all_wards for g in linked))))
        if same_roster:
            claimed: dict[str, list[str]] = defaultdict(list)
            for g in group:
                for w in g.workbook.wards & all_wards:
                    claimed[w].append(g.name)
            for w in all_wards:
                holders = claimed.get(w) or [g.name for g in group]  # unclaimed: any of the LGA's constituencies
                ward_list[w].extend(holders)
        else:
            if len(group) > 1:
                notes.append(f"{st}/{l}: 2027 constituencies {sorted(g.name for g in group)} differ from the 2011 workbook's "
                             f"{sorted(s.name for s in wb_here)}; its wards list all {len(group)} (OI-6)")
            for w in all_wards:
                ward_list[w].extend(g.name for g in group)
    for ls in out:
        ls.wards = {w for w, holders in ward_list.items() if ls.name in holders}
    for w in ward_list:
        ward_list[w] = sorted(set(ward_list[w]))
    return out, dict(ward_list), notes, errors
