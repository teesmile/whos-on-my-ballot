"""D-030: how IReV's 2023 ward lists may settle or check the ward -> State Assembly mapping."""
from types import SimpleNamespace as NS

from ballot_pipeline.irev import IrevWard
from ballot_pipeline.irev_apply import apply_irev


def sc(name, lgas, code=None):
    return NS(state="LAGOS", name=name, lgas=lgas, workbook=NS(code=code) if code else None)


SCS = [sc("SURULERE I", ["SURULERE"], "SC/670/LA"), sc("SURULERE II", ["SURULERE"], "SC/671/LA"), sc("AGEGE I", ["AGEGE"])]
RACE = {("LAGOS", s.name): s.name.lower().replace(" ", "-") for s in SCS}
NAMES = {"24/20/01": ("LAGOS", "SURULERE", "ORILE"), "24/20/04": ("LAGOS", "SURULERE", "AKINHANMI/COLE"),
         "24/01/01": ("LAGOS", "AGEGE", "ISALE/IDIMANGORO")}
BOTH = ["surulere-i", "surulere-ii"]


def irev(**over):
    w = {"24/20/01": IrevWard("24/20/01", "ORILE", "SC/671/LA", "SURULERE II"),
         "24/20/04": IrevWard("24/20/04", "AKINHANMI/COLE", "SC/670/LA", "SURULERE I"),
         "24/01/01": IrevWard("24/01/01", "ISALE/IDIMANGORO", "SC/1/LA", "AGEGE I")}
    w.update(over)
    return w


def test_narrows_an_unresolved_ward_to_irevs_race():
    out, how, _ = apply_irev({"24/20/01": BOTH, "24/20/04": BOTH, "24/01/01": ["agege-i"]}, SCS, RACE, irev(), NAMES)
    assert out["24/20/01"] == ["surulere-ii"] and out["24/20/04"] == ["surulere-i"]
    assert how == {"24/20/01": "irev", "24/20/04": "irev", "24/01/01": "irev-confirms"}


def test_a_different_ward_name_is_not_used():
    out, how, _ = apply_irev({"24/20/01": BOTH}, SCS, RACE, irev(**{"24/20/01": IrevWard("24/20/01", "ELSEWHERE", "SC/671/LA", "SURULERE II")}), NAMES)
    assert out["24/20/01"] == BOTH and "24/20/01" not in how


def test_a_contradicted_workbook_reading_shows_both_races():
    out, how, report = apply_irev({"24/20/01": ["surulere-i"]}, SCS, RACE, irev(), NAMES)
    assert out["24/20/01"] == BOTH and how["24/20/01"] == "disagree" and any("OI-13" in r for r in report)


def test_an_lga_with_a_constituency_unknown_in_2023_is_left_alone():
    scs = SCS + [sc("SURULERE III", ["SURULERE"])]  # e.g. restored in 2026
    race = {**RACE, ("LAGOS", "SURULERE III"): "surulere-iii"}
    three = BOTH + ["surulere-iii"]
    out, how, _ = apply_irev({"24/20/01": three}, scs, race, irev(), NAMES)
    assert out["24/20/01"] == three and not how


def test_a_name_and_code_pointing_at_different_races_is_not_used():
    swapped = irev(**{"24/20/01": IrevWard("24/20/01", "ORILE", "SC/670/LA", "SURULERE II")})  # code of I, name of II
    out, how, report = apply_irev({"24/20/01": BOTH, "24/20/04": BOTH}, SCS, RACE, swapped, NAMES)
    assert out["24/20/01"] == BOTH and out["24/20/04"] == BOTH  # the whole LGA is left alone
    assert any("different 2027 constituencies" in r for r in report)


def test_irevs_race_outside_the_wards_possible_races_is_ignored():
    names = {**NAMES, "24/20/01": ("LAGOS", "SURULERE", "ORILE")}
    w = irev(**{"24/20/01": IrevWard("24/20/01", "ORILE", "SC/1/LA", "AGEGE I")})
    out, how, _ = apply_irev({"24/20/01": BOTH}, SCS, RACE, w, names)
    assert out["24/20/01"] == BOTH and "24/20/01" not in how
