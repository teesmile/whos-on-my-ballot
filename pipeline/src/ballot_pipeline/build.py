"""Offline build: raw INEC files -> data/generated/. Returns everything verify.py needs to check."""

from __future__ import annotations

import dataclasses
import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import yaml

from . import extract as ex
from .geo import GeoError, WorkbookUnit, key, read_locator, read_workbook, resolve_composition
from .models import Candidate, Lga, Person, PollingUnit, Provenance, Race, StateGeo, Ward
from .ordering import ORDER_RULE, order_candidates
from .parties import parse_parties
from .paths import ALIASES_YAML, GENERATED_DIR, RAW_DIR, SOURCES_YAML
from .states import slug

ELECTION = "jan-2027"


@dataclass
class BuildResult:
    sources: list[dict]
    parties: list[dict]
    rows_by_source: dict[str, list[ex.Row]]
    independent_sn: dict[str, list[int]]
    races: list[Race]
    quarantine: list[dict]
    workbook: list[WorkbookUnit]
    geo: dict[str, StateGeo]
    unresolved_wards: list[dict]
    inec_order_matches: dict[str, bool]
    locator_counts: dict[str, int]
    anomalies: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- helpers


def _sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _cached_rows(src: dict) -> list[ex.Row]:
    """Extraction is deterministic for a given file hash, so cache it next to the raw file."""
    cache = RAW_DIR / "extracted" / f"{src['source_id']}-{src['sha256'][:16]}-v{ex.EXTRACTOR_VERSION}.json"
    if cache.exists():
        data = json.loads(cache.read_text())
        return [ex.Row(**{**r, "candidate": ex.Person(**r["candidate"]),
                          "running_mate": ex.Person(**r["running_mate"]) if r["running_mate"] else None})
                for r in data]
    rows = ex.extract_pdf(str(RAW_DIR / src["local_file"]), src["source_id"], ticket=src.get("race") == "president")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps([dataclasses.asdict(r) for r in rows], ensure_ascii=False))
    return rows


def _person(p: ex.Person, problems: list[str], anomalies: list[str]) -> Person:
    """Structural problems quarantine the row; implausible printed values are kept verbatim and reported."""
    age = None
    if p.age:
        if p.age.isdigit() and 25 <= int(p.age) <= 100:
            age = int(p.age)
        else:
            anomalies.append(f"age printed as {p.age!r}")
    gender = p.gender or None
    if gender not in (None, "M", "F"):
        problems.append(f"gender {p.gender!r} not M/F")
        gender = None
    return Person(name=p.name, age=age, age_as_printed=p.age, gender=gender, pwd=p.pwd, qualifications=p.qualifications,
                  position=p.position)


def _load_aliases() -> dict:
    return yaml.safe_load(ALIASES_YAML.read_text()) or {}


# ---------------------------------------------------------------- build


