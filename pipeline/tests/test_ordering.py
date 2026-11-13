import pytest

from ballot_pipeline.ordering import display_order, order_candidates, state_five


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


NATIONAL = {"ADC": 1475, "APC": 1489, "NDC": 1419, "PDP": 1313, "SDP": 1273}


def test_a_state_won_by_one_of_the_five_keeps_the_five():
    assert state_five(NATIONAL, {"APC": 40, "PDP": 2}, "PDP") == (["ADC", "APC", "NDC", "PDP", "SDP"], None)


def test_the_winner_replaces_the_party_of_the_five_with_fewest_candidates_in_the_state():
    in_state = {"ADC": 40, "APC": 41, "NDC": 39, "PDP": 33, "SDP": 38, "LP": 36}
    assert state_five(NATIONAL, in_state, "LP") == (["ADC", "APC", "LP", "NDC", "SDP"], "PDP")


def test_a_winner_fielding_no_candidates_in_the_state_does_not_join():
    assert state_five(NATIONAL, {"ADC": 3}, "LP") == (["ADC", "APC", "NDC", "PDP", "SDP"], None)


def test_a_party_of_the_five_with_no_candidates_in_the_state_counts_as_fewest():
    in_state = {"ADC": 5, "APC": 5, "NDC": 5, "SDP": 5, "A": 4}
    assert state_five(NATIONAL, in_state, "A") == (["A", "ADC", "APC", "NDC", "SDP"], "PDP")


def test_a_tie_for_fewest_is_broken_by_the_lower_national_count():
    in_state = {"ADC": 9, "APC": 9, "NDC": 9, "PDP": 7, "SDP": 7, "NNPP": 8}
    assert state_five(NATIONAL, in_state, "NNPP") == (["ADC", "APC", "NDC", "NNPP", "PDP"], "SDP")


def test_a_tie_on_both_counts_fails():
    with pytest.raises(ValueError):
        state_five({**NATIONAL, "SDP": 1313}, {"ADC": 5, "APC": 5, "NDC": 5, "PDP": 1, "SDP": 1, "LP": 3}, "LP")
