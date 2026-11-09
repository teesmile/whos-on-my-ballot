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
    elif args.cmd == "watch":
        from .watch import watch

        return watch()
    return 0


if __name__ == "__main__":
    sys.exit(main())
