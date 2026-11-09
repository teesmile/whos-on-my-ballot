"""Download every registered source into raw/, hash it, and record provenance in data/generated/sources.json."""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
from datetime import UTC, datetime

import yaml

from .http import get
from .paths import GENERATED_DIR, PU_RAW_DIR, RAW_DIR, SOURCES_YAML
from .states import state_from_slug

DOC_LINK = re.compile(r'href="(/documents/uploads/[^"]+\.pdf)"')
FILE_NAME = re.compile(r"final-?list-(?P<state>[a-z-]+?)-(?:senatorial-districts?|house-of-representatives)\.pdf$")


def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _pdf_dates(path) -> dict:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        meta = pdf.metadata or {}
        return {"pdf_created": meta.get("CreationDate"), "pdf_modified": meta.get("ModDate"), "pages": len(pdf.pages)}


def _record(source_id: str, *, title: str, url: str, body: bytes, suffix: str, **extra) -> dict:
    (RAW_DIR / "docs").mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / "docs" / f"{source_id}{suffix}"
    path.write_bytes(body)
    rec = {
        "source_id": source_id,
        "title": title,
        "file_url": url,
        "local_file": str(path.relative_to(RAW_DIR)),
        "sha256": _sha256(body),
        "bytes": len(body),
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        **extra,
    }
    if suffix == ".pdf":
        rec.update(_pdf_dates(path))
    return rec


def fetch_all(log=print) -> list[dict]:
    reg = yaml.safe_load(SOURCES_YAML.read_text())
    records: list[dict] = []

    for page in reg["press_pages"]:
        html = get(page["url"]).decode("utf-8", errors="replace")
        (RAW_DIR / "pages").mkdir(parents=True, exist_ok=True)
        (RAW_DIR / "pages" / f"{page['id']}.html").write_text(html)
        links = sorted(set(DOC_LINK.findall(html)))
        if len(links) != page["expect_documents"]:
            raise SystemExit(f"{page['id']}: expected {page['expect_documents']} documents, INEC page lists {len(links)}")
        for href in links:
            url = "https://www.inecnigeria.org" + urllib.parse.quote(href)
            name = href.rsplit("/", 1)[1]
            if page["race"] == "president":
                source_id, state = "president", None
            else:
                m = FILE_NAME.search(name)
                if not m:
                    raise SystemExit(f"cannot read state from INEC file name {name!r}")
                state = state_from_slug(m.group("state"))
                source_id = f"{page['race']}-{m.group('state')}"
            records.append(
                _record(source_id, title=page["title"], url=url, body=get(url), suffix=".pdf",
                        page_url=page["url"], race=page["race"], election=page["election"], state=state)
            )
            log(f"fetched {source_id}")

    for doc in reg["documents"]:
        body = get(doc["url"])
        suffix = {"workbook": ".xls", "html": ".html"}.get(doc.get("kind"), ".pdf")
        extra = {k: doc[k] for k in ("race", "election", "use_states", "kind", "archive_url") if k in doc}
        rec = _record(doc["id"], title=doc["title"], url=doc.get("cite_url", doc["url"]), body=body, suffix=suffix,
                      fetched_from=doc["url"], **extra)
        records.append(rec)
        log(f"fetched {doc['id']}")

    pu = reg["polling_units"]
    crawl_meta = PU_RAW_DIR / "crawl.json"
    if crawl_meta.exists():
        meta = json.loads(crawl_meta.read_text())
        records.append({"source_id": pu["id"], "title": pu["title"], "file_url": pu["url"],
                        "retrieved_at": meta.get("finished_at"), "crawl": meta})

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    (GENERATED_DIR / "sources.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    log(f"{len(records)} sources recorded")
    return records
