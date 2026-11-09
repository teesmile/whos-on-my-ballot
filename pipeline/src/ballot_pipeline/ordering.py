"""The one place candidate order is decided (the working rules §1, D-011).

Until INEC publishes a 2027 ballot order, candidates are ordered alphabetically by party acronym using a
plain uppercase string comparison, so "A" < "AA" < "AAC" < "ADC" < "ADP" < "APC" < "APGA" < "APM".
Nothing else (name, age, incumbency, INEC serial number) can influence the result.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")

ORDER_RULE = "alphabetical by party acronym (as on INEC's 31 Oct 2026 final lists; D-011)"


def acronym_key(acronym: str) -> str:
    return acronym.strip().upper()


def order_candidates(items: Iterable[T], party_of: Callable[[T], str]) -> list[T]:
    """Return items in ballot order. Raises if two items share a party, since a race has one candidate per party."""
    items = list(items)
    keys = [acronym_key(party_of(i)) for i in items]
    if len(set(keys)) != len(keys):
        raise ValueError(f"duplicate party in race: {sorted(keys)}")
    return [i for _, i in sorted(zip(keys, items), key=lambda kv: kv[0])]
