"""Provenance checks for the reviewed State Assembly readings in aliases.yaml (review 5).

Every reading cites an INEC source by id, and the build confirms the citation against the hashed input it names:
the workbook row says what the reading quotes, the 2027 list prints that constituency at that page and serial number,
every ward offered as evidence exists in INEC's locator inside the LGA the reading chooses, and every workbook row cited
belongs to the same state. A reading that fails any of these, or has no source, fails the build.
"""

from __future__ import annotations

import re

WORKBOOK = "inec-constituencies-workbook"
SHA_LIST = "sha-2026-10-10"


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def check_sha_overrides(sc_overrides: dict, lga_overrides: dict, hashed: set[str], sc_units: list,
                        ward_lga: dict[str, tuple[str, str]], printed_at: dict[tuple[str, str], set[tuple[int, int]]]) -> list[str]:
    """sc_units: workbook rows (code, state, row, comp). ward_lga: ward code -> (state, LGA) from INEC's locator.
    printed_at: (state, 2027 name) -> {(page, serial number)} of its candidates on INEC's 2027 list."""
    errors: list[str] = []
    by_code = {s.code: s for s in sc_units}
    rows_by_state = {(s.state, s.row) for s in sc_units}

    def wards_ok(label: str, state: str, lgas: list[str], wards: list[str]) -> None:
        for w in wards:
            st, lga = ward_lga.get(w, (None, None))
            if st != state or lga not in lgas:
                errors.append(f"{label}: evidence ward {w} is not a {state} ward in {lgas} in INEC's locator ({st}, {lga})")

    for code, ov in sc_overrides.items():
        label = f"state_constituency_overrides {code}"
        if ov.get("source_id") != WORKBOOK or WORKBOOK not in hashed:
            errors.append(f"{label}: must cite source_id {WORKBOOK} (a hashed source)")
            continue
        for f in ("row", "workbook_text", "lgas", "reading"):
            if f not in ov:
                errors.append(f"{label}: missing {f}")
        s = by_code.get(code)
        if s is None:
            errors.append(f"{label}: no such code in INEC's workbook")
            continue
        if ov.get("row") != s.row:
            errors.append(f"{label}: cites row {ov.get('row')}, but the code is on row {s.row}")
        if _norm(ov.get("workbook_text", "")) != _norm(s.comp):
            errors.append(f"{label}: quotes {ov.get('workbook_text')!r}, but row {s.row} says {s.comp!r}")
        wards_ok(label, s.state, ov.get("lgas") or [], ov.get("wards") or [])

    for k, ov in lga_overrides.items():
        label = f"sha_lga_overrides {k}"
        state, _, name = k.partition("|")
        if ov.get("source_id") != SHA_LIST or SHA_LIST not in hashed:
            errors.append(f"{label}: must cite source_id {SHA_LIST} (a hashed source)")
            continue
        for f in ("page", "sn", "lgas", "reading"):
            if f not in ov:
                errors.append(f"{label}: missing {f}")
        if (ov.get("page"), ov.get("sn")) not in printed_at.get((state, name), set()):
            errors.append(f"{label}: INEC's 2027 list does not print {name!r} at page {ov.get('page')}, serial {ov.get('sn')}")
        wards_ok(label, state, ov.get("lgas") or [], ov.get("wards") or [])
        for r in ov.get("workbook_rows") or []:
            if (state, r) not in rows_by_state:
                errors.append(f"{label}: workbook row {r} is not a {state} constituency row")
    return errors


def check_ward_spellings(spellings: dict, units_by_code: dict, hashed: set[str], ward_info: dict[str, tuple[str, str, str]]) -> list[str]:
    """ward_spellings.yaml: each workbook ward-name fragment matched to a locator ward. Each entry must cite the workbook row whose
    composition text holds the fragment, and name a locator ward that exists, is spelled as recorded, and lies in the constituency's
    LGA (review 5b)."""
    from .geo import key

    errors: list[str] = []
    for code, frags in spellings.items():
        s = units_by_code.get(code)
        for frag, v in frags.items():
            label = f"ward_spellings {code} {frag}"
            if v.get("source_id") != WORKBOOK or WORKBOOK not in hashed:
                errors.append(f"{label}: must cite source_id {WORKBOOK} (a hashed source)")
                continue
            if s is None:
                errors.append(f"{label}: no such code in INEC's workbook")
                continue
            if v.get("row") != s.row:
                errors.append(f"{label}: cites row {v.get('row')}, but the code is on row {s.row}")
            if frag not in key(s.comp):
                errors.append(f"{label}: row {s.row} ({s.comp!r}) does not contain this fragment")
            st, lga, name = ward_info.get(v.get("code"), (None, None, None))
            if name is None:
                errors.append(f"{label}: ward {v.get('code')} is not in INEC's locator")
            elif name != v.get("locator_ward"):
                errors.append(f"{label}: ward {v.get('code')} is {name!r} in INEC's locator, not {v.get('locator_ward')!r}")
            elif st != s.state or (s.lgas and lga not in s.lgas):
                errors.append(f"{label}: ward {v.get('code')} is in {st}/{lga}, outside the constituency's LGAs {s.lgas}")
    return errors
