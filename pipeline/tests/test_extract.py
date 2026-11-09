"""Extraction against INEC's real files (fetched, hashed, not committed). Each test pins a case seen in the wild."""

from ballot_pipeline.extract import count_sn_independently, extract_pdf


def test_watermark_glyphs_never_reach_cells(raw_source):
    rows = extract_pdf(str(raw_source("senate-abia")), "senate-abia")
    for r in rows:
        for text in (r.candidate.name, r.constituency, r.candidate.qualifications, r.remarks):
            assert all(len(tok) > 1 or tok in {"A", "&"} or not tok.isalpha() for tok in text.split()), text


def test_wrapped_names_and_qualifications_are_joined(raw_source):
    rows = extract_pdf(str(raw_source("senate-abia")), "senate-abia")
    first = rows[0]
    assert (first.sn, first.party, first.candidate.name, first.candidate.age) == (1, "A", "EMERUWA IKENNA CHIGOZIE", "48")
    assert first.candidate.qualifications.endswith("leaving certificate)")


def test_presidential_ticket_rows_split_into_candidate_and_running_mate(raw_source):
    rows = extract_pdf(str(raw_source("president")), "president", ticket=True)
    aa = next(r for r in rows if r.party == "AA")
    assert (aa.candidate.name, aa.candidate.age) == ("RUFAI ADEKUNLE OMO-AJE", "71")
    assert (aa.running_mate.name, aa.running_mate.age) == ("SHEHU HUSSAINI", "56")
    assert aa.candidate.position == "Presidential" and aa.running_mate.position == "Vice-Presidential"


def test_court_order_row_keeps_inec_remark_and_empty_names(raw_source):
    rows = extract_pdf(str(raw_source("president")), "president", ticket=True)
    a = next(r for r in rows if r.party == "A")
    assert a.candidate.name == "" and a.running_mate.name == "" and a.remarks == "COURT ORDER"


def test_slash_wrapped_constituency_rejoined_without_space(raw_source):
    rows = extract_pdf(str(raw_source("house-adamawa")), "house-adamawa")
    assert {r.constituency for r in rows if r.constituency.startswith("Yola")} == {"Yola North/Yola South/Girei"}


def test_mixed_case_state_is_normalised(raw_source):
    rows = extract_pdf(str(raw_source("senate-cross-river")), "senate-cross-river")
    assert {r.state for r in rows} == {"CROSS RIVER"}


def test_independent_count_agrees(raw_source):
    path = raw_source("house-abia")
    assert len(count_sn_independently(str(path))) == len(extract_pdf(str(path), "house-abia"))
