"""Cache what INEC's Result Viewing Portal (IReV) publishes about the 2023 State House of Assembly constituencies.

IReV's public site (https://www.inecelectionresults.ng) loads its data from the API named in its own front-end code. For each
state this saves two unauthenticated responses, exactly as served:
  elections-<id>.json  House of Assembly elections in the state; each names its constituency (INEC code and name)
  wards-<id>.json      every ward of the state as IReV holds it for the 25 Feb 2023 election, each with its constituency id
Polite: the pipeline's User-Agent, one request a second, resumable (cached files are not fetched again). No login, no
bot-check circumvention: a challenge or an error stops the crawl.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime

from .http import get
from .paths import RAW_DIR

IREV_RAW_DIR = RAW_DIR / "irev"
FRONT_END = "https://www.inecelectionresults.ng"
API = "https://dolphin-app-sleqh.ondigitalocean.app/api/v1/"  # getEndpoint() in IReV's front-end bundle (main.c3e125f769dcbf96.js)
ASSEMBLY_TYPE = "5f129a04df41d910dcdc1d54"  # election type 5, code ASSEMBLY
PRESIDENTIAL_2023 = "63f8f25b594e164f8146a213"  # "Presidential election - 2023-02-25"
STATE_IDS = range(1, 38)  # IReV's own state ids (not INEC's codes); each response names INEC's code


def crawl(log=print) -> None:
    IREV_RAW_DIR.mkdir(parents=True, exist_ok=True)
    meta_path = IREV_RAW_DIR / "crawl.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {"started_at": datetime.now(UTC).isoformat(timespec="seconds")}
    for sid in STATE_IDS:
        for name, url in ((f"elections-{sid}.json", f"{API}elections?election_type={ASSEMBLY_TYPE}&state_id={sid}"),
                          (f"wards-{sid}.json", f"{API}elections/{PRESIDENTIAL_2023}/lga/state/{sid}")):
            path = IREV_RAW_DIR / name
            if path.exists():
                continue
            body = get(url)
            data = json.loads(body)  # a challenge page or error is not JSON: stop rather than work around it
            if not data.get("success"):
                raise RuntimeError(f"IReV answered {url} without success")
            path.write_bytes(body)
            log(f"irev {name}: {len(body):,} bytes")
            time.sleep(1.0)
    meta.update({"finished_at": datetime.now(UTC).isoformat(timespec="seconds"), "front_end": FRONT_END, "api": API,
                 "assembly_type": ASSEMBLY_TYPE, "presidential_2023": PRESIDENTIAL_2023, "state_ids": [STATE_IDS.start, STATE_IDS.stop - 1]})
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")
