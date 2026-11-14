"""Party logos, from INEC's register of political parties only (owner decision D-043).

`ballot-pipeline logos` reads the party cards on INEC's /parties page (the same page the party names come from), downloads
each card's logo with the polite client and keeps the original in raw/logos/ with its hash. `ballot-pipeline assets` (offline)
then writes, with the same treatment for every party (fitted into a square on white, nothing else changed): one sprite
holding every logo for the pages, a PNG per party for the link-preview cards, and a larger copy per party for the share picture.
The build then refuses to continue unless every party on any ballot has a logo: all parties or none.
"""

from __future__ import annotations

import base64
import hashlib
import html
import json
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from .http import get
from .paths import GENERATED_DIR, RAW_DIR

INEC_ORIGIN = "https://www.inecnigeria.org"
LOGO_RAW_DIR = RAW_DIR / "logos"
LOGO_DIR = GENERATED_DIR / "logos"
MANIFEST = GENERATED_DIR / "logos.json"
SPRITE = GENERATED_DIR / "sprite.json"
SIZE = 96  # pixels per logo cell; shown at 44-64 CSS pixels, so sharp on 1.5x-2x phone screens
PHOTO_SIZE = 128  # pixels per photo cell, in a second row; a card shows the photo at 64-76 CSS pixels
PAD = 2  # white margin inside each logo cell, so neighbouring cells never bleed into each other when scaled
QUALITY = 82
FULL = 400  # the share picture's copy: the original's own size, reduced only beyond this
FULL_QUALITY = 92


def parse_logo_sources(page_html: str) -> dict[str, str]:
    """Acronym -> the logo's src, from each party card on INEC's /parties page (one card, one acronym, one logo)."""
    out: dict[str, str] = {}
    for slug, body in re.findall(r'<a href="/parties/([a-z0-9-]+)"(.*?)</a>', page_html, re.S):
        imgs = re.findall(r'<img src="([^"]+)"', body)
        text = [p.strip() for p in html.unescape(re.sub(r"<[^>]+>", "|", body.split(">", 1)[1])).split("|")]
        acronym = next((p for p in text if p), "")
        if not re.fullmatch(r"[A-Z]{1,5}", acronym):
            raise ValueError(f"party card {slug!r}: unexpected acronym {acronym!r}")
        if len(imgs) != 1:
            raise ValueError(f"party card {slug!r} has {len(imgs)} images, expected exactly one logo")
        out[acronym] = html.unescape(imgs[0])
    return out


def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch_and_build(page_path, page_record: dict, log=print) -> dict:
    """Download each logo named on the stored /parties page, record where each came from, then build the files (offline)."""
    sources = parse_logo_sources(page_path.read_text(encoding="utf-8"))
    LOGO_RAW_DIR.mkdir(parents=True, exist_ok=True)
    records: dict[str, dict] = {}
    for acronym, src in sorted(sources.items()):
        retrieved = datetime.now(UTC).isoformat(timespec="seconds")
        if src.startswith("data:"):
            m = re.fullmatch(r"data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)", src)
            if not m:
                raise ValueError(f"{acronym}: unexpected embedded logo")
            body, ext, origin = base64.b64decode(m.group(2)), m.group(1), "embedded in the /parties page"
            retrieved = page_record["retrieved_at"]
        else:
            if not src.startswith("/_nuxt/"):
                raise ValueError(f"{acronym}: logo is not on INEC's own site: {src!r}")
            origin = INEC_ORIGIN + src
            body, ext = get(origin), src.rsplit(".", 1)[-1].lower()
        raw = LOGO_RAW_DIR / f"{acronym}.{'jpg' if ext == 'jpeg' else ext}"
        raw.write_bytes(body)
        records[acronym] = {"raw": raw.name, "source_id": "inec-parties", "source_url": origin, "source_sha256": _sha256(body),
                            "retrieved_at": retrieved}
        log(f"logo {acronym}: {len(body)} bytes")
    return build_logo_files(records, log)


def _gm(*args: str) -> None:
    subprocess.run(["gm", "convert", *args], check=True)


