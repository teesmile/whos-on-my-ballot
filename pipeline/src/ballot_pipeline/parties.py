"""The registered political parties, read from INEC's /parties page (acronym and full name only)."""

from __future__ import annotations

import html
import re


def parse_parties(page_html: str) -> list[dict]:
    parties = []
    for slug, body in re.findall(r'<a href="/parties/([a-z0-9-]+)"(.*?)</a>', page_html, re.S):
        parts = [p.strip() for p in html.unescape(re.sub(r"<[^>]+>", "|", body.split(">", 1)[1])).split("|")]
        parts = [p for p in parts if p]
        if len(parts) < 2:
            raise ValueError(f"party card {slug!r} has no acronym/name")
        acronym, name = parts[0], parts[1]
        if not re.fullmatch(r"[A-Z]{1,5}", acronym):
            raise ValueError(f"party card {slug!r}: unexpected acronym {acronym!r}")
        parties.append({"acronym": acronym, "name": name})
    if len({p["acronym"] for p in parties}) != len(parties):
        raise ValueError("duplicate party acronyms on INEC's /parties page")
    return sorted(parties, key=lambda p: p["acronym"])
