"""One polite HTTP client for every INEC request: honest User-Agent, ≤ 2 requests a second, retries with backoff."""

from __future__ import annotations

import time
import urllib.error
import urllib.parse
import urllib.request

from .paths import USER_AGENT

MIN_INTERVAL_S = 0.5
_last_request = 0.0


def get(url: str, retries: int = 5, timeout: int = 120) -> bytes:
    global _last_request
    # Percent-encode any non-ASCII characters (e.g. a typographic apostrophe in a news URL) without touching the rest.
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
    for attempt in range(retries):
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == retries - 1:
                raise
        except OSError:
            if attempt == retries - 1:
                raise
        time.sleep(2 ** (attempt + 1))
    raise AssertionError("unreachable")
