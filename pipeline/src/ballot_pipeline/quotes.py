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


def raw_url(url: str) -> str:
    """For an Internet Archive citation, the archived file itself rather than the archive's viewer page around it
    (the documented `id_` form: /web/<timestamp>id_/<original URL>). Other URLs are unchanged."""
    m = re.match(r"^(https://web\.archive\.org/web/)(\d+)(?:[a-z]{2}_)?/(.+)$", url)
    return f"{m.group(1)}{m.group(2)}id_/{m.group(3)}" if m else url


def _xlsx_text(raw: bytes) -> str:
    import io

    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    lines = []
    for ws in wb.worksheets:
        lines.append(ws.title)
        for row in ws.iter_rows(values_only=True):
            cells = [str(v) for v in row if v is not None and str(v).strip()]
            if cells:
                lines.append(" ".join(cells))
    return "\n".join(lines)


def page_text(raw: bytes) -> str:
    """Searchable text of a fetched HTML page, PDF or spreadsheet (INEC's records are often PDFs or .xlsx)."""
    if raw[:4] == b"PK\x03\x04":  # .xlsx is a zip
        return normalise(_xlsx_text(raw))
    if raw[:5] == b"%PDF-":
        import subprocess
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(raw)
            f.flush()
            text = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True, check=True).stdout
        return normalise(text)
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
                pages[url] = page_text(get(raw_url(url), retries=2, timeout=90))
            except Exception as e:  # noqa: BLE001 - any failure means "not verified"
                pages[url] = e
        p = pages[url]
        out[(url, quote)] = f"fetch failed: {p}" if isinstance(p, Exception) else ("ok" if quote_on_page(quote, p) else "quote not found")
    return out
