"""The one place candidate order is decided (the working rules §1, D-011, owner decision D-042).

Ballot-paper order (`ballot_position`): until INEC publishes a 2027 ballot order, candidates are ordered alphabetically by
party acronym using a plain uppercase string comparison, so "A" < "AA" < "AAC" < "ADC" < "ADP" < "APC" < "APGA" < "APM".
Nothing else (name, age, incumbency, INEC serial number) can influence it.

Display order (D-042): the same five parties in every race nationwide, chosen by one published measure recorded with its
sources in data/overrides/first-group.yaml, come first, alphabetical by acronym; every other party follows in ballot-paper
order. A party of the five with no candidate in a race is simply absent from that race's first group.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")

ORDER_RULE = ("first group (D-042) alphabetical by party acronym, then all other parties in ballot order: "
              "alphabetical by party acronym, as on INEC's 31 Oct 2026 final lists (D-011)")


def acronym_key(acronym: str) -> str:
    return acronym.strip().upper()


def order_candidates(items: Iterable[T], party_of: Callable[[T], str]) -> list[T]:
    """Return items in ballot order. Raises if two items share a party, since a race has one candidate per party."""
    items = list(items)
    keys = [acronym_key(party_of(i)) for i in items]
    if len(set(keys)) != len(keys):
        raise ValueError(f"duplicate party in race: {sorted(keys)}")
    return [i for _, i in sorted(zip(keys, items), key=lambda kv: kv[0])]


def display_order(items: Iterable[T], party_of: Callable[[T], str], first_group: Iterable[str]) -> list[tuple[T, str]]:
    """Items with their group ("first" or "rest"): the first group alphabetical by acronym, then the rest in ballot order."""
    ballot = order_candidates(items, party_of)
    first = {acronym_key(p) for p in first_group}
    return [(i, "first") for i in ballot if acronym_key(party_of(i)) in first] + [(i, "rest") for i in ballot if acronym_key(party_of(i)) not in first]
