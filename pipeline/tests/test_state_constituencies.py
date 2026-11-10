"""Ward -> State Assembly constituency rules (Phase 5, D-028), on small synthetic states."""

import pytest

from ballot_pipeline.sha_reconcile import reconcile, split_hint
from ballot_pipeline.state_constituencies import SC, StateGeoIndex, parse_composition


def sc(comp, name="X", code="SC/1/AB", state="ABIA", row=1):
    s = SC(code, state, name, comp, row)
    parse_composition(s)
    return s


@pytest.mark.parametrize("comp,kind,nums,count", [
    ("The entire LGA", "entire", [], None),
    ("Part of the LGA", "part", [], None),
    ("10 RAS OF OGBOMOSO SOUTH", "count", [], 10),
    ("Ward 01 – 05 & 12 - 14", "nums", [1, 2, 3, 4, 5, 12, 13, 14], None),
    ("Ward 01, 07 & 10 – 11", "nums", [1, 7, 10, 11], None),
    ("AFARA, IGBO I, IGBO II", "names", [], None),
])
def test_composition_kinds(comp, kind, nums, count):
    s = sc(comp)
    assert (s.kind, s.nums, s.count) == (kind, nums, count)


def test_inec_2027_hints():
    assert split_hint("BURRA (NINGI II)") == ("BURRA", "NINGI II")
    assert split_hint("BALOGUN/OJUMU /OFFA I") == ("BALOGUN/OJUMU", "OFFA I")
    assert split_hint("LAFIAGI / EDU") == ("LAFIAGI", "EDU")
    assert split_hint("DAWAKIN TOFA") == ("DAWAKIN TOFA", "")


def state(lgas):
    return {"name": "ABIA", "lgas": [{"name": n, "wards": [{"code": f"01/{i:02d}/{w:02d}", "name": f"{n} W{w}"} for w in range(1, k + 1)]}
                                     for i, (n, k) in enumerate(lgas, start=1)]}


def run(lgas, workbook, list_names, overrides=None):
    st = state(lgas)
    ix = {"ABIA": StateGeoIndex(st, {})}
    return reconcile({"ABIA": list_names}, workbook, ix, {}, overrides)


def wb(name, lga, wards, code):
    s = sc("Ward 01", name, code)
    s.lgas, s.lga_by, s.wards = [lga], "name", set(wards)
    return s


def test_same_roster_uses_the_workbook_split():
    w = [wb("ALPHA EAST", "ALPHA", {"01/01/01", "01/01/02"}, "SC/1/AB"), wb("ALPHA WEST", "ALPHA", {"01/01/03"}, "SC/2/AB")]
    lst, wards, notes, errors = run([("ALPHA", 3)], w, ["ALPHA EAST", "ALPHA WEST"])
    assert errors == [] and wards == {"01/01/01": ["ALPHA EAST"], "01/01/02": ["ALPHA EAST"], "01/01/03": ["ALPHA WEST"]}


def test_a_new_2027_constituency_leaves_the_lgas_wards_unresolved():
    w = [wb("ALPHA", "ALPHA", {"01/01/01", "01/01/02"}, "SC/1/AB")]
    lst, wards, notes, errors = run([("ALPHA", 2)], w, ["ALPHA", "ALPHA II"])
    assert wards and all(v == ["ALPHA", "ALPHA II"] for v in wards.values())
    assert any("differ from the 2011 workbook" in n for n in notes)


def test_a_constituency_the_split_leaves_without_wards_keeps_the_lga_unresolved():
    w = [wb("ALPHA I", "ALPHA", set(), "SC/1/AB"), wb("ALPHA II", "ALPHA", {"01/01/01", "01/01/02"}, "SC/2/AB")]
    lst, wards, notes, errors = run([("ALPHA", 2)], w, ["ALPHA I", "ALPHA II"])
    assert all(v == ["ALPHA I", "ALPHA II"] for v in wards.values())


def test_inec_2027_hint_beats_the_workbook_reading():
    w = [wb("BURRA", "ZETA", {"01/02/01"}, "SC/1/AB")]
    lst, wards, notes, errors = run([("NINGI", 1), ("ZETA", 1)], w, ["BURRA (NINGI II)"])
    assert lst[0].lgas == ["NINGI"] and any("The 2027 list is followed" in n for n in notes)


def test_a_weak_placement_never_splits_wards():
    a = wb("ALPHA EAST", "ALPHA", {"01/01/01"}, "SC/1/AB")
    a.lga_by = "ward-number partition"
    b = wb("ALPHA WEST", "ALPHA", {"01/01/02"}, "SC/2/AB")
    lst, wards, notes, errors = run([("ALPHA", 2)], [a, b], ["ALPHA EAST", "ALPHA WEST"])
    assert all(v == ["ALPHA EAST", "ALPHA WEST"] for v in wards.values())


def test_reviewed_reading_places_a_constituency():
    lst, wards, notes, errors = run([("ALPHA", 1), ("BETA", 1)], [], ["GAMMA"], {"ABIA|GAMMA": {"lgas": ["BETA"], "reading": "r"}})
    assert lst[0].lgas == ["BETA"] and lst[0].lga_by == "reviewed reading" and wards == {"01/02/01": ["GAMMA"]}



class _Cell:
    def __init__(self, v):
        self.value = v


class _Sheet:
    def __init__(self, rows):
        self.rows = rows
        self.nrows = len(rows)

    def row(self, r):
        return [_Cell(v) for v in self.rows[r]]


def _read(monkeypatch, rows):
    import xlrd

    from ballot_pipeline.state_constituencies import read_sheet

    class _Book:
        def sheet_by_name(self, name):
            assert name == "STATE CONST."
            return _Sheet(rows)

    monkeypatch.setattr(xlrd, "open_workbook", lambda path: _Book())
    return read_sheet("unused.xls")


HEAD = [["1.0", "2.0", "3.0", "4.0"], ["S/N", "NAME OF STATE CONSTITUENCY", "CODE", "COMPOSITION"]]


def test_read_sheet_reads_codes_printed_without_the_second_slash(monkeypatch):
    rows = HEAD + [["376.0", "BILLIRI WEST", "SC/076GM", "Ward 01, 02 & 07 – 10"], ["377.0", "BILLIRI EAST", "SC/377/GM", "The entire LGA"]]
    assert [s.code for s in _read(monkeypatch, rows)] == ["SC/076/GM", "SC/377/GM"]


def test_read_sheet_fails_on_an_unreadable_code(monkeypatch):
    with pytest.raises(ValueError, match="unreadable code"):
        _read(monkeypatch, HEAD + [["378.0", "BROKEN", "SC-12-GM", "The entire LGA"]])


def test_read_sheet_keeps_both_rows_of_a_code_inec_printed_twice(monkeypatch):
    rows = HEAD + [["251.0", "IKA SOUTH", "SC/252/DT", "The entire LGA"], ["252.0", "ISOKO NORTH", "SC/252/DT", "The entire LGA"]]
    got = _read(monkeypatch, rows)
    assert [(s.name, s.code) for s in got] == [("IKA SOUTH", "SC/252/DT@row3"), ("ISOKO NORTH", "SC/252/DT@row4")]
