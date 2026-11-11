"""Candidate photos (owner decisions D-064 and D-065): presidential candidates only, each taken from the candidate's own official
account, their campaign or party website, or Wikimedia Commons, and credited with where it came from. A photo appears only
after the owner has approved that face on a contact sheet (`owner_approved` in the yaml); everyone else shows the same
neutral placeholder.

Only images whose licence allows reuse (or that a party sends with written permission) are listed, in
data/overrides/photos.yaml, each with its file page, author, licence and a crop box. `ballot-pipeline photos` downloads the
listed originals politely into raw/photos/ and checks each against the hash recorded in the yaml. `ballot-pipeline assets`
(offline) crops every photo the same way (a square head-and-shoulders box from the yaml), writes a page copy and a
share-picture copy, and hands a copy to the sprite: only for entries the owner has approved.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import urllib.parse
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
FIELDS = ("candidate_id", "credit", "source", "file_page", "file_url", "sha256", "retrieved", "crop")
OPTIONAL = ("author", "licence", "licence_url", "taken")


def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load() -> dict:
    if not PHOTOS_YAML.exists():
        return {"people": []}
    data = yaml.safe_load(PHOTOS_YAML.read_text()) or {}
    for p in data.get("people") or []:
        missing = [f for f in FIELDS if f not in p]
        if missing:
            raise ValueError(f"photos.yaml: {p.get('candidate_id')} lacks {missing}")
    return {"people": data.get("people") or []}


def approved(p: dict) -> bool:
    """The owner approved this face on a contact sheet (D-065): the date they did, as a string."""
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(p.get("owner_approved") or "")))


def _raw(p: dict) -> Path:
    ext = Path(urllib.parse.urlsplit(p["file_url"]).path).suffix.lower() or ".jpg"
    return PHOTO_RAW_DIR / f"{p['candidate_id']}{ext}"


def _edge_colour(path: Path) -> str:
    """The picture's top-left pixel, as #rrggbb, for padding a crop that reaches past an edge."""
    out = subprocess.run(["gm", "convert", str(path), "-crop", "1x1+0+0", "txt:-"], check=True, capture_output=True, text=True).stdout
    m = re.search(r"#[0-9A-Fa-f]{6}", out)
    if not m:
        raise ValueError(f"{path.name}: could not read the edge colour")
    return m.group(0).lower()


def _crop_args(raw: Path, x: int, y: int, w: int, h: int) -> list[str]:
    """gm arguments for a square crop, padding with the edge colour where the box reaches past the picture."""
    args: list[str] = []
    iw, ih = _size(raw)
    pad_l, pad_t = max(0, -x), max(0, -y)
    if pad_l or pad_t:  # the picture anchored bottom-right, so the new canvas appears at the top and the left
        args += ["-background", _edge_colour(raw), "-gravity", "SouthEast", "-extent", f"{iw + pad_l}x{ih + pad_t}"]
    pad_r, pad_b = max(0, x + w - iw), max(0, y + h - ih)
    if pad_r or pad_b:
        args += ["-background", _edge_colour(raw), "-gravity", "NorthWest", "-extent", f"{iw + pad_l + pad_r}x{ih + pad_t + pad_b}"]
    return [*args, "-gravity", "NorthWest", "-crop", f"{w}x{h}+{x + pad_l}+{y + pad_t}", "+repage"]


def _size(path: Path) -> tuple[int, int]:
    out = subprocess.run(["gm", "identify", "-format", "%w %h", str(path)], check=True, capture_output=True, text=True).stdout
    w, h = out.split()
    return int(w), int(h)


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
    listed = load()["people"]
    for old in PHOTO_DIR.glob("*"):
        old.unlink()
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    cells: dict[str, Path] = {}
    people: dict[str, dict] = {}
    for p in listed:
        if not approved(p):
            log(f"photo {p['candidate_id']}: waiting for the owner's approval, not built")
            continue
        raw = _raw(p)
        if not raw.exists() or _sha256(raw.read_bytes()) != p["sha256"]:
            raise ValueError(f"{p['candidate_id']}: original missing or changed; run `ballot-pipeline photos`")
        x, y, w, h = p["crop"]
        if w != h:
            raise ValueError(f"{p['candidate_id']}: the crop must be square, the same for every photo")
        crop = _crop_args(raw, x, y, w, h)
        cid = p["candidate_id"]
        page = PHOTO_DIR / f"{cid}.webp"
        share = PHOTO_DIR / f"{cid}-share.jpg"
        cell = PHOTO_DIR / f"_{cid}.png"
        subprocess.run(["gm", "convert", str(raw), *crop, "-resize", f"{PAGE}x{PAGE}!", "-strip", "-quality", "78", f"webp:{page}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *crop, "-resize", f"{SHARE}x{SHARE}!", "-strip", "-quality", "92", f"jpeg:{share}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *crop, "-strip", f"png:{cell}"], check=True)
        cells[cid] = cell
        people[cid] = {
            "page": f"photos/{page.name}", "page_sha256": _sha256(page.read_bytes()), "page_size": PAGE,
            "share": f"photos/{share.name}", "share_sha256": _sha256(share.read_bytes()), "share_size": SHARE,
            **{k: p[k] for k in ("credit", "source", "file_page", "retrieved")},
            **{k: p[k] for k in OPTIONAL if p.get(k)},
        }
        log(f"photo {cid}: {page.stat().st_size} + {share.stat().st_size} bytes")
    PHOTOS_JSON.write_text(json.dumps({"people": people}, indent=1, ensure_ascii=False) + "\n")
    return cells


def check_photos(presidential: set[str]) -> list[str]:
    """Only presidential candidates have photos, and only faces the owner approved (D-065)."""
    if not PHOTOS_JSON.exists():
        return ["no photos.json: run `ballot-pipeline assets`"]
    people = json.loads(PHOTOS_JSON.read_text())["people"]
    errors = []
    extra = set(people) - presidential
    if extra:
        errors.append(f"photos (D-065): only presidential candidates may have one; not {sorted(extra)}")
    ok = {p["candidate_id"] for p in load()["people"] if approved(p)}
    if set(people) - ok:
        errors.append(f"photos (D-065): built without the owner's approval: {sorted(set(people) - ok)}")
    for cid, m in people.items():
        for key in ("page", "share"):
            f = GENERATED_DIR / m[key]
            if not f.exists() or _sha256(f.read_bytes()) != m[f"{key}_sha256"]:
                errors.append(f"photo file {m[key]} is missing or changed since it was built")
    return errors


def cleanup_cells(cells: dict[str, Path]) -> None:
    for c in cells.values():
        c.unlink(missing_ok=True)
