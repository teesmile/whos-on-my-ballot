"""Read the cached IReV responses (crawl_irev.py) into INEC codes: ward SS/LL/WW -> its 2023 State Assembly constituency."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from .crawl_irev import IREV_RAW_DIR
from .paths import GENERATED_DIR

MANIFEST = GENERATED_DIR / "irev-manifest.json"
ELECTION_DAY_2023 = "2023-03-18"


@dataclass(frozen=True)
class IrevWard:
    code: str  # INEC delimitation code SS/LL/WW
    name: str  # IReV's spelling
    sc_code: str  # INEC constituency code as IReV prints it, e.g. SC/671/LA
    sc_name: str


def _files() -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(IREV_RAW_DIR.glob("*.json")) if p.name != "crawl.json"}


def digest(files: dict[str, str]) -> str:
    return hashlib.sha256("".join(f"{k}\0{v}\n" for k, v in sorted(files.items())).encode()).hexdigest()


def write_manifest() -> dict:
    files = _files()
    m = {"source_id": "inec-irev-2023-assembly", "files": len(files), "digest": digest(files), "sha256": files}
    MANIFEST.write_text(json.dumps(m, indent=0, sort_keys=True) + "\n")
    return m


def verify_manifest() -> list[str]:
    if not MANIFEST.exists():
        return ["no irev-manifest.json: run `make crawl-irev fetch`"]
    rec = json.loads(MANIFEST.read_text())
    cur = _files()
    if digest(rec["sha256"]) != rec["digest"]:
        return ["irev-manifest.json is internally inconsistent"]
    bad = sorted(k for k in set(rec["sha256"]) | set(cur) if rec["sha256"].get(k) != cur.get(k))
    return [f"{len(bad)} cached IReV responses differ from the manifest, e.g. {bad[:3]}"] if bad else []


def preconditions(reg: dict, recorded: dict, raw_dir) -> list[str]:
    """A registered IReV source is required: without its cache, metadata or record the build fails rather than quietly
    dropping the IReV evidence, including every OI-13 disagreement (review 5b)."""
    errors = []
    if not (raw_dir / "crawl.json").exists():
        errors.append("IReV is registered in sources.yaml but its crawl metadata is missing (run `make crawl-irev fetch`)")
    if reg["id"] not in recorded:
        errors.append(f"IReV is registered but {reg['id']} is not recorded in sources.json (run `make fetch`)")
    return errors


def load() -> tuple[dict[str, IrevWard], list[str], list[str]]:
    """Ward code -> IrevWard for every ward IReV assigns to a constituency that had an election on 18 March 2023.

    Returns (wards, problems to report, errors that must fail the build: a missing file or a ward code IReV lists twice)."""
    wards: dict[str, IrevWard] = {}
    problems: list[str] = []
    errors: list[str] = []
    dupes: set[str] = set()
    for ep in sorted(IREV_RAW_DIR.glob("elections-*.json")):
        sid = ep.stem.split("-")[1]
        elections = json.loads(ep.read_text())["data"]
        sc_by_id = {}
        for e in elections:
            if e["election_date"].startswith(ELECTION_DAY_2023):
                d = e["domain"]
                sc_by_id[d["state_constituency_id"]] = (d["code"].replace(" ", ""), d["name"].strip())
        wp = IREV_RAW_DIR / f"wards-{sid}.json"
        if not wp.exists():
            errors.append(f"IReV state {sid}: elections file without its ward file")
            continue
        for lga in json.loads(wp.read_text())["data"]:
            st_code, lga_code = lga["state"]["code"], lga["lga"]["code"]
            for w in lga["wards"]:
                code = f"{st_code}/{lga_code}/{w['code']}"
                sc = sc_by_id.get(w.get("state_constituency_id"))
                if sc is None:
                    problems.append(f"IReV ward {code} {w['name']}: constituency id {w.get('state_constituency_id')} had no 18 Mar 2023 election")
                    continue
                if code in wards or code in dupes:  # never keep one of two answers (review 5b)
                    dupes.add(code)
                    wards.pop(code, None)
                    continue
                wards[code] = IrevWard(code, w["name"].strip(), sc[0], sc[1])
    errors += [f"IReV lists ward {c} more than once" for c in sorted(dupes)]
    if len(list(IREV_RAW_DIR.glob("elections-*.json"))) != 37 or len(list(IREV_RAW_DIR.glob("wards-*.json"))) != 37:
        errors.append("IReV cache incomplete: expected 37 elections and 37 ward files (run `make crawl-irev`)")
    return wards, problems, errors