def build_logo_files(records: dict[str, dict], log=print) -> dict:
    """From the stored originals: for every party the same treatment (fit inside a square, centred on white, metadata
    stripped). Writes a PNG for the build-time link-preview cards and a larger copy for the share picture, which the
    browser loads only when someone shares (never the small sprite: review of 11 Nov 2026)."""
    (LOGO_DIR / "full").mkdir(parents=True, exist_ok=True)
    for old in LOGO_DIR.glob("*.webp"):
        old.unlink()  # the per-party files are replaced by the one sprite
    manifest: dict[str, dict] = {}
    for acronym, rec in sorted(records.items()):
        raw = LOGO_RAW_DIR / rec["raw"]
        body = raw.read_bytes()
        if _sha256(body) != rec["source_sha256"]:
            raise ValueError(f"{acronym}: stored original changed since it was downloaded")
        png = LOGO_DIR / f"{acronym.lower()}.png"
        _gm(str(raw), "-resize", f"{SIZE}x{SIZE}", "-background", "white", "-gravity", "center", "-extent", f"{SIZE}x{SIZE}",
            "-strip", f"png:{png}")
        full = LOGO_DIR / "full" / f"{acronym.lower()}.webp"
        # The original's own pixels, never enlarged; only an unusually large original is reduced to FULL on its longer side.
        _gm(str(raw), "-resize", f"{FULL}x{FULL}>", "-background", "white", "-flatten", "-strip", "-quality", str(FULL_QUALITY),
            f"webp:{full}")
        w, h = _size(full)
        manifest[acronym] = {
            "png": f"logos/{png.name}", "png_sha256": _sha256(png.read_bytes()),
            "full": f"logos/full/{full.name}", "full_width": w, "full_height": h, "full_sha256": _sha256(full.read_bytes()),
            **{k: v for k, v in rec.items() if k != "raw"}, "raw": rec["raw"],
        }
        log(f"logo {acronym}: share copy {w}x{h}, {full.stat().st_size} bytes")
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    return manifest


def _size(path) -> tuple[int, int]:
    out = subprocess.run(["gm", "identify", "-format", "%w %h", str(path)], check=True, capture_output=True, text=True).stdout
    w, h = out.split()
    return int(w), int(h)


PRESIDENT_RACE = "jan-2027-president"
SHEET_OFFICES = ("president", "governor")  # races shown first on a ballot page: their photos share the page's one image


def race_of(candidate_id: str) -> str:
    """'feb-2027-governor-kano-apc' -> 'feb-2027-governor-kano' (a candidate's ID is its race's ID and its party)."""
    return candidate_id.rsplit("-", 1)[0]


