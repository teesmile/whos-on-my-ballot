"""Polite, resumable crawl of INEC's Polling Unit Locator (D-016).

The locator page (https://cvr.inecnigeria.org/pu) fills its drop-downs from public JSON endpoints:

    /PublicApi/lgas/1/Search?data[Search][state_id]=<id>
    /PublicApi/wards/1/Search?data[Search][local_government_id]=<id>
    /PublicApi/pus/1/Search?data[Search][registration_area_id]=<id>

Each returns ``[{"0": "--SELECT--", "selected": "0", "<internal id>": "<code> - <name>", ...}]``.
Every response is cached verbatim under ``raw/pu/`` so the crawl can resume and the parse can run offline.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
from datetime import UTC, datetime
from pathlib import Path

from .http import get as _get
from .paths import PU_RAW_DIR

BASE = "https://cvr.inecnigeria.org"
LOCATOR_URL = f"{BASE}/pu"

ENDPOINTS = {
    "lgas": ("lgas/1/Search", "data[Search][state_id]"),
    "wards": ("wards/1/Search", "data[Search][local_government_id]"),
    "pus": ("pus/1/Search", "data[Search][registration_area_id]"),
}

def parse_options(payload: list[dict]) -> list[tuple[str, str]]:
    """Return ``[(internal_id, label)]`` from a locator response, dropping the placeholder entries."""
    if not isinstance(payload, list) or len(payload) != 1 or not isinstance(payload[0], dict):
        raise ValueError(f"unexpected locator payload shape: {str(payload)[:200]}")
    out = []
    for key, label in payload[0].items():
        if key in ("0", "selected"):
            continue
        out.append((key, label))
    return out


def parse_states(page_html: str) -> list[tuple[str, str]]:
    """``[(internal_id, label)]`` for the 37 states from the locator page's state <select>."""
    block = re.search(r'<select name="data\[Search\]\[state_id\]".*?</select>', page_html, re.S)
    if not block:
        raise ValueError("state <select> not found on locator page")
    opts = re.findall(r'<option value="(\d+)">([^<]+)</option>', block.group(0))
    return [(v, html.unescape(label).strip()) for v, label in opts]


def _cached(kind: str, parent_id: str) -> Path:
    return PU_RAW_DIR / kind / f"{parent_id}.json"


def fetch_children(kind: str, parent_id: str) -> list[tuple[str, str]]:
    path = _cached(kind, parent_id)
    if not path.exists():
        endpoint, param = ENDPOINTS[kind]
        url = f"{BASE}/PublicApi/{endpoint}?" + urllib.parse.urlencode({param: parent_id})
        body = _get(url)
        payload = json.loads(body)  # fail loudly on non-JSON rather than cache junk
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return parse_options(json.loads(path.read_bytes()))


def crawl(log=print) -> dict:
    PU_RAW_DIR.mkdir(parents=True, exist_ok=True)
    page = PU_RAW_DIR / "locator.html"
    if not page.exists():
        page.write_bytes(_get(LOCATOR_URL))
    meta_path = PU_RAW_DIR / "crawl.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {"started_at": datetime.now(UTC).isoformat()}

    states = parse_states(page.read_text(encoding="utf-8", errors="replace"))
    n_lga = n_ward = n_pu = 0
    for s_id, s_label in states:
        for l_id, _ in fetch_children("lgas", s_id):
            n_lga += 1
            for w_id, _ in fetch_children("wards", l_id):
                n_ward += 1
                n_pu += len(fetch_children("pus", w_id))
        log(f"{s_label}: cumulative lgas={n_lga} wards={n_ward} pus={n_pu}")

    meta.update(
        finished_at=datetime.now(UTC).isoformat(),
        source_url=LOCATOR_URL,
        counts={"states": len(states), "lgas": n_lga, "wards": n_ward, "pus": n_pu},
    )
    meta_path.write_text(json.dumps(meta, indent=2))
    return meta
