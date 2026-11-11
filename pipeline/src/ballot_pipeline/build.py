"""Offline build: raw INEC files -> data/generated/. Returns everything verify.py needs to check."""

from __future__ import annotations

import dataclasses
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import yaml

from . import extract as ex
from .geo import GeoError, WorkbookUnit, key, read_locator, read_workbook, resolve_composition
from .models import Candidate, Lga, Person, PlacementNote, PollingUnit, PrintingNote, Provenance, Race, StateGeo, Ward
from .ordering import ORDER_RULE, display_order, order_candidates
from .parties import parse_parties
from .paths import ALIASES_YAML, DATA_DIR, GENERATED_DIR, PIPELINE_DIR, RAW_DIR, SOURCES_YAML
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
    sha_report: dict | None = None
    errors: list[str] = field(default_factory=list)
    first_group: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        # review 5: a positional field shift once dropped every accumulated error; errors must be a list of strings
        if not isinstance(self.errors, list) or not all(isinstance(e, str) for e in self.errors):
            raise TypeError("BuildResult.errors must be a list of strings")


# ---------------------------------------------------------------- helpers


def st_of(ward_code: str) -> str:
    """'24/15/03' -> 'LAGOS'."""
    from .states import STATES

    return STATES[ward_code.split("/")[0]]


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
    rows = ex.extract_pdf(str(RAW_DIR / src["local_file"]), src["source_id"], ticket=src.get("race") in ("president", "governor"))
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


FIRST_GROUP_YAML = DATA_DIR / "overrides" / "first-group.yaml"


