import pytest

from ballot_pipeline.ordering import display_order, order_candidates


def test_orders_by_acronym_as_plain_uppercase_strings():
    parties = ["PDP", "A", "APGA", "AAC", "zlp", "AA", "APC", "ADC", "ADP", "APM"]
    assert order_candidates(parties, lambda p: p) == ["A", "AA", "AAC", "ADC", "ADP", "APC", "APGA", "APM", "PDP", "zlp"]


def test_result_does_not_depend_on_input_order():
    items = [{"party": p, "name": n} for p, n in [("LP", "x"), ("APC", "y"), ("A", "z")]]
    assert order_candidates(items, lambda i: i["party"]) == order_candidates(items[::-1], lambda i: i["party"])


def test_ignores_everything_but_the_party():
    items = [{"party": "PDP", "age": 30}, {"party": "APC", "age": 90}]
    assert [i["party"] for i in order_candidates(items, lambda i: i["party"])] == ["APC", "PDP"]


def test_two_candidates_from_one_party_is_an_error():
    with pytest.raises(ValueError):
        order_candidates(["APC", "apc"], lambda p: p)


def test_display_order_puts_the_first_group_first_alphabetically_then_the_rest_in_ballot_order():
    parties = ["ZLP", "PDP", "A", "APC", "LP", "ADC", "NNPP", "YPP"]
    got = display_order(parties, lambda p: p, ["PDP", "LP", "APC", "NNPP", "ADC"])
    assert got == [("ADC", "first"), ("APC", "first"), ("LP", "first"), ("NNPP", "first"), ("PDP", "first"),
                   ("A", "rest"), ("YPP", "rest"), ("ZLP", "rest")]


def test_a_first_group_party_with_no_candidate_is_simply_absent():
    got = display_order(["SDP", "APC", "A"], lambda p: p, ["PDP", "APC", "LP", "NNPP", "ADC"])
    assert got == [("APC", "first"), ("A", "rest"), ("SDP", "rest")]


def test_display_order_ignores_input_order():
    items = ["YPP", "APC", "A", "PDP"]
    assert display_order(items, lambda p: p, ["PDP", "APC"]) == display_order(items[::-1], lambda p: p, ["APC", "PDP"])
