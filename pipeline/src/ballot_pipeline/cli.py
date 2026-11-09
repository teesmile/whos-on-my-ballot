"""Command-line entry point: ``uv run ballot-pipeline <step>``."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ballot-pipeline")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="download every registered INEC source into raw/ and hash it")
    sub.add_parser("crawl-pu", help="crawl INEC's polling-unit locator (polite, resumable)")
    sub.add_parser("build", help="extract, map, order and write data/generated/ (offline)")
    sub.add_parser("verify", help="build, then run every Phase 1 check; non-zero on any failure (offline)")
    sub.add_parser("check-quotes", help="re-fetch every background citation and confirm its quote is on the page (network)")
    sub.add_parser("watch", help="re-read INEC index pages; exit 3 if any document list or hash changed")
    args = parser.parse_args(argv)

    if args.cmd == "fetch":
        from .fetch import fetch_all

        fetch_all()
    elif args.cmd == "crawl-pu":
        from .crawl_pu import crawl

        crawl()
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
    elif args.cmd == "watch":
        from .watch import watch

        return watch()
    return 0


if __name__ == "__main__":
    sys.exit(main())