def build(log=print) -> BuildResult:
    reg = yaml.safe_load(SOURCES_YAML.read_text())
    sources = json.loads((GENERATED_DIR / "sources.json").read_text())
    by_id = {s["source_id"]: s for s in sources}
    errors: list[str] = []

    for s in sources:
        if "local_file" in s:
            actual = _sha256(RAW_DIR / s["local_file"])
            if actual != s["sha256"]:
                errors.append(f"hash mismatch for {s['source_id']}: raw file changed since fetch")

    parties = parse_parties((RAW_DIR / by_id["inec-parties"]["local_file"]).read_text(encoding="utf-8"))
    party_names = {p["acronym"]: p["name"] for p in parties}
    aliases = _load_aliases()

    # ---- candidate rows
    rows_by_source: dict[str, list[ex.Row]] = {}
    independent_sn: dict[str, list[int]] = {}
    for s in sources:
        if s.get("local_file", "").endswith(".pdf"):
            rows = _cached_rows(s)
            fallback_states = s.get("use_states")
            if fallback_states:
                rows_all = rows
                rows = [r for r in rows if r.state in fallback_states]
                rows_by_source[s["source_id"] + "#all"] = rows_all
            rows_by_source[s["source_id"]] = rows
            independent_sn[s["source_id"]] = ex.count_sn_independently(str(RAW_DIR / s["local_file"]))
            log(f"extracted {s['source_id']}: {len(rows)} rows")

    # ---- workbook + locator
    workbook = read_workbook(str(RAW_DIR / by_id["inec-constituencies-workbook"]["local_file"]))
    locator = read_locator()
    lga_names_by_state = {st: [l.name for l in lgas] for st, (_, lgas) in locator.items()}
    comp_overrides = {k: v["lgas"] for k, v in (aliases.get("composition_overrides") or {}).items()}
    spellings = {st: {key(k): v for k, v in d.items()} for st, d in (aliases.get("lga_spellings") or {}).items()}
    for u in workbook:
        try:
            resolve_composition(u, lga_names_by_state[u.state], comp_overrides, spellings.get(u.state, {}))
        except GeoError as e:
            errors.append(str(e))

    pending_splits = {k: v for k, v in (aliases.get("pending_ward_splits") or {}).items()}
    pending_sd = {k: v for k, v in (aliases.get("pending_sd_placements") or {}).items()}
    for kind in ("SD", "FC"):
        for state, lgas in lga_names_by_state.items():
            homes = defaultdict(list)
            for u in workbook:
                if u.kind == kind and u.state == state:
                    for lga in u.lgas:
                        homes[lga].append(u.code)
            for lga in lgas:
                codes = homes.get(lga, [])
                split_ok = kind == "FC" and codes and sorted(codes) == sorted(pending_splits.get(f"{state}|{lga}", []))
                unplaced_ok = kind == "SD" and not codes and f"{state}|{lga}" in pending_sd
                if len(codes) != 1 and not (split_ok or unplaced_ok):
                    errors.append(f"{state} LGA {lga!r} is in {len(codes)} {kind} units {codes}")
    for k, codes in pending_splits.items():
        st, lga = k.split("|", 1)
        if sorted(u.code for u in workbook if u.split_lga == lga and u.state == st) != sorted(codes):
            errors.append(f"pending_ward_splits {k}: workbook split units differ from {codes}")

    sd_units = {u.code: u for u in workbook if u.kind == "SD"}
    fc_units = {u.code: u for u in workbook if u.kind == "FC"}

    # ---- link candidate-list constituency names to workbook units
    name_aliases = {}
    for k, v in (aliases.get("constituency_aliases") or {}).items():
        st, list_name = k.split("|", 1)
        name_aliases[(st, key(list_name))] = v
    used_aliases: set[tuple[str, str]] = set()

    def find_unit(kind: str, state: str, name: str) -> WorkbookUnit | None:
        target = name
        if (state, key(name)) in name_aliases:
            used_aliases.add((state, key(name)))
            target = name_aliases[(state, key(name))]
        hits = [u for u in workbook if u.kind == kind and u.state == state and key(u.name) == key(target)]
        return hits[0] if len(hits) == 1 else None

    # ---- races
    quarantine: list[dict] = []
    anomalies: list[dict] = []
    grouped: dict[tuple[str, str | None, str], list[ex.Row]] = defaultdict(list)
    race_sources: dict[tuple, set[str]] = defaultdict(set)
    spellings: dict[tuple, Counter] = defaultdict(Counter)
    for sid, rows in rows_by_source.items():
        if sid.endswith("#all"):
            continue
        office = by_id[sid]["race"]
        for r in rows:
            # Group on a letters-and-digits key: INEC spells one constituency with and without spaces across rows.
            k = (office, None, "NIGERIA") if office == "president" else (office, r.state, key(r.constituency))
            grouped[k].append(r)
            race_sources[k].add(sid)
            spellings[k][r.constituency or "Nigeria"] += 1

    races: list[Race] = []
    inec_order_matches: dict[str, bool] = {}
    fc_to_race: dict[str, str] = {}
    sd_to_race: dict[str, str] = {}
    for gkey, rows in sorted(grouped.items(), key=lambda kv: (kv[0][0], kv[0][1] or "", kv[0][2])):
        office, state, _ = gkey
        # Display INEC's most frequent spelling (ties: first alphabetically), verbatim.
        cname = sorted(spellings[gkey].items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        if office == "president":
            race_id, unit = f"{ELECTION}-president", None
        else:
            unit = find_unit("SD" if office == "senate" else "FC", state, cname)
            if unit is None:
                errors.append(f"{office} {state} {cname!r}: no unique match in INEC workbook (add constituency_aliases)")
            race_id = f"{ELECTION}-{office}-{slug(state)}-{slug(cname)}"
            if unit:
                (sd_to_race if office == "senate" else fc_to_race)[unit.code] = race_id

        for sid in race_sources[gkey]:
            in_file = [r.party for r in sorted(rows, key=lambda r: r.sn) if r.source_id == sid]
            inec_order_matches.setdefault(sid, True)
            if in_file != sorted(in_file):
                inec_order_matches[sid] = False

        cands = []
        for r in order_candidates(rows, lambda r: r.party):
            problems: list[str] = []
            if r.party not in party_names:
                problems.append(f"party {r.party!r} not on INEC's register")
            if not r.candidate.name and not r.remarks:
                problems.append("no candidate name and no INEC remark")
            found: list[str] = []
            cand = _person(r.candidate, problems, found)
            mate = _person(r.running_mate, problems, found) if r.running_mate else None
            if found:
                anomalies.append({"source_id": r.source_id, "page": r.page, "sn": r.sn, "party": r.party,
                                  "name": r.candidate.name, "anomalies": found})
            if problems:
                quarantine.append({"source_id": r.source_id, "page": r.page, "sn": r.sn, "problems": problems})
            cands.append((r, cand, mate))
        races.append(
            Race(
                id=race_id, election=ELECTION, office=office, state=state, name=cname,
                workbook_code=unit.code if unit else None, order_rule=ORDER_RULE,
                sources=sorted(race_sources[gkey]),
                candidates=[
                    Candidate(
                        id=f"{race_id}-{r.party.lower()}", race_id=race_id, party=r.party,
                        party_name=party_names.get(r.party), ballot_position=i, remarks=r.remarks,
                        candidate=cand, running_mate=mate,
                        provenance=Provenance(source_id=r.source_id, page=r.page, sn=r.sn),
                    )
                    for i, (r, cand, mate) in enumerate(cands, start=1)
                ],
            )
        )

    for unused in set(name_aliases) - used_aliases:
        errors.append(f"constituency alias {unused} matched no candidate-list constituency (stale entry)")

    # ---- LGA -> senatorial district. Federal constituencies may straddle districts (8 do in INEC's workbook),
    # so a ward's district comes from its LGA, never from its constituency.
    lga_to_sd: dict[tuple[str, str], list[str]] = {}
    for u in sd_units.values():
        for lga in u.lgas:
            lga_to_sd.setdefault((u.state, lga), []).append(u.code)
    for k, codes in pending_sd.items():
        st, lga = k.split("|", 1)
        if (st, lga) in lga_to_sd:
            errors.append(f"pending_sd_placements {k}: the workbook already places it in {lga_to_sd[(st, lga)]}")
        lga_to_sd[(st, lga)] = list(codes)

    # ---- geography: ward -> races
    lga_to_fcs: dict[tuple[str, str], list[str]] = defaultdict(list)
    for u in fc_units.values():
        for lga in u.lgas:
            lga_to_fcs[(u.state, lga)].append(u.code)
    unresolved_wards: list[dict] = []
    geo: dict[str, StateGeo] = {}
    for state, (s_code, lgas) in locator.items():
        out_lgas = []
        for l in lgas:
            fcs = lga_to_fcs.get((state, l.name), [])
            sds = lga_to_sd.get((state, l.name), [])
            fc_races = sorted(fc_to_race[c] for c in fcs if c in fc_to_race)
            sd_races = sorted(sd_to_race[c] for c in sds if c in sd_to_race)
            wards = []
            seen_codes: dict[str, int] = {}
            for w_code, w_name, pus in l.wards:
                code = f"{s_code}/{l.code}/{w_code}"
                if code in seen_codes:
                    if not pus:
                        # INEC lists Gwer East ward 09 twice; the second copy has no polling units.
                        anomalies.append({"source_id": "inec-pu-locator", "ward": code, "name": w_name,
                                          "anomalies": ["duplicate ward code with no polling units; dropped"]})
                        continue
                    errors.append(f"duplicate ward code {code} with polling units")
                seen_codes[code] = len(pus)
                pending = f"{state}|{l.name}" in pending_splits or f"{state}|{l.name}" in pending_sd
                if len(fc_races) != 1 or len(sd_races) != 1:
                    unresolved_wards.append({"state": state, "lga": l.name, "ward": code, "federal_constituencies": fc_races,
                                             "senatorial_districts": sd_races, "pending_split": pending})
                    if not fc_races or not sd_races:
                        continue
                wards.append(Ward(
                    code=code, name=w_name, federal_constituency=fc_races, senatorial_district=sd_races,
                    polling_units=[PollingUnit(code=f"{code}/{p_code}", name=p_name) for p_code, p_name in pus],
                ))
            out_lgas.append(Lga(code=f"{s_code}/{l.code}", name=l.name, wards=wards))
        geo[state] = StateGeo(code=s_code, name=state, source_id="inec-pu-locator", lgas=out_lgas)

    locator_counts = {
        "states": len(locator),
        "lgas": sum(len(lgas) for _, lgas in locator.values()),
        "wards": sum(len(l.wards) for _, lgas in locator.values() for l in lgas),
        "pus": sum(len(w[2]) for _, lgas in locator.values() for l in lgas for w in l.wards),
    }
    result = BuildResult(sources, parties, rows_by_source, independent_sn, races, quarantine, workbook, geo,
                         unresolved_wards, inec_order_matches, locator_counts, anomalies, errors)
    write_outputs(result)
    return result


def write_outputs(res: BuildResult) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    def dump(path, obj):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump(GENERATED_DIR / "parties.json", res.parties)
    dump(GENERATED_DIR / "races" / f"{ELECTION}.json", [r.model_dump() for r in res.races])
    dump(GENERATED_DIR / "quarantine.json", res.quarantine)
    dump(GENERATED_DIR / "anomalies.json", res.anomalies)
    dump(GENERATED_DIR / "constituencies.json", [
        {"code": u.code, "kind": u.kind, "state": u.state, "name": u.name, "composition": u.composition,
         "lgas": u.lgas, "split_lga": u.split_lga, "resolved_by": u.resolved_by,
         "provenance": {"source_id": "inec-constituencies-workbook", "row": u.row}}
        for u in res.workbook
    ])
    for state, sg in res.geo.items():
        dump(GENERATED_DIR / "geo" / f"{sg.code}.json", sg.model_dump())
    dump(GENERATED_DIR / "geo" / "states.json", [{"code": sg.code, "name": sg.name} for sg in sorted(res.geo.values(), key=lambda s: s.code)])
