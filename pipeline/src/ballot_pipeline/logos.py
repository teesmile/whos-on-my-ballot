"""Party logos, from INEC's register of political parties only (owner decision D-043).

`ballot-pipeline logos` reads the party cards on INEC's /parties page (the same page the party names come from), downloads
each card's logo with the polite client, keeps the original in raw/logos/ with its hash, and writes one small WebP per party
to data/generated/logos/, every one the same size and treatment: fitted into a square on white, nothing else changed.
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

from .http import get
from .paths import GENERATED_DIR, RAW_DIR

INEC_ORIGIN = "https://www.inecnigeria.org"
LOGO_RAW_DIR = RAW_DIR / "logos"
LOGO_DIR = GENERATED_DIR / "logos"
MANIFEST = GENERATED_DIR / "logos.json"
SIZE = 96  # pixels; shown at 44-64 CSS pixels, so sharp on 1.5x-2x phone screens
QUALITY = 82


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
    """Download each logo named on the stored /parties page and write the optimised files and their manifest."""
    sources = parse_logo_sources(page_path.read_text(encoding="utf-8"))
    LOGO_RAW_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict] = {}
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
        out = LOGO_DIR / f"{acronym.lower()}.webp"
        # Same treatment for every party: fit inside the square, centre it on white, strip metadata.
        subprocess.run(["gm", "convert", str(raw), "-resize", f"{SIZE}x{SIZE}", "-background", "white", "-gravity", "center",
                        "-extent", f"{SIZE}x{SIZE}", "-strip", "-quality", str(QUALITY), f"webp:{out}"], check=True)
        # A PNG copy of the same treatment, for the build-time link-preview cards (their renderer reads PNG, not WebP).
        png = LOGO_DIR / f"{acronym.lower()}.png"
        subprocess.run(["gm", "convert", str(out), "-strip", f"png:{png}"], check=True)
        manifest[acronym] = {
            "file": f"logos/{out.name}", "width": SIZE, "height": SIZE, "bytes": out.stat().st_size, "sha256": _sha256(out.read_bytes()),
            "png": f"logos/{png.name}", "png_sha256": _sha256(png.read_bytes()),
            "source_id": "inec-parties", "source_url": origin, "source_sha256": _sha256(body), "retrieved_at": retrieved,
        }
        log(f"logo {acronym}: {len(body)} bytes -> {out.stat().st_size} bytes")
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    return manifest


def check_logos(parties_on_ballots: set[str]) -> list[str]:
    """Errors if any party on a ballot lacks a logo, or a logo file is missing or changed: all parties or none."""
    if not MANIFEST.exists():
        return ["no party logos: run `ballot-pipeline logos`"]
    manifest = json.loads(MANIFEST.read_text())
    errors = [f"no INEC logo for {p}" for p in sorted(parties_on_ballots - manifest.keys())]
    for acronym, m in manifest.items():
        f = GENERATED_DIR / m["file"]
        p = GENERATED_DIR / m["png"]
        if not f.exists() or _sha256(f.read_bytes()) != m["sha256"] or not p.exists() or _sha256(p.read_bytes()) != m["png_sha256"]:
            errors.append(f"logo file for {acronym} is missing or changed since it was built")
    return errors
