"""Candidate photos (owner decision D-048): the presidential candidates of the first group (D-042), all of them or none.

Only images whose licence allows reuse (or that a party sends with written permission) are listed, in
data/overrides/photos.yaml, each with its file page, author, licence and a crop box. `ballot-pipeline photos` downloads the
listed originals politely into raw/photos/ and checks each against the hash recorded in the yaml. `ballot-pipeline assets`
(offline) crops every photo the same way (a square head-and-shoulders box from the yaml), writes a page copy and a
share-picture copy, and hands a copy to the sprite. Nothing is shown until the owner has approved every photo (`approved`).
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import yaml

from .http import get
from .paths import DATA_DIR, GENERATED_DIR, RAW_DIR

PHOTOS_YAML = DATA_DIR / "overrides" / "photos.yaml"
PHOTO_RAW_DIR = RAW_DIR / "photos"
PHOTO_DIR = GENERATED_DIR / "photos"
PHOTOS_JSON = GENERATED_DIR / "photos.json"
PAGE = 320  # shown at up to 160 CSS pixels on the candidate page
SHARE = 720  # drawn into the 1080 x 1920 share picture
FIELDS = ("candidate_id", "file_page", "file_url", "sha256", "author", "credit", "licence", "licence_url", "taken", "retrieved", "crop")


def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load() -> dict:
    if not PHOTOS_YAML.exists():
        return {"approved": False, "people": []}
    data = yaml.safe_load(PHOTOS_YAML.read_text()) or {}
    for p in data.get("people") or []:
        missing = [f for f in FIELDS if f not in p]
        if missing:
            raise ValueError(f"photos.yaml: {p.get('candidate_id')} lacks {missing}")
    return {"approved": bool(data.get("approved")), "people": data.get("people") or []}


def _raw(p: dict) -> Path:
    return PHOTO_RAW_DIR / f"{p['candidate_id']}{Path(p['file_url']).suffix.lower()}"


def fetch(log=print) -> None:
    """Download each listed original once, politely, and refuse one whose bytes differ from the recorded hash."""
    PHOTO_RAW_DIR.mkdir(parents=True, exist_ok=True)
    for p in load()["people"]:
        raw = _raw(p)
        if not raw.exists():
            raw.write_bytes(get(p["file_url"]))
        got = _sha256(raw.read_bytes())
        if got != p["sha256"]:
            raise ValueError(f"{p['candidate_id']}: downloaded photo hash {got} is not the one recorded in photos.yaml")
        log(f"photo {p['candidate_id']}: ok")


def build_photos(log=print) -> dict[str, Path]:
    """Writes the cropped copies and photos.json; returns the square crops for the sprite (none until approved)."""
    data = load()
    for old in PHOTO_DIR.glob("*"):
        old.unlink()
    if not data["approved"] or not data["people"]:
        PHOTOS_JSON.write_text(json.dumps({"approved": False, "people": {}}, indent=1) + "\n")
        log("photos: none shown (not approved, or none listed)")
        return {}
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    cells: dict[str, Path] = {}
    people: dict[str, dict] = {}
    for p in data["people"]:
        raw = _raw(p)
        if not raw.exists() or _sha256(raw.read_bytes()) != p["sha256"]:
            raise ValueError(f"{p['candidate_id']}: original missing or changed; run `ballot-pipeline photos`")
        x, y, w, h = p["crop"]
        if w != h:
            raise ValueError(f"{p['candidate_id']}: the crop must be square, the same for every photo")
        crop = ["-crop", f"{w}x{h}+{x}+{y}", "+repage"]
        cid = p["candidate_id"]
        page = PHOTO_DIR / f"{cid}.webp"
        share = PHOTO_DIR / f"{cid}-share.jpg"
        cell = PHOTO_DIR / f"_{cid}.png"
        subprocess.run(["gm", "convert", str(raw), *crop, "-resize", f"{PAGE}x{PAGE}!", "-strip", "-quality", "85", f"webp:{page}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *crop, "-resize", f"{SHARE}x{SHARE}!", "-strip", "-quality", "92", f"jpeg:{share}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *crop, "-strip", f"png:{cell}"], check=True)
        cells[cid] = cell
        people[cid] = {
            "page": f"photos/{page.name}", "page_sha256": _sha256(page.read_bytes()), "page_size": PAGE,
            "share": f"photos/{share.name}", "share_sha256": _sha256(share.read_bytes()), "share_size": SHARE,
            **{k: p[k] for k in ("file_page", "author", "credit", "licence", "licence_url", "taken", "retrieved")},
        }
        log(f"photo {cid}: {page.stat().st_size} + {share.stat().st_size} bytes")
    PHOTOS_JSON.write_text(json.dumps({"approved": True, "people": people}, indent=1, ensure_ascii=False) + "\n")
    return cells


def check_photos(first_group_presidential: set[str]) -> list[str]:
    """All or none (D-048): either no photos, or one for every named presidential candidate of the first group and nobody else."""
    if not PHOTOS_JSON.exists():
        return ["no photos.json: run `ballot-pipeline assets`"]
    people = json.loads(PHOTOS_JSON.read_text())["people"]
    if not people:
        return []
    errors = []
    if set(people) != first_group_presidential:
        errors.append(f"photos (D-048): all five or none; have {sorted(people)}, need {sorted(first_group_presidential)}")
    for cid, m in people.items():
        for key in ("page", "share"):
            f = GENERATED_DIR / m[key]
            if not f.exists() or _sha256(f.read_bytes()) != m[f"{key}_sha256"]:
                errors.append(f"photo file {m[key]} is missing or changed since it was built")
    return errors


def cleanup_cells(cells: dict[str, Path]) -> None:
    for c in cells.values():
        c.unlink(missing_ok=True)
