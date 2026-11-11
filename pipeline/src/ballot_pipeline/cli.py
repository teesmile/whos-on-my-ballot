"""Command-line entry point: ``uv run ballot-pipeline <step>``."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ballot-pipeline")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="download every registered INEC source into raw/ and hash it")
    sub.add_parser("crawl-pu", help="crawl INEC's polling-unit locator (polite, resumable)")
    sub.add_parser("crawl-irev", help="cache IReV's 2023 State Assembly ward lists (polite, resumable; network)")
    sub.add_parser("build", help="extract, map, order and write data/generated/ (offline)")
    sub.add_parser("verify", help="build, then run every Phase 1 check; non-zero on any failure (offline)")
    sub.add_parser("check-quotes", help="re-fetch every background citation and confirm its quote is on the page (network)")
    sub.add_parser("logos", help="download each party's logo from INEC's /parties page and write the optimised files (network)")
    sub.add_parser("photos", help="download the candidate photos listed in data/overrides/photos.yaml and check their hashes (network)")
    sub.add_parser("assets", help="build the logo sprite, share-picture copies and photo crops from stored originals (offline)")
    sub.add_parser("watch", help="re-read INEC index pages; exit 3 if any document list or hash changed")
    args = parser.parse_args(argv)

    if args.cmd == "fetch":
        from .fetch import fetch_all

        fetch_all()
    elif args.cmd == "crawl-pu":
        from .crawl_pu import crawl

        crawl()
    elif args.cmd == "crawl-irev":
        from .crawl_irev import crawl as crawl_irev

        crawl_irev()
    elif args.cmd == "build":
        from .build import build

        build()
    elif args.cmd == "verify":
        from .build import build
        from .verify import verify

        return verify(build())
    elif args.cmd == "check-quotes":
        import json

        import yaml

        from .background import FILE
        from .quotes import check

        raw = yaml.safe_load(FILE.read_text()) if FILE.exists() else {}
        pairs = []
        for p in raw.get("people") or []:
            cites = ([p["identity"]] if p.get("identity") else []) + [c for f in ("public_offices", "party_history")
                                                                     for e in p.get(f) or [] for c in e["citations"]]
            pairs += [(c["url"], c["quote"]) for c in cites]
        results = check(pairs)
        from datetime import UTC, datetime

        from .background import QUOTE_CHECK

        QUOTE_CHECK.write_text(json.dumps({"checked_at": datetime.now(UTC).isoformat(timespec="seconds"),
                                           "results": {f"{u}\n{q}": {"result": v} for (u, q), v in sorted(results.items())}},
                                          indent=1, ensure_ascii=False) + "\n")
        bad = {k: v for k, v in results.items() if v != "ok"}
        for (url, quote), v in bad.items():
            print(f"{v}: {url} :: {quote[:80]}")
        print(f"{len(results) - len(bad)} of {len(results)} quotes found on their pages")
        return 1 if bad else 0
    elif args.cmd == "logos":
        import json

        from .logos import fetch_and_build
        from .paths import GENERATED_DIR, RAW_DIR

        rec = next(s for s in json.loads((GENERATED_DIR / "sources.json").read_text()) if s["source_id"] == "inec-parties")
        fetch_and_build(RAW_DIR / rec["local_file"], rec)
        _assets()
    elif args.cmd == "photos":
        from .photos import fetch

        fetch()
    elif args.cmd == "assets":
        _assets()
    elif args.cmd == "watch":
        from .watch import watch

        return watch()
    return 0


def _assets() -> None:
    """Offline: the files every page and the share picture use, rebuilt from the stored originals."""
    import json

    from .logos import LOGO_RAW_DIR, MANIFEST, build_logo_files, build_sprite
    from .photos import build_photos, cleanup_cells

    records = {}
    for acronym, m in json.loads(MANIFEST.read_text()).items():
        raw = m.get("raw") or next(p.name for p in LOGO_RAW_DIR.glob(f"{acronym}.*"))
        records[acronym] = {"raw": raw, **{k: m[k] for k in ("source_id", "source_url", "source_sha256", "retrieved_at")}}
    build_logo_files(records)
    cells = build_photos()
    build_sprite(cells)
    cleanup_cells(cells)


if __name__ == "__main__":
    sys.exit(main())