def build_sprite(photo_cells: dict[str, object], log=print) -> dict:
    """One image per page (D-043, D-071): every party logo in a row of SIZE-pixel square cells and, under them, the approved
    photos of the race a ballot page shows first, in a row of PHOTO_SIZE-pixel cells. A 16 January page uses the President
    image (`file`); a 6 February page its state's governorship image (`sheets`), or the logos alone (`logo_file`) when that
    race has no photo. So a ballot page's first view makes one image request, and a page never downloads photos it doesn't
    show first. Each name carries its hash, so it can be cached for a year and a change is never served stale."""
    manifest = json.loads(MANIFEST.read_text())
    logos: list[tuple[str, Path]] = []
    for acronym, m in sorted(manifest.items()):
        raw = LOGO_RAW_DIR / m["raw"]
        if _sha256(raw.read_bytes()) != m["source_sha256"]:
            raise ValueError(f"{acronym}: stored original changed since it was downloaded")
        logos.append((acronym, raw))
    by_race: dict[str, list[tuple[str, object]]] = {}
    for cid, cell in sorted(photo_cells.items()):
        by_race.setdefault(race_of(cid), []).append((cid, cell))
    tmp = LOGO_DIR / "_cells"
    tmp.mkdir(exist_ok=True)

    def row(kind: str, items: list) -> Path:
        parts = []
        for i, (_key, src) in enumerate(items):
            cell = tmp / f"{kind}-{i:03d}.png"
            if kind == "logo":
                _gm(str(src), "-resize", f"{SIZE - 2 * PAD}x{SIZE - 2 * PAD}", "-background", "white", "-gravity", "center",
                    "-extent", f"{SIZE}x{SIZE}", "-strip", f"png:{cell}")
            else:
                _gm(str(src), "-resize", f"{PHOTO_SIZE}x{PHOTO_SIZE}!", "-strip", f"png:{cell}")
            parts.append(str(cell))
        out = tmp / f"row-{kind}-{len(list(tmp.glob('row-*')))}.png"
        _gm(*parts, "+append", f"png:{out}")
        for c in parts:
            Path(c).unlink()
        return out

    def write(rows: list[Path], prefix: str) -> tuple[Path, str]:
        staging = LOGO_DIR / f"_{prefix}.webp"
        if len(rows) == 1:
            _gm(str(rows[0]), "-quality", str(QUALITY), f"webp:{staging}")
        else:
            _gm(*map(str, rows), "-background", "white", "-append", "-quality", str(QUALITY), f"webp:{staging}")
        digest = _sha256(staging.read_bytes())
        out = LOGO_DIR / f"{prefix}-{digest[:10]}.webp"
        staging.rename(out)
        return out, digest

    for old in [*LOGO_DIR.glob("sprite-*.webp"), *LOGO_DIR.glob("logos-*.webp"), *LOGO_DIR.glob("sheet-*.webp")]:
        old.unlink()
    logo_row = row("logo", logos)
    # The logos alone, the same geometry: for a page whose first race has no photo, and for candidate pages (whose own
    # photo is a separate file).
    logo_out, _ = write([logo_row], "logos")
    pres = by_race.pop(PRESIDENT_RACE, [])
    main_rows = [logo_row] + ([row("photo", pres)] if pres else [])
    main_out, digest = write(main_rows, "sprite")
    sheets = {}
    for race_id, items in sorted(by_race.items()):
        f, d = write([logo_row, row("photo", items)], "sheet")
        sheets[race_id] = {"file": f"logos/{f.name}", "width": max(SIZE * len(logos), PHOTO_SIZE * len(items)),
                           "height": SIZE + PHOTO_SIZE, "bytes": f.stat().st_size, "sha256": d,
                           "photos": {k: i for i, (k, _) in enumerate(items)}}
    for r in tmp.glob("*"):
        r.unlink()
    tmp.rmdir()
    sprite = {
        "file": f"logos/{main_out.name}", "logo_file": f"logos/{logo_out.name}", "logo_width": SIZE * len(logos),
        "logo_bytes": logo_out.stat().st_size, "cell": SIZE, "photo_cell": PHOTO_SIZE, "photo_y": SIZE,
        "width": max(SIZE * len(logos), PHOTO_SIZE * len(pres)), "height": SIZE + (PHOTO_SIZE if pres else 0),
        "bytes": main_out.stat().st_size, "sha256": digest,
        "logos": {k: i for i, (k, _) in enumerate(logos)},
        "photos": {k: i for i, (k, _) in enumerate(pres)},
        "sheets": sheets,
    }
    SPRITE.write_text(json.dumps(sprite, indent=1) + "\n")
    log(f"sprite: {len(logos)} logos, {len(pres)} presidential photos, {sprite['bytes']} bytes -> {main_out.name}; "
        f"{len(sheets)} race images, {sum(len(v['photos']) for v in sheets.values())} photos")
    return sprite


def check_logos(parties_on_ballots: set[str]) -> list[str]:
    """Errors if any party on a ballot lacks a logo, or a built file is missing or changed: all parties or none."""
    if not MANIFEST.exists() or not SPRITE.exists():
        return ["no party logos: run `ballot-pipeline logos` (network) or `ballot-pipeline assets`"]
    manifest = json.loads(MANIFEST.read_text())
    sprite = json.loads(SPRITE.read_text())
    errors = [f"no INEC logo for {p}" for p in sorted(parties_on_ballots - manifest.keys())]
    errors += [f"no INEC logo for {p} in the sprite" for p in sorted(parties_on_ballots - sprite["logos"].keys())]
    for acronym, m in manifest.items():
        for key in ("png", "full"):
            f = GENERATED_DIR / m[key]
            if not f.exists() or _sha256(f.read_bytes()) != m[f"{key}_sha256"]:
                errors.append(f"logo file {m[key]} for {acronym} is missing or changed since it was built")
    f = GENERATED_DIR / sprite["file"]
    if not f.exists() or _sha256(f.read_bytes()) != sprite["sha256"]:
        errors.append("the logo sprite is missing or changed since it was built")
    if not (GENERATED_DIR / sprite.get("logo_file", "-")).exists():
        errors.append("the logos-only sprite is missing: run `ballot-pipeline assets`")
    for race_id, sh in sprite.get("sheets", {}).items():
        f = GENERATED_DIR / sh["file"]
        if not f.exists() or _sha256(f.read_bytes()) != sh["sha256"]:
            errors.append(f"the image for {race_id} is missing or changed since it was built")
    return errors
