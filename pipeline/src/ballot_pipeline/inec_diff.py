"""Compare two builds of the candidate data, race by race (owner, 25 Nov 2026, D-102).

Used by the INEC watcher after a changed INEC document has been fetched and rebuilt: what was added, removed and changed
in each race, and whether the change is small and clean enough to publish without the owner (fewer than 25 candidates
changed, every race still has candidates, the totals within 5% of before). Anything else waits for the owner in a pull
request. Offline: reads two copies of data/generated/races/*.json.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

ELECTIONS = ("jan-2027", "feb-2027")
FIELDS = ("name", "age_as_printed", "gender", "pwd", "qualifications")
MAX_CHANGED = 25  # fewer than this many candidates changed
MAX_TOTAL_SHIFT = 0.05  # the totals within 5% of before


@dataclass
class RaceChange:
    race_id: str
    added: list[str] = field(default_factory=list)  # "APC: NAME"
    removed: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)  # "APC: NAME: age 41 -> 42"

    @property
    def count(self) -> int:
        return len(self.added) + len(self.removed) + len(self.changed)


@dataclass
class Diff:
    races: list[RaceChange]
    races_added: list[str]
    races_removed: list[str]
    empty_races: list[str]  # races with no named candidate after the change
    totals: dict[str, tuple[int, int]]  # election -> (before, after) named candidates

    @property
    def changed_candidates(self) -> int:
        return sum(r.count for r in self.races)

    def reasons_to_wait(self) -> list[str]:
        why = []
        if self.changed_candidates >= MAX_CHANGED:
            why.append(f"{self.changed_candidates} candidates changed (publishes on its own only below {MAX_CHANGED})")
        if self.races_added or self.races_removed:
            why.append(f"races added {len(self.races_added)}, removed {len(self.races_removed)}")
        if self.empty_races:
            why.append(f"races left with no candidates: {', '.join(self.empty_races[:5])}")
        for e, (a, b) in self.totals.items():
            if a and abs(b - a) / a > MAX_TOTAL_SHIFT:
                why.append(f"{e} total moved from {a} to {b} (more than 5%)")
        return why

    def summary(self) -> str:
        lines = []
        for e, (a, b) in self.totals.items():
            lines.append(f"{e}: {a} -> {b} named candidates")
        lines.append(f"{self.changed_candidates} candidates changed in {len(self.races)} races")
        for r in self.races[:15]:
            parts = [f"+{x}" for x in r.added] + [f"-{x}" for x in r.removed] + [f"~{x}" for x in r.changed]
            lines.append(f"{r.race_id}: " + "; ".join(parts[:4]) + (f"; and {len(parts) - 4} more" if len(parts) > 4 else ""))
        if len(self.races) > 15:
            lines.append(f"and {len(self.races) - 15} more races")
        for x in self.races_added:
            lines.append(f"new race: {x}")
        for x in self.races_removed:
            lines.append(f"race gone: {x}")
        return "\n".join(lines)


def _load(dir_: Path) -> dict[str, dict]:
    out = {}
    for e in ELECTIONS:
        f = dir_ / f"{e}.json"
        if f.exists():
            for r in json.loads(f.read_text()):
                out[r["id"]] = r
    return out


def _named(r: dict) -> list[dict]:
    return [c for c in r["candidates"] if (c.get("candidate") or {}).get("name")]


def _person_changes(label: str, a: dict | None, b: dict | None) -> list[str]:
    a, b = a or {}, b or {}
    return [f"{label}{k} {a.get(k)!r} -> {b.get(k)!r}" for k in FIELDS if a.get(k) != b.get(k)]


def compare(old_dir: Path, new_dir: Path) -> Diff:
    old, new = _load(old_dir), _load(new_dir)
    races = []
    for rid in sorted(set(old) & set(new)):
        before = {c["party"]: c for c in old[rid]["candidates"]}
        after = {c["party"]: c for c in new[rid]["candidates"]}
        rc = RaceChange(rid)
        for p in sorted(set(after) - set(before)):
            rc.added.append(f"{p}: {(after[p].get('candidate') or {}).get('name') or 'no name'}")
        for p in sorted(set(before) - set(after)):
            rc.removed.append(f"{p}: {(before[p].get('candidate') or {}).get('name') or 'no name'}")
        for p in sorted(set(before) & set(after)):
            a, b = before[p], after[p]
            who = (b.get("candidate") or {}).get("name") or (a.get("candidate") or {}).get("name") or "no name"
            ch = _person_changes("", a.get("candidate"), b.get("candidate")) + _person_changes("running mate ", a.get("running_mate"), b.get("running_mate"))
            if a.get("remarks") != b.get("remarks"):
                ch.append(f"remarks {a.get('remarks')!r} -> {b.get('remarks')!r}")
            if ch:
                rc.changed.append(f"{p}: {who}: " + ", ".join(ch))
        if rc.count:
            races.append(rc)
    totals = {}
    for e in ELECTIONS:
        a = sum(len(_named(r)) for r in old.values() if r["election"] == e)
        b = sum(len(_named(r)) for r in new.values() if r["election"] == e)
        totals[e] = (a, b)
    return Diff(
        races=races,
        races_added=sorted(set(new) - set(old)),
        races_removed=sorted(set(old) - set(new)),
        empty_races=sorted(rid for rid, r in new.items() if not _named(r) and (rid not in old or _named(old[rid]))),
        totals=totals,
    )
