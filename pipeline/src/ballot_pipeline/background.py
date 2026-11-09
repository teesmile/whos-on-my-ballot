"""Presidential background (D-013): read data/overrides/presidential-background.yaml and enforce its rules.

Rules, all checked here so the build fails rather than publishing a breach:
- all or none: every named presidential candidate and running mate has a record, or no one does;
- the same two fields for everyone (public offices, party history);
- every entry has at least one independent citation with a verbatim quote; Wikipedia, wikis, social media,
  blogs and the candidate's or party's own sites are never sources;
- entries use flat wording with no evaluative words;
- a person with entries has an identity citation tying them to their 2027 ticket.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import yaml

from .models import Background
from .paths import DATA_DIR

FILE = DATA_DIR / "overrides" / "presidential-background.yaml"

BANNED_HOSTS = re.compile(
    r"(^|\.)(wikipedia\.org|wikimedia\.org|wikiwand\.com|wikidata\.org|fandom\.com|facebook\.com|fb\.com|x\.com|"
    r"twitter\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|medium\.com|substack\.com|"
    r"blogspot\.com|wordpress\.com|kemifilani\.ng|nigerianeye\.com|headtopics\.com|naijanews\.com|amebo9jafeed\.com\.ng|"
    r"megastarmagazine\.com)$"
)
# Words that evaluate rather than state. Entries are offices and party facts only.
EVALUATIVE = re.compile(
    r"\b(prominent|popular|renowned|famous|influential|controversial|successful|notable|respected|veteran|seasoned|"
    r"leading|powerful|strong|weak|best|worst|great|charismatic|embattled|disgraced|celebrated|acclaimed|"
    r"frontrunner|front-runner|favourite|favorite|beloved|notorious|alleged|allegedly|corrupt|scandal)\b",
    re.I,
)


def load(people: dict[tuple[str, str], str]) -> tuple[dict[tuple[str, str], Background], list[str]]:
    """``people`` maps (candidate_id, role) -> INEC name for every named presidential candidate and running mate.

    Returns (backgrounds, errors). An absent or empty file means "none": no presidential background is shown.
    """
    if not FILE.exists():
        return {}, []
    raw = yaml.safe_load(FILE.read_text()) or {}
    records = raw.get("people") or []
    if not records:
        return {}, []
    errors: list[str] = []
    out: dict[tuple[str, str], Background] = {}
    for rec in records:
        key = (rec.get("candidate_id"), rec.get("role"))
        if key not in people:
            errors.append(f"background: {key} is not a named presidential candidate or running mate")
            continue
        if rec.get("inec_name") != people[key]:
            errors.append(f"background {key}: inec_name {rec.get('inec_name')!r} differs from INEC's {people[key]!r}")
        try:
            bg = Background(identity=rec.get("identity"), public_offices=rec.get("public_offices") or [],
                            party_history=rec.get("party_history") or [], researched=raw["researched"])
        except Exception as e:  # pydantic validation error: report it and keep checking the rest
            errors.append(f"background {key}: {e}")
            continue
        entries = bg.public_offices + bg.party_history
        if entries and bg.identity is None:
            errors.append(f"background {key}: entries without an identity citation")
        cites = ([bg.identity] if bg.identity else []) + [c for e in entries for c in e.citations]
        for c in cites:
            host = (urlparse(c.url).hostname or "").lower()
            if BANNED_HOSTS.search(host):
                errors.append(f"background {key}: {host} is not an allowed source")
        for e in entries:
            if EVALUATIVE.search(e.text):
                errors.append(f"background {key}: evaluative wording in {e.text!r}")
            # Years only as the source states them: every year in the entry must appear in one of its quotes.
            for year in re.findall(r"\b(?:19|20)\d{2}\b", e.text):
                if not any(year in c.quote for c in e.citations):
                    errors.append(f"background {key}: year {year} in {e.text!r} is not in any of its quotes")
        if key in out:
            errors.append(f"background {key}: duplicate record")
        out[key] = bg
    missing = sorted(set(people) - set(out))
    if missing:
        errors.append(f"background is all-or-none: {len(missing)} named people have no record, e.g. {missing[:4]}")
    return out, errors