def load_first_group(registered: set[str]) -> dict:
    """The owner's first group (D-042): exactly five registered parties, from one cited measure."""
    fg = yaml.safe_load(FIRST_GROUP_YAML.read_text())
    parties = [p["acronym"] for p in fg["parties"]]
    if len(parties) != 5 or len(set(parties)) != 5:
        raise ValueError(f"first-group.yaml must name exactly five different parties, not {parties}")
    if not set(parties) <= registered:
        raise ValueError(f"first-group.yaml names parties not on INEC's register: {sorted(set(parties) - registered)}")
    if not fg.get("label") or not fg.get("sources"):
        raise ValueError("first-group.yaml needs the label shown on the page and its sources")
    return {**fg, "parties": parties, "measure_values": fg["parties"]}


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
    first_group = load_first_group(set(party_names))
    aliases = _load_aliases()

    # ---- candidate rows
    rows_by_source: dict[str, list[ex.Row]] = {}
    independent_sn: dict[str, list[int]] = {}
    for s in sources:
        if s.get("local_file", "").endswith(".pdf") and s.get("race"):  # candidate lists; reference documents are only hashed
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
    from .manifest import verify_pu_manifest

    errors.extend(verify_pu_manifest())
    locator = read_locator()
    lga_names_by_state = {st: [l.name for l in lgas] for st, (_, lgas) in locator.items()}
    comp_overrides = aliases.get("composition_overrides") or {}
    for code, ov in comp_overrides.items():
        src = by_id.get(ov.get("source_id", ""))
        if not src or "sha256" not in src:
            errors.append(f"override {code}: source_id {ov.get('source_id')!r} is not a hashed source")
        for f in ("row", "workbook_text", "reading", "lgas"):
            if f not in ov:
                errors.append(f"override {code}: missing {f}")
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

    # ---- printing errors (pinned to the printed value)
    printing = yaml.safe_load((PIPELINE_DIR / "printing_errors.yaml").read_text()) or []
    printing_by_row: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for e in printing:  # serial numbers restart per state in consolidated files, so an entry may also name its page
        printing_by_row[(e["source_id"], e["sn"])].append(e)
    printing_used: set[int] = set()

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
            if office == "president":
                k = (office, None, "NIGERIA")
            elif office == "governor":
                k = (office, r.state, "GOVERNOR")
            else:
                k = (office, r.state, key(r.constituency))
            grouped[k].append(r)
            race_sources[k].add(sid)
            spellings[k][r.state if office == "governor" else (r.constituency or "Nigeria")] += 1

    races: list[Race] = []
    inec_order_matches: dict[str, bool] = {}
    fc_to_race: dict[str, str] = {}
    sd_to_race: dict[str, str] = {}
    sha_race_by_name: dict[tuple[str, str], str] = {}
    for gkey, rows in sorted(grouped.items(), key=lambda kv: (kv[0][0], kv[0][1] or "", kv[0][2])):
        office, state, _ = gkey
        # Display INEC's most frequent spelling (ties: first alphabetically), verbatim.
        cname = sorted(spellings[gkey].items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        election = "feb-2027" if office in ("governor", "state_assembly") else ELECTION
        if office == "president":
            race_id, unit = f"{ELECTION}-president", None
        elif office == "governor":
            race_id, unit = f"feb-2027-governor-{slug(state)}", None
        elif office == "state_assembly":
            race_id, unit = f"feb-2027-sha-{slug(state)}-{slug(cname)}", None
            sha_race_by_name[(state, cname)] = race_id
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

        ballot_pos = {id(r): i for i, r in enumerate(order_candidates(rows, lambda r: r.party), start=1)}
        cands = []
        groups = {}
        for r, group in display_order(rows, lambda r: r.party, first_group["parties"]):
            groups[id(r)] = group
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
        cand_notes = {}
        for r, _, _ in cands:
            notes = []
            for e in printing_by_row.get((r.source_id, r.sn), []):
                if e.get("page") and e["page"] != r.page:
                    continue
                person = r.candidate if e["person"] == "candidate" else r.running_mate
                actual = r.remarks if e["field"] == "remarks" else getattr(person, e["field"], None)
                if actual != e["as_printed"]:
                    errors.append(f"printing_errors.yaml {e['source_id']} SN {e['sn']}: INEC now prints {actual!r}, "
                                  f"not {e['as_printed']!r}; review the entry")
                    continue
                printing_used.add(id(e))
                notes.append(PrintingNote(person=e["person"], field=e["field"], as_printed=e["as_printed"]))
            cand_notes[(r.source_id, r.page, r.sn)] = notes
        races.append(
            Race(
                id=race_id, election=election, office=office, state=state, name=cname,
                workbook_code=unit.code if unit else None, order_rule=ORDER_RULE,
                sources=sorted(race_sources[gkey]),
                candidates=[
                    Candidate(
                        id=f"{race_id}-{r.party.lower()}", race_id=race_id, party=r.party,
                        party_name=party_names.get(r.party), ballot_position=ballot_pos[id(r)], display_group=groups[id(r)],
                        remarks=r.remarks,
                        candidate=cand, running_mate=mate, printing_notes=cand_notes[(r.source_id, r.page, r.sn)],
                        provenance=Provenance(source_id=r.source_id, page=r.page, sn=r.sn),
                    )
                    for r, cand, mate in cands
                ],
            )
        )

    for e in printing:
        if id(e) not in printing_used and not any(f"{e['source_id']} SN {e['sn']}" in x for x in errors):
            errors.append(f"printing_errors.yaml entry {e['source_id']} SN {e['sn']} matched no candidate row")

    # ---- presidential background (D-013): all or none, validated in background.py
    from .background import load as load_background

    pres = next((r for r in races if r.office == "president"), None)
    if pres:
        people = {}
        for c in pres.candidates:
            if c.candidate.name:
                people[(c.id, "candidate")] = c.candidate.name
            if c.running_mate and c.running_mate.name:
                people[(c.id, "running_mate")] = c.running_mate.name
        backgrounds, bg_errors = load_background(people)
        errors.extend(bg_errors)
        if backgrounds and not bg_errors:
            new_cands = []
            for c in pres.candidates:
                cand = c.candidate.model_copy(update={"background": backgrounds.get((c.id, "candidate"))})
                mate = (c.running_mate.model_copy(update={"background": backgrounds.get((c.id, "running_mate"))})
                        if c.running_mate else None)
                new_cands.append(c.model_copy(update={"candidate": cand, "running_mate": mate}))
            races = [r.model_copy(update={"candidates": new_cands}) if r.id == pres.id else r for r in races]

    # ---- placement notes, shown on the race (D-021)
    unit_by_code = {u.code: u for u in workbook}
    race_by_code = {r.workbook_code: r for r in races if r.workbook_code}
    notes_by_race: dict[str, list[PlacementNote]] = defaultdict(list)
    for n in aliases.get("placement_notes") or []:
        u = unit_by_code.get(n["unit"])
        if not u or u.row != n["row"] or u.composition != re.sub(r"\s+", " ", n["inec_text"]).strip():
            errors.append(f"placement note {n['unit']}: row/text no longer match INEC's workbook; review it again")
            continue
        if n["lga"] not in u.lgas:
            errors.append(f"placement note {n['unit']}: {n['lga']} is not among the unit's LGAs {u.lgas}")
            continue
        notes_by_race[race_by_code[n["unit"]].id].append(PlacementNote(
            lga=n["lga"], kind=n["kind"], reason=re.sub(r"\s+", " ", n["reason"]).strip(), inec_text=n["inec_text"],
            source_id=n["source_id"], row=n["row"]))
    races = [r.model_copy(update={"placement_notes": notes_by_race.get(r.id, [])}) for r in races]

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

    # ---- 6 February: ward -> State House of Assembly constituency (D-028)
    from .sha_reconcile import reconcile
    from .state_constituencies import StateGeoIndex, count_anomalies, map_state_constituencies

    geo_dicts = {st: {"name": st, "lgas": [{"name": l.name, "wards": [{"code": f"{sc_}/{l.code}/{w[0]}", "name": w[1]}
                                                                     for w in l.wards]} for l in lgas]}
                 for st, (sc_, lgas) in locator.items()}
    ward_spellings_full = {c: d for c, d in (yaml.safe_load((PIPELINE_DIR / "ward_spellings.yaml").read_text()) or {}).items()
                           if not c.startswith("_")}
    ward_spellings = {c: {f: v["code"] for f, v in d.items()} for c, d in ward_spellings_full.items()}
    sc_units, _, sc_errors = map_state_constituencies(
        str(RAW_DIR / by_id["inec-constituencies-workbook"]["local_file"]), geo_dicts,
        {st: {key(k): v for k, v in d.items()} for st, d in (aliases.get("lga_spellings") or {}).items()},
        aliases.get("state_constituency_overrides") or {}, ward_spellings)
    errors.extend(e for e in sc_errors if "no LGA found" not in e)  # unplaced workbook rows are settled by the 2027 list
    sc_idx = {st: StateGeoIndex(g, {key(k): v for k, v in (aliases.get("lga_spellings") or {}).get(st, {}).items()})
              for st, g in geo_dicts.items()}
    list_names: dict[str, list[str]] = defaultdict(list)
    for (st, name) in sha_race_by_name:
        list_names[st].append(name)
    from .override_checks import check_sha_overrides

    printed_at: dict[tuple[str, str], set[tuple[int, int]]] = defaultdict(set)
    for r in races:
        if r.office == "state_assembly":
            printed_at[(r.state, r.name)] |= {(c.provenance.page, c.provenance.sn) for c in r.candidates}
    ward_lga = {w["code"]: (st, l["name"]) for st, g in geo_dicts.items() for l in g["lgas"] for w in l["wards"]}
    from .override_checks import check_ward_spellings

    ward_info = {w["code"]: (st, l["name"], w["name"]) for st, g in geo_dicts.items() for l in g["lgas"] for w in l["wards"]}
    errors.extend(check_ward_spellings(ward_spellings_full, {s.code: s for s in sc_units},
                                       {s["source_id"] for s in sources if "sha256" in s}, ward_info))
    errors.extend(check_sha_overrides(aliases.get("state_constituency_overrides") or {}, aliases.get("sha_lga_overrides") or {},
                                      {s["source_id"] for s in sources if "sha256" in s}, sc_units, ward_lga, printed_at))
    sha_list, ward_to_sha, sha_notes, sha_errors = reconcile(dict(list_names), sc_units, sc_idx,
                                                              aliases.get("sha_links") or {}, aliases.get("sha_lga_overrides") or {})
    errors.extend(sha_errors)
    ward_to_sha_races = {w: sorted(sha_race_by_name[(st_of(w), n)] for n in names) for w, names in ward_to_sha.items()}
    # D-030: IReV's 2023 ward lists settle or check the ward -> State Assembly mapping
    sha_how: dict[str, str] = {}
    irev_report: list[str] = []
    irev_reg = reg.get("irev")
    if irev_reg:  # registered means required: a missing cache or manifest fails the build instead of hiding OI-13 (review 5b)
        from .irev import load as load_irev
        from .irev import verify_manifest as verify_irev
        from .irev_apply import apply_irev

        from .irev import preconditions as irev_preconditions

        errors.extend(irev_preconditions(irev_reg, by_id, RAW_DIR / "irev"))
        errors.extend(verify_irev())
        irev_wards, irev_problems, irev_errors = load_irev()
        errors.extend(irev_errors)
        ward_names = {w["code"]: (st, l["name"], w["name"]) for st, g in geo_dicts.items() for l in g["lgas"] for w in l["wards"]}
        ward_to_sha_races, sha_how, irev_report = apply_irev(ward_to_sha_races, sha_list, sha_race_by_name, irev_wards, ward_names)
        irev_report = [p for p in irev_problems if not p.startswith("IReV ward 37/")] + irev_report  # the FCT has no assembly
    from .override_checks import evidence_ward_gaps

    race_by_wb: dict[str, list[str]] = defaultdict(list)
    for x in sha_list:
        if x.workbook:
            race_by_wb[x.workbook.code].append(sha_race_by_name[(x.state, x.name)])
    errors.extend(evidence_ward_gaps(aliases.get("state_constituency_overrides") or {}, race_by_wb, ward_to_sha_races))
    sha_report = {"notes": sha_notes, "count_anomalies": count_anomalies(sc_units),
                  "workbook_per_state": dict(sorted(Counter(s.state for s in sc_units).items())),
                  "constituencies": [{"state": x.state, "name": x.name, "race_id": sha_race_by_name[(x.state, x.name)],
                                      "lgas": x.lgas, "lga_by": x.lga_by, "workbook": x.workbook.code if x.workbook else None,
                                      "wards": len(x.wards)} for x in sha_list],
                  "irev": {"report": irev_report, "how": dict(Counter(sha_how.values()))}}

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
                open_item = ("OI-9" if f"{state}|{l.name}" in pending_splits else
                             "OI-10" if f"{state}|{l.name}" in pending_sd else None)
                pending = open_item is not None
                if len(fc_races) != 1 or len(sd_races) != 1:
                    unresolved_wards.append({"state": state, "lga": l.name, "ward": code, "federal_constituencies": fc_races,
                                             "senatorial_districts": sd_races, "pending_split": pending})
                    if not fc_races or not sd_races:
                        continue
                exact = len(fc_races) == 1 and len(sd_races) == 1
                sha = ward_to_sha_races.get(code, [])
                wards.append(Ward(
                    code=code, name=w_name, federal_constituency=fc_races, senatorial_district=sd_races,
                    mapping="exact" if exact else "unresolved", open_item=None if exact else open_item,
                    state_constituency=sha, sc_mapping="none" if not sha else "exact" if len(sha) == 1 else "unresolved",
                    sc_open_item=("OI-13" if sha_how.get(code) == "disagree" else "OI-6") if len(sha) > 1 else None,
                    sc_sources=([] if not sha else ["sha-2026-10-10", "inec-constituencies-workbook"]
                                + (["inec-irev-2023-assembly"] if sha_how.get(code) else [])),
                    polling_units=[PollingUnit(code=f"{code}/{p_code}", name=p_name) for p_code, p_name in pus],
                ))
            out_lgas.append(Lga(code=f"{s_code}/{l.code}", name=l.name, wards=wards))
        geo[state] = StateGeo(code=s_code, name=state, source_id="inec-pu-locator", lgas=out_lgas)

    from .election_day import build as build_election_day

    errors.extend(build_election_day(by_id))

    locator_counts = {
        "states": len(locator),
        "lgas": sum(len(lgas) for _, lgas in locator.values()),
        "wards": sum(len(l.wards) for _, lgas in locator.values() for l in lgas),
        "pus": sum(len(w[2]) for _, lgas in locator.values() for l in lgas for w in l.wards),
    }
    from .logos import check_logos

    # D-042: recount the measure from the lists themselves; the five must match first-group.yaml exactly, with no tie for fifth.
    fielded = Counter(cd.party for r in races for cd in r.candidates if cd.candidate.name)
    ranked = fielded.most_common()
    top = {p for p, _ in ranked[:5]}
    if top != set(first_group["parties"]) or (len(ranked) > 5 and ranked[4][1] == ranked[5][1]):
        errors.append(f"first group (D-042): the lists now give {ranked[:6]}, not {first_group['parties']}; the owner must review")
    for m in first_group["measure_values"]:
        if fielded[m["acronym"]] != m["value"]:
            errors.append(f"first group (D-042): {m['acronym']} now fields {fielded[m['acronym']]} candidates, not {m['value']}")

    errors.extend(check_logos({cd.party for r in races for cd in r.candidates}))
    result = BuildResult(sources=sources, parties=parties, rows_by_source=rows_by_source, independent_sn=independent_sn, races=races,
                         quarantine=quarantine, workbook=workbook, geo=geo, unresolved_wards=unresolved_wards,
                         inec_order_matches=inec_order_matches, locator_counts=locator_counts, anomalies=anomalies,
                         sha_report=sha_report, errors=errors, first_group=first_group)
    write_outputs(result)
    return result


def write_outputs(res: BuildResult) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    def dump(path, obj):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")

    dump(GENERATED_DIR / "parties.json", res.parties)
    dump(GENERATED_DIR / "first-group.json", res.first_group)
    dump(GENERATED_DIR / "races" / f"{ELECTION}.json", [r.model_dump() for r in res.races if r.election == ELECTION])
    dump(GENERATED_DIR / "races" / "feb-2027.json", [r.model_dump() for r in res.races if r.election == "feb-2027"])
    if res.sha_report:
        dump(GENERATED_DIR / "state-constituencies.json", res.sha_report)
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
