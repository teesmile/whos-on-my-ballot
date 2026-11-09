"""The /election-day/ page's statements (data/overrides/election-day.yaml), each checked against INEC's fetched page."""

from __future__ import annotations

import json
import re

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
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", e["date"]):
            errors.append(f"election-day {e['id']}: bad date {e['date']!r}")
    check(data["hours"]["source_id"], data["hours"]["quotes"], "hours")
    for i, s in enumerate(data["steps"], start=1):
        if not s.get("quotes"):
            errors.append(f"election-day step {i}: no INEC quote")
        check(data["steps_source_id"], s.get("quotes") or [], f"step {i}")

    (GENERATED_DIR / "election-day.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
    return errors
