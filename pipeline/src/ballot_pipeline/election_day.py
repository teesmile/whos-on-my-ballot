"""The /election-day/ page's statements (data/overrides/election-day.yaml), each checked against INEC's fetched page."""

from __future__ import annotations

import json
import re
from datetime import date, time

import yaml

from .paths import DATA_DIR, GENERATED_DIR, RAW_DIR
from .quotes import page_text, quote_on_page

FILE = DATA_DIR / "overrides" / "election-day.yaml"


def build(sources: dict[str, dict]) -> list[str]:
    """Check every quote against the fetched INEC page and write data/generated/election-day.json. Returns errors."""
    data = yaml.safe_load(FILE.read_text())
    errors: list[str] = []
    texts: dict[str, str] = {}

    def check(source_id: str, quotes: list[str], where: str) -> None:
        src = sources.get(source_id)
        if not src or "local_file" not in src:
            errors.append(f"election-day {where}: source {source_id!r} is not a fetched source")
            return
        if source_id not in texts:
            texts[source_id] = page_text((RAW_DIR / src["local_file"]).read_bytes())
        for q in quotes:
            if not quote_on_page(q, texts[source_id]):
                errors.append(f"election-day {where}: {q!r} is not on {src['file_url']}")

    for e in data["elections"]:
        check(e["source_id"], e["quotes"], e["id"])
        try:
            day = date.fromisoformat(e["date"])
        except ValueError:
            errors.append(f"election-day {e['id']}: {e['date']!r} is not a real date")
            continue
        # INEC's calendar writes "January 16, 2027": the date we use must be the date INEC's quoted text gives.
        inec_form = f"{day:%B} {day.day}, {day.year}"
        if not any(inec_form in q for q in e["quotes"]):
            errors.append(f"election-day {e['id']}: date {e['date']} does not match its INEC quote (expected {inec_form!r})")
    check(data["hours"]["source_id"], data["hours"]["quotes"], "hours")
    times = {}
    for name in ("open", "close"):
        try:
            times[name] = time.fromisoformat(data["hours"][name])
        except ValueError:
            errors.append(f"election-day hours: {name} {data['hours'][name]!r} is not a valid time")
            continue
        t = times[name]
        spoken = f"{(t.hour + 11) % 12 + 1}:{t.minute:02d} {'AM' if t.hour < 12 else 'PM'}"
        if not any(spoken in q for q in data["hours"]["quotes"]):
            errors.append(f"election-day hours: {name} {data['hours'][name]} does not match its INEC quote (expected {spoken!r})")
    if len(times) == 2 and not times["open"] < times["close"]:
        errors.append("election-day hours: polls must open before they close")
    if len({e["date"] for e in data["elections"]}) != len(data["elections"]):
        errors.append("election-day: two elections share a date")
    for i, s in enumerate(data["steps"], start=1):
        if not s.get("quotes"):
            errors.append(f"election-day step {i}: no INEC quote")
        check(data["steps_source_id"], s.get("quotes") or [], f"step {i}")

    (GENERATED_DIR / "election-day.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    return errors
