"""Candidate photos (owner decisions D-064, D-065, D-069, D-071): any race, each from a source that clearly carries authority
(Wikimedia Commons where the file names the person, the candidate's or party's own official website, or an official government
or legislature page that names them), and credited with where it came from. A photo from an official page that names the
candidate appears once it has been checked against the gender and age INEC printed (`official_checked` in the yaml, D-074);
a photo anyone could have uploaded, such as a Wikimedia Commons file, appears only after the owner has approved that face on a
contact sheet (`owner_approved`). Everyone else shows the same neutral placeholder.

Per-race rule (owner decisions D-075, D-076): a race shows its photos when at least two of its first group (the five parties,
with the state rule) have a cleared photo, or when exactly one has and that one is not the governing party's candidate (the
party holding the presidency, named once in data/overrides/governing-party.yaml with its source). Otherwise every candidate in
that race shows the placeholder. Cleared photos in a race that is not on stay listed in the yaml and are reported as held, so
the race switches on by itself when its next photo is cleared.

Only images whose licence allows reuse (or that a party sends with written permission) are listed, in
data/overrides/photos.yaml, each with its file page, author, licence and a crop box. `ballot-pipeline photos` downloads the
listed originals politely into raw/photos/ and checks each against the hash recorded in the yaml. `ballot-pipeline assets`
(offline) crops every photo the same way (a square head-and-shoulders box from the yaml), writes a page copy and a
share-picture copy, and hands a copy to the sprite: only for cleared entries in races that are on.
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
RACES_DIR = GENERATED_DIR / "races"
GOVERNING_YAML = DATA_DIR / "overrides" / "governing-party.yaml"
MIN_PER_RACE = 2  # D-075: photos show in a race only once this many of its first group have one
RULE_SINCE = "2026-11-14"  # the day D-075 and D-076 took held photos off their races' pages (a sitemap date)
PAGE = 320  # shown at up to 160 CSS pixels on the candidate page
CARD = 128  # a card's own small copy, for races whose photos load on demand (D-071): shown at 76 CSS pixels
CARD_QUALITY = 72
ON_DEMAND = ("senate", "house", "sha")  # races a ballot page doesn't show first: their photos load only when shown


def office_of(candidate_id: str) -> str:
    """'jan-2027-senate-lagos-lagos-central-apc' -> 'senate' (the third part of every race and candidate ID)."""
    return candidate_id.split("-")[2]
SHARE = 720  # drawn into the 1080 x 1920 share picture
FLAT = ["-background", "white", "-flatten"]  # a cut-out with a transparent background sits on white, never black
FIELDS = ("candidate_id", "source", "file_page", "file_url", "sha256", "retrieved", "crop")
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
        if p.get("official_checked") and public_upload(p):
            raise ValueError(f"photos.yaml: {p['candidate_id']} is a public upload, so it needs owner_approved, not official_checked (D-074)")
    return {"people": data.get("people") or []}


PUBLIC_UPLOAD_HOSTS = ("commons.wikimedia.org", "upload.wikimedia.org")


def _date(v) -> str | None:
    return str(v) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(v or "")) else None


def public_upload(p: dict) -> bool:
    """A file a member of the public uploaded (Wikimedia Commons): it always needs the owner's approval on a sheet (D-074)."""
    hosts = {urllib.parse.urlsplit(p[k]).netloc.lower() for k in ("file_page", "file_url")}
    return p["source"] == "Wikimedia Commons" or bool(hosts & set(PUBLIC_UPLOAD_HOSTS))


def approval_date(p: dict) -> str | None:
    """When this face was cleared to go live: the owner's approval on a contact sheet (D-065), or, for a photo from an
    official page that names the candidate, the date it was checked against INEC's printed gender and age (D-074)."""
    if _date(p.get("owner_approved")):
        return _date(p.get("owner_approved"))
    if _date(p.get("official_checked")) and not public_upload(p):
        return _date(p.get("official_checked"))
    return None


def approved(p: dict) -> bool:
    return approval_date(p) is not None


Group = list[tuple[str, str, str]]  # a race's candidates: (candidate ID, display group, party acronym)


def governing_party() -> dict:
    """The party holding the presidency (D-076), with its source: one setting, read here only."""
    g = yaml.safe_load(GOVERNING_YAML.read_text())
    src = g.get("source") or {}
    if not re.fullmatch(r"[A-Z]{1,6}", str(g.get("acronym", ""))) or not all(src.get(k) for k in ("title", "url", "retrieved", "quote")):
        raise ValueError("governing-party.yaml: needs an acronym and a source with title, url, quote and retrieved (D-076)")
    return g


def race_groups_from_disk() -> dict[str, Group]:
    """{race ID: [(candidate ID, display group, party)]} from the built race files."""
    return {r["id"]: [(c["id"], c["display_group"], c["party"]) for c in r["candidates"]]
            for f in sorted(RACES_DIR.glob("*.json")) for r in json.loads(f.read_text())}


