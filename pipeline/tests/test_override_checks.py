"""Review 5: every reviewed State Assembly reading must cite a hashed INEC source, and the citation must hold."""
from ballot_pipeline.override_checks import check_sha_overrides
from ballot_pipeline.state_constituencies import SC

HASHED = {"inec-constituencies-workbook", "sha-2026-10-10"}
UNITS = [SC("SC/120/BA", "BAUCHI", "HARDAWA", "Ward 02 & 09 – 12", 229)]
WARDS = {"05/14/07": ("BAUCHI", "MISAU"), "05/16/04": ("BAUCHI", "SHIRA")}
PRINTED = {("KOGI", "IGALA OGWA"): {(399, 262)}}
GOOD_SC = {"source_id": "inec-constituencies-workbook", "row": 229, "wards": ["05/14/07"], "workbook_text": "Ward 02 & 09 – 12",
           "lgas": ["MISAU"], "reading": "Misau is the only Bauchi LGA with a ward named HARDAWA."}
GOOD_LGA = {"source_id": "sha-2026-10-10", "page": 399, "sn": 262, "lgas": ["IDAH"], "reading": "r"}


def run(sc=None, lga=None, wards=None):
    return check_sha_overrides({"SC/120/BA": sc} if sc else {}, {"KOGI|IGALA OGWA": lga} if lga else {}, HASHED, UNITS,
                               wards or WARDS, PRINTED)


def test_sourced_readings_pass():
    assert run(GOOD_SC, GOOD_LGA, {**WARDS}) == []


def test_a_reading_without_a_source_fails():
    assert any("must cite" in e for e in run({k: v for k, v in GOOD_SC.items() if k != "source_id"}))
    assert any("must cite" in e for e in run(lga={k: v for k, v in GOOD_LGA.items() if k != "source_id"}))


def test_a_misquoted_or_misplaced_workbook_row_fails():
    assert any("quotes" in e for e in run({**GOOD_SC, "workbook_text": "The entire LGA"}))
    assert any("cites row" in e for e in run({**GOOD_SC, "row": 230}))


def test_evidence_wards_must_lie_in_the_chosen_lga():
    assert any("evidence ward 05/16/04" in e for e in run({**GOOD_SC, "wards": ["05/16/04"]}))
    assert any("evidence ward 99/99/99" in e for e in run({**GOOD_SC, "wards": ["99/99/99"]}))


def test_redirecting_a_race_needs_inec_to_print_it_where_cited():
    assert any("does not print" in e for e in run(lga={**GOOD_LGA, "sn": 263}))


def test_ward_spellings_must_cite_and_match_inecs_files():
    """Review 5b: a spelling that points at another ward, or cites nothing, fails the build."""
    from ballot_pipeline.override_checks import check_ward_spellings

    unit = SC("SC/100/AN", "ANAMBRA", "NNEWI", "TRANSNKISSI, WOLIWO LAYOUT", 158)
    unit.lgas = ["ONITSHA SOUTH"]
    info = {"04/17/12": ("ANAMBRA", "ONITSHA SOUTH", "TRANS NKISI"), "04/17/13": ("ANAMBRA", "ONITSHA SOUTH", "OTHER"),
            "04/18/01": ("ANAMBRA", "OYI", "TRANS NKISI")}
    good = {"source_id": "inec-constituencies-workbook", "row": 158, "locator_ward": "TRANS NKISI", "code": "04/17/12"}

    def run(entry, frag="TRANSNKISSI"):
        return check_ward_spellings({"SC/100/AN": {frag: entry}}, {"SC/100/AN": unit}, HASHED, info)

    assert run(good) == []
    assert any("must cite" in e for e in run({k: v for k, v in good.items() if k != "source_id"}))
    assert any("cites row" in e for e in run({**good, "row": 159}))
    assert any("does not contain" in e for e in run(good, frag="ELSEWHERE"))
    assert any("not 'TRANS NKISI'" in e for e in run({**good, "code": "04/17/13"}))
    assert any("outside the constituency" in e for e in run({**good, "code": "04/18/01"}))
