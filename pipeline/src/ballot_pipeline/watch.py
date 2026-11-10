"""Daily check for INEC changes. Never publishes: it reports, and the GitHub Action opens an issue (Plan, Phase 1)."""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse

import yaml

from .fetch import DOC_LINK
from .http import get
from .paths import GENERATED_DIR, SOURCES_YAML

PRESS_LINK = re.compile(r'href="(/press/[^"#?]+)"')
ANY_DOC_LINK = re.compile(r'href="(/documents/[^"]+\.pdf)"', re.I)  # some INEC files sit outside /documents/uploads/


def watch(summary_path: str | None = "watch-summary.md") -> int:
    reg = yaml.safe_load(SOURCES_YAML.read_text())
    recorded = json.loads((GENERATED_DIR / "sources.json").read_text())
    by_url = {s["file_url"]: s for s in recorded if "sha256" in s}
    changes: list[str] = []

    index = get(reg["index_page"]).decode("utf-8", errors="replace")
    doc_pages = sorted({d["page_url"] for d in reg["documents"] if d.get("page_url", "").startswith("https://www.inecnigeria.org/press/")})
    known_pages = {p["url"].split("inecnigeria.org", 1)[1] for p in reg["press_pages"]} | {u.split("inecnigeria.org", 1)[1] for u in doc_pages}
    for href in sorted(set(PRESS_LINK.findall(index)) - known_pages):
        changes.append(f"New statutory publication on INEC's 2027 page: https://www.inecnigeria.org{href}")
    if re.search(r"ballot\s*(paper|order|specimen)", index, re.I):
        changes.append("INEC's 2027 page mentions the ballot paper: check for a 2027 ballot order (D-011)")

    for page in reg["press_pages"]:
        html = get(page["url"]).decode("utf-8", errors="replace")
        links = {"https://www.inecnigeria.org" + urllib.parse.quote(h) for h in DOC_LINK.findall(html)}
        recorded_links = {u for u, s in by_url.items() if s.get("page_url") == page["url"]}
        for u in sorted(links - recorded_links):
            changes.append(f"{page['id']}: new document {u}")
        for u in sorted(recorded_links - links):
            changes.append(f"{page['id']}: document withdrawn {u}")
        for u in sorted(links & recorded_links):
            if hashlib.sha256(get(u)).hexdigest() != by_url[u]["sha256"]:
                changes.append(f"{page['id']}: document changed {u}")

    # a press page that holds one recorded document (State Assembly list): any other document posted there is new (OI-11, Borno)
    for page_url in doc_pages:
        html = get(page_url).decode("utf-8", errors="replace")
        links = {"https://www.inecnigeria.org" + urllib.parse.quote(h, safe="/()") for h in ANY_DOC_LINK.findall(html)}
        mine = {d["url"] for d in reg["documents"] if d.get("page_url") == page_url}
        for u in sorted(links - mine):
            changes.append(f"{page_url}: new document {u}")
        for u in sorted(mine - links):
            changes.append(f"{page_url}: document no longer linked {u}")

    for doc in reg["documents"]:
        rec = next((s for s in recorded if s["source_id"] == doc["id"]), None)
        if rec and hashlib.sha256(get(doc["url"])).hexdigest() != rec["sha256"]:
            changes.append(f"{doc['id']}: changed at {doc['url']}")

    text = "\n".join(f"- {c}" for c in changes) or "No changes."
    print(text)
    if summary_path:
        with open(summary_path, "w") as f:
            f.write("INEC sources changed since the last committed fetch:\n\n" + text +
                    "\n\nRun `make fetch build verify`, review `data/generated` diffs, and follow the phase routine.\n")
    return 3 if changes else 0
