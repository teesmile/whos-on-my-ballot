"""Re-check every background citation against the live page: the quote must appear verbatim (D-013).

`ballot-pipeline check-quotes` fetches each cited URL once (polite client, honest User-Agent), strips it to text and
looks for the quote, ignoring differences in whitespace, letter case and typographic quotes and dashes. A quote given
as pieces joined by "..." must have every piece on the page. Pages that refuse plain requests are reported, not worked around.
"""

from __future__ import annotations

import html
import re
import unicodedata

from .http import get

_TAGS = re.compile(r"<(script|style|noscript)\b.*?</\1>|<[^>]+>", re.S | re.I)


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", html.unescape(text))
    text = text.translate(str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "}))
    return re.sub(r"\s+", " ", text).strip().lower()


def page_text(raw: bytes) -> str:
    return normalise(_TAGS.sub(" ", raw.decode("utf-8", errors="replace")))


def quote_on_page(quote: str, text: str) -> bool:
    pieces = [normalise(p) for p in re.split(r"\.\.\.|…", quote) if normalise(p)]
    return bool(pieces) and all(p in text for p in pieces)


def check(urls_quotes: list[tuple[str, str]], log=print) -> dict[tuple[str, str], str]:
    """{(url, quote): "ok" | "quote not found" | "fetch failed: ..."}; each URL is fetched once."""
    pages: dict[str, str | Exception] = {}
    out = {}
    for url, quote in urls_quotes:
        if url not in pages:
            try:
                pages[url] = page_text(get(url, retries=2, timeout=40))
            except Exception as e:  # noqa: BLE001 - any failure means "not verified"
                pages[url] = e
        p = pages[url]
        out[(url, quote)] = f"fetch failed: {p}" if isinstance(p, Exception) else ("ok" if quote_on_page(quote, p) else "quote not found")
    return out