def race_photo_rule(cleared: set[str], groups: dict[str, Group], governing: str) -> tuple[set[str], dict[str, str]]:
    """D-075, D-076: returns (photos shown, {held candidate ID: its race ID}). A race is on when at least MIN_PER_RACE of its
    first group have a cleared photo, or exactly one has and it is not the governing party's candidate; then every cleared
    photo in it shows, and in any other race none does."""
    race_of = {cid: rid for rid, cands in groups.items() for cid, _, _ in cands}
    unknown = sorted(cleared - set(race_of))
    if unknown:
        raise ValueError(f"photos.yaml: no named candidate with these IDs: {unknown}")

    def on(cands: Group) -> bool:
        with_photo = [party for cid, g, party in cands if g == "first" and cid in cleared]
        return len(with_photo) >= MIN_PER_RACE or (len(with_photo) == 1 and with_photo[0] != governing)

    races_on = {rid for rid, cands in groups.items() if on(cands)}
    shown = {cid for cid in cleared if race_of[cid] in races_on}
    return shown, {cid: race_of[cid] for cid in sorted(cleared - shown)}


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
    """Writes the cropped copies and photos.json; returns the square crops for the sprite (cleared photos in races that are on)."""
    listed = load()["people"]
    shown, held = race_photo_rule({p["candidate_id"] for p in listed if approved(p)}, race_groups_from_disk(), governing_party()["acronym"])
    for old in PHOTO_DIR.glob("*"):
        old.unlink()
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    cells: dict[str, Path] = {}
    people: dict[str, dict] = {}
    for p in listed:
        if not approved(p):
            log(f"photo {p['candidate_id']}: not yet approved or checked, not built")
            continue
        if p["candidate_id"] not in shown:
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
        subprocess.run(["gm", "convert", str(raw), *FLAT, *crop, "-resize", f"{PAGE}x{PAGE}!", "-strip", "-quality", "78", f"webp:{page}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *FLAT, *crop, "-resize", f"{SHARE}x{SHARE}!", "-strip", "-quality", "92", f"jpeg:{share}"], check=True)
        subprocess.run(["gm", "convert", str(raw), *FLAT, *crop, "-strip", f"png:{cell}"], check=True)
        cells[cid] = cell
        extra = {}
        if office_of(cid) in ON_DEMAND:
            card = PHOTO_DIR / f"{cid}-card.webp"
            subprocess.run(["gm", "convert", str(raw), *FLAT, *crop, "-resize", f"{CARD}x{CARD}!", "-strip", "-quality", str(CARD_QUALITY),
                            f"webp:{card}"], check=True)
            extra = {"card": f"photos/{card.name}", "card_sha256": _sha256(card.read_bytes()), "card_bytes": card.stat().st_size}
        people[cid] = {
            **extra,
            "page": f"photos/{page.name}", "page_sha256": _sha256(page.read_bytes()), "page_size": PAGE,
            "share": f"photos/{share.name}", "share_sha256": _sha256(share.read_bytes()), "share_size": SHARE,
            **{k: p[k] for k in ("source", "file_page", "retrieved")}, "approved": approval_date(p),
            **{k: p[k] for k in OPTIONAL if p.get(k)},
        }
        log(f"photo {cid}: {page.stat().st_size} + {share.stat().st_size} bytes")
    log(f"photos: {len(people)} shown; {len(held)} cleared but held (D-075, D-076)")
    PHOTOS_JSON.write_text(json.dumps({"people": people, "held": held, "held_since": RULE_SINCE}, indent=1, ensure_ascii=False) + "\n")
    return cells


def check_photos(offices: dict[str, str], groups: dict[str, Group]) -> list[str]:
    """Only faces the owner approved or, from an official page, checked against INEC (D-065, D-071, D-074), only of named candidates. President and Governor photos share the page's
    one image; Senate, House and State Assembly photos each have a small card copy that loads on demand (D-071). `offices`
    maps candidate ID to office; `groups` maps race ID to its (candidate ID, display group, party), for the per-race rule (D-075, D-076)."""
    if not PHOTOS_JSON.exists():
        return ["no photos.json: run `ballot-pipeline assets`"]
    people = json.loads(PHOTOS_JSON.read_text())["people"]
    errors = []
    unknown = sorted(set(people) - set(offices))
    if unknown:
        errors.append(f"photos: no named candidate with these IDs: {unknown}")
    no_card = sorted(c for c in people if office_of(c) in ON_DEMAND and "card" not in people[c])
    if no_card:
        errors.append(f"photos (D-071): no on-demand card copy for {no_card}")
    ok = {p["candidate_id"] for p in load()["people"] if approved(p)}
    if set(people) - ok:
        errors.append(f"photos (D-065, D-074): built without approval or an official-source check: {sorted(set(people) - ok)}")
    try:
        gov = governing_party()["acronym"]
        if not any(party == gov for cands in groups.values() for _, _, party in cands):
            return [*errors, f"governing-party.yaml (D-076): {gov} fields no candidate in any race"]
        shown, _ = race_photo_rule(ok, groups, gov)
    except ValueError as e:
        return [*errors, str(e)]
    if set(people) != shown:
        errors.append(f"photos (D-075, D-076): the per-race rule gives {len(shown)} photos, photos.json has {len(people)}; run `ballot-pipeline assets`"
                      f" (extra: {sorted(set(people) - shown)[:5]}, missing: {sorted(shown - set(people))[:5]})")
    for cid, m in people.items():
        for key in ("page", "share", *(("card",) if "card" in m else ())):
            f = GENERATED_DIR / m[key]
            if not f.exists() or _sha256(f.read_bytes()) != m[f"{key}_sha256"]:
                errors.append(f"photo file {m[key]} is missing or changed since it was built")
    return errors


def cleanup_cells(cells: dict[str, Path]) -> None:
    for c in cells.values():
        c.unlink(missing_ok=True)
