import pytest

from ballot_pipeline.crawl_pu import parse_options, parse_states
from ballot_pipeline.geo import (
    GeoError, WorkbookUnit, _split_label, fragments, key, match_fragments, parse_delimitation_code, resolve_composition,
)

LGAS = ["ISIALA NGWA NORTH", "ISIALA NGWA SOUTH", "ASKIRA / UBA", "BAYO", "ESIT EKET (UQUO)", "UKWA EAST", "UKWA WEST",
        "LAGOS ISLAND", "IKA NORTH- EAST", "IKA - SOUTH"]


def unit(composition, name="X", kind="FC"):
    return WorkbookUnit(kind, "FC/001/AB", "ABIA", name, composition, 1)


def test_fragments_expand_shared_prefix_and_drop_filler():
    assert fragments("The entire Geographical Areas of Isiala Ngwa North and South L.G.As") == [
        "ISIALA NGWA NORTH", "ISIALA NGWA SOUTH"]
    assert fragments("The entire Geographical Area of the present Oru West L.G.S") == ["ORU WEST"]


def test_slash_inside_an_lga_name_is_rejoined():
    found, unmatched = match_fragments(fragments("ASKIRA/UBA, BAYO"), LGAS, {})
    assert found == ["ASKIRA / UBA", "BAYO"] and unmatched == []


def test_parenthetical_in_locator_name_is_optional():
    assert match_fragments(["ESIT EKET"], LGAS, {})[0] == ["ESIT EKET (UQUO)"]


def test_reviewed_spelling_is_used_and_unknown_text_is_reported():
    found, unmatched = match_fragments(["ISIUKWUATO", "NOWHERE"], ["ISUIKWUATO"], {key("ISIUKWUATO"): "ISUIKWUATO"})
    assert found == ["ISUIKWUATO"] and unmatched == ["NOWHERE"]


def test_split_lga():
    u = unit("Part of Lagos Island LGA")
    resolve_composition(u, LGAS, {}, {})
    assert u.split_lga == "LAGOS ISLAND" and u.resolved_by == "split"


def test_name_used_when_composition_unreadable():
    u = unit("The entire Geographical Area of Ika North and Ika South LGAs", name="Ika North East/Ika South")
    resolve_composition(u, LGAS, {}, {})
    assert u.lgas == ["IKA NORTH- EAST", "IKA - SOUTH"] and u.resolved_by == "name"


def test_name_and_composition_disagreeing_is_an_error():
    u = unit("The entire Geographical Areas of Ukwa East and East L.G.As", name="Ukwa East/Ukwa West")
    with pytest.raises(GeoError, match="disagree|reads as"):
        resolve_composition(u, LGAS, {}, {})


def ov(lgas, text="anything", row=1):
    return {"FC/001/AB": {"lgas": lgas, "workbook_text": text, "row": row}}


def test_override_wins_and_must_name_real_lgas():
    u = unit("anything")
    resolve_composition(u, LGAS, ov(["UKWA EAST", "UKWA WEST"]), {})
    assert u.lgas == ["UKWA EAST", "UKWA WEST"] and u.resolved_by == "override"
    with pytest.raises(GeoError):
        resolve_composition(unit("anything"), LGAS, ov(["ATLANTIS"]), {})


def test_override_is_rejected_when_workbook_text_or_row_changes():
    with pytest.raises(GeoError, match="review it again"):
        resolve_composition(unit("Ukwa East and Ukwa West"), LGAS, ov(["UKWA EAST", "UKWA WEST"], text="Ukwa East and East"), {})
    with pytest.raises(GeoError, match="review it again"):
        resolve_composition(unit("anything"), LGAS, ov(["UKWA EAST"], row=99), {})


@pytest.mark.parametrize("text,code", [
    ("24/15/03/012", "24/15/03/012"), ("24-15-03-012", "24/15/03/012"), ("24 15 03 012", "24/15/03/012"),
    ("24-15-3-12", "24/15/03/012"), (" 01/01/01/001 ", "01/01/01/001"), ("37/06/10/045", "37/06/10/045"),
    ("24.15.03.012", "24/15/03/012"), ("241503012", "24/15/03/012"), ("24 15-03/012", "24/15/03/012"),
    ("24\u201315\u201303\u2013012", "24/15/03/012"), ("24,15,03,012", "24/15/03/012"),
])
def test_delimitation_code_normalises(text, code):
    assert parse_delimitation_code(text) == code


@pytest.mark.parametrize("text", ["", "24/15/03", "38/01/01/001", "00/01/01/001", "24/15/03/0", "24/15/03/1234",
                                  "AB/15/03/012", "24/15/03/012/9", "24151503012", "24150312",
                                  "2415030120", "381503012"])
def test_delimitation_code_rejects(text):
    assert parse_delimitation_code(text) is None


def test_locator_payload_and_labels():
    payload = [{"0": "--SELECT--", "selected": "0", "17": "01 - ABA NORTH", "18": "02 - ABA SOUTH"}]
    assert parse_options(payload) == [("17", "01 - ABA NORTH"), ("18", "02 - ABA SOUTH")]
    assert _split_label("001 - RAILWAY QUARTERS - RAILWAY QUARTERS I", 3) == ("001", "RAILWAY QUARTERS - RAILWAY QUARTERS I")
    with pytest.raises(GeoError):
        _split_label("ABA NORTH", 2)
    with pytest.raises(ValueError):
        parse_options({"oops": 1})


def test_locator_states_select():
    html = ('<select name="data[Search][state_id]" class="x"><option value="">SELECT STATE</option>'
            '<option value="1">01 - ABIA</option><option value="15">37 - FCT</option></select>')
    assert parse_states(html) == [("1", "01 - ABIA"), ("15", "37 - FCT")]
