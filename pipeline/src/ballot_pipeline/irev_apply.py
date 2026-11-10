"""Use IReV's 2023 ward lists to settle or check which State Assembly race a ward is in (D-030).

Rules, all conservative:
  1. A ward is used only when IReV's ward code and name both match INEC's locator.
  2. IReV's 2023 constituency counts only when its name equals a 2027 constituency's name on INEC's list, and IReV's INEC code
     does not point at a different 2027 constituency through the workbook link.
  3. No LGA is touched where any of its 2027 constituencies has no 2023 counterpart (restored or renamed since 2023), or where
     any of its wards has an IReV constituency that fails rule 2: wards there may have moved.
  4. A ward showing several possible races keeps only IReV's, if IReV's is one of them; otherwise it is left as it is.
  5. A ward with one race from the 2011 workbook that IReV contradicts shows both races (OI-13): the sources disagree, and this
     project does not choose between INEC's own documents.
  6. Where the two disagree on at least half of an LGA's checked wards (and on two or more), the conflict is systematic, such as
     swapped "I"/"II" labels, so no ward of that LGA keeps a single race: every ward shows all the races its LGA's wards
     resolve to (OI-13). Found by an independent re-check of Enugu East (D-036).
"""

from __future__ import annotations

import re
from collections import defaultdict

from .geo import key
from .irev import IrevWard
from .sha_reconcile import _norm


def _code(c: str | None) -> str | None:
    m = re.match(r"^SC/0*(\d+)/?([A-Z]+)$", (c or "").replace(" ", ""))
    return f"SC/{m.group(1)}/{m.group(2)}" if m else None


def apply_irev(ward_races: dict[str, list[str]], list_scs: list, race_of: dict[tuple[str, str], str],
               irev: dict[str, IrevWard], ward_names: dict[str, tuple[str, str, str]]):
    """ward_races: ward code -> race ids (from the 2027 list and the workbook). list_scs: reconciled 2027 constituencies
    (state, name, lgas, workbook). ward_names: ward code -> (state, LGA, locator name).

    Returns (ward code -> race ids, ward code -> "irev" | "disagree", report lines)."""
    report: list[str] = []
    by_name = {(s.state, _norm(s.name)): race_of[(s.state, s.name)] for s in list_scs}
    wb_codes = defaultdict(list)
    for s in list_scs:
        if s.workbook and "@" not in s.workbook.code:  # a code INEC printed twice links nothing
            wb_codes[(s.state, _code(s.workbook.code))].append(race_of[(s.state, s.name)])

    link: dict[tuple[str, str, str], str | None] = {}
    for c, w in sorted(irev.items()):
        if c not in ward_names:
            continue
        st = ward_names[c][0]
        k = (st, w.sc_code, w.sc_name)
        if k in link:
            continue
        by_n = by_name.get((st, _norm(w.sc_name)))
        by_c = wb_codes.get((st, _code(w.sc_code)), [])
        if by_n and by_c and by_c != [by_n]:
            report.append(f"{st} {w.sc_name} ({w.sc_code}): its name and its INEC code point at different 2027 constituencies; not used")
            link[k] = None
        else:
            link[k] = by_n
            if not by_n:
                report.append(f"{st} {w.sc_name} ({w.sc_code}): no 2027 constituency of that name; not used")

    # rule 3: the LGAs where 2023 can speak for 2027
    linked_2027 = {r for r in link.values() if r}
    lga_ok: dict[tuple[str, str], bool] = defaultdict(lambda: True)
    for s in list_scs:
        if race_of[(s.state, s.name)] not in linked_2027:
            for l in s.lgas:
                lga_ok[(s.state, l)] = False
    for c, (st, lga, _) in ward_names.items():
        w = irev.get(c)
        if w and link.get((st, w.sc_code, w.sc_name)) is None:
            lga_ok[(st, lga)] = False

    out = dict(ward_races)
    how: dict[str, str] = {}
    for c, races in sorted(ward_races.items()):  # sorted: the same inputs give the same report
        st, lga, name = ward_names[c]
        w = irev.get(c)
        if not races or not w or key(w.name) != key(name) or not lga_ok[(st, lga)]:
            continue
        t = link[(st, w.sc_code, w.sc_name)]
        if len(races) > 1:
            if t in races:
                out[c], how[c] = [t], "irev"
        elif t != races[0]:
            out[c], how[c] = sorted({races[0], t}), "disagree"
            report.append(f"{c} {name} ({lga}): the 2011 workbook reading gives {races[0]}, IReV 2023 gives {t}; both shown (OI-13)")
        else:
            how[c] = "irev-confirms"

    # rule 6: a systematic conflict in an LGA leaves no ward of that LGA on a single race
    by_lga: dict[tuple[str, str], list[str]] = defaultdict(list)
    for c in out:
        st, lga, _ = ward_names[c]
        by_lga[(st, lga)].append(c)
    for (st, lga), codes in sorted(by_lga.items()):
        checked = [c for c in codes if c in how]
        disagree = [c for c in checked if how[c] == "disagree"]
        if len(disagree) >= 2 and 2 * len(disagree) >= len(checked):
            union = sorted({r for c in codes for r in out[c]})
            moved = [c for c in sorted(codes) if out[c] and out[c] != union]
            for c in moved:
                out[c], how[c] = union, "disagree"
            report.append(f"{st}/{lga}: INEC's workbook and IReV disagree on {len(disagree)} of {len(checked)} checked wards, so every "
                          f"ward shows all {len(union)} races (OI-13); {len(moved)} more ward(s) changed")
    return out, how, report
