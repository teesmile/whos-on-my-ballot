"""Integrity manifest for the polling-unit crawl: a SHA-256 for every cached locator response, plus one digest.

`fetch` writes it; `build` refuses geography that doesn't match it, so a changed or truncated cached response
can't be published under the crawl's provenance.
"""

from __future__ import annotations

import hashlib
import json

from .paths import GENERATED_DIR, PU_RAW_DIR

MANIFEST = GENERATED_DIR / "pu-manifest.json"


def _files() -> dict[str, str]:
    out = {}
    for path in sorted(PU_RAW_DIR.rglob("*")):
        rel = path.relative_to(PU_RAW_DIR).as_posix()
        if path.is_file() and (rel == "locator.html" or rel.endswith(".json")) and rel != "crawl.json":
            out[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


def digest(files: dict[str, str]) -> str:
    return hashlib.sha256("".join(f"{k}\0{v}\n" for k, v in sorted(files.items())).encode()).hexdigest()


def write_pu_manifest() -> dict:
    files = _files()
    manifest = {"source_id": "inec-pu-locator", "files": len(files), "digest": digest(files), "sha256": files}
    MANIFEST.write_text(json.dumps(manifest, indent=0, sort_keys=True) + "\n")
    return manifest


def verify_pu_manifest() -> list[str]:
    if not MANIFEST.exists():
        return ["no pu-manifest.json: run `make fetch` after the crawl"]
    recorded = json.loads(MANIFEST.read_text())
    current = _files()
    errors = []
    if digest(recorded["sha256"]) != recorded["digest"]:
        errors.append("pu-manifest.json is internally inconsistent (digest does not match its file list)")
    changed = [k for k in recorded["sha256"] if current.get(k) != recorded["sha256"][k]]
    extra = sorted(set(current) - set(recorded["sha256"]))
    if changed:
        errors.append(f"{len(changed)} cached locator responses differ from the manifest or are missing, e.g. {changed[:3]}")
    if extra:
        errors.append(f"{len(extra)} cached locator responses are not in the manifest, e.g. {extra[:3]}")
    return errors
