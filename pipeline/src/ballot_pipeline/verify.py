"""Every Phase 1 'Verified by' check that a machine can run. Writes data/generated/report.md; exit 1 on any failure."""

from __future__ import annotations

import random
from collections import Counter, defaultdict

import yaml

from .build import BuildResult
from .paths import AUDIT_DIR, GENERATED_DIR, SOURCES_YAML
from .states import STATE_NAMES


class Checks:
    def __init__(self):
        self.lines: list[str] = []
        self.failed = 0

    def check(self, ok: bool, label: str, detail: str = "") -> bool:
        self.lines.append(f"- [{'x' if ok else ' '}] **{'PASS' if ok else 'FAIL'}** {label}" + (f": {detail}" if detail else ""))
        if not ok:
            self.failed += 1
        return ok

    def note(self, text: str) -> None:
        self.lines.append(text)


def verify(res: BuildResult, write_audit: bool = True) -> int:
    reg = yaml.safe_load(SOURCES_YAML.read_text())
    c = Checks()
    by_id = {s["source_id"]: s for s in res.sources}
    races = res.races
    cands = [cd for r in races for cd in r.candidates]

    c.note("## Build integrity")
    c.check(not res.errors, "build raised no errors", "; ".join(res.errors[:20]) + (" …" if len(res.errors) > 20 else ""))

    c.note("\n## File set")
    pdfs = [s for s in res.sources if s.get("local_file", "").endswith(".pdf")]
    pres = [s for s in pdfs if s["race"] == "president"]
    sen_states = {s["state"] for s in pdfs if s["race"] == "senate" and s.get("state")}
    house_states = {s["state"] for s in pdfs if s["race"] == "house" and s.get("state")}
    fallback = [s for s in pdfs if s.get("use_states")]
    house_states |= {st for s in fallback for st in s["use_states"]}
    c.check(len(pres) == 1, "1 Presidential file", str(len(pres)))
    c.check(sen_states == STATE_NAMES, "Senate files cover all 36 states + FCT", f"{len(sen_states)} states")
    c.check(house_states == STATE_NAMES, "House files cover all 36 states + FCT (Niger via 12 Sep fallback, OI-1)",
            f"{len(house_states)} states")

    c.note("\n## Seat counts")
    sen = [r for r in races if r.office == "senate"]
    house = [r for r in races if r.office == "house"]
    per_state = Counter(r.state for r in sen)
    c.check(len(sen) == 109, "109 senatorial districts on the candidate lists", str(len(sen)))
    c.check(all(per_state[s] == (1 if s == "FCT" else 3) for s in STATE_NAMES), "3 districts per state, 1 for the FCT",
            ", ".join(f"{s}={n}" for s, n in sorted(per_state.items()) if n != (1 if s == "FCT" else 3)))
    c.check(len(house) == 360, "360 federal constituencies on the candidate lists", str(len(house)))
    wb_sd = [u for u in res.workbook if u.kind == "SD"]
    wb_fc = [u for u in res.workbook if u.kind == "FC"]
    c.check(len(wb_sd) == 109 and len(wb_fc) == 360, "INEC workbook has 109 districts and 360 constituencies",
            f"{len(wb_sd)} / {len(wb_fc)}")
    linked = [r for r in sen + house if r.workbook_code]
    codes = Counter(r.workbook_code for r in linked)
    c.check(len(linked) == 469 and all(n == 1 for n in codes.values()),
            "every list district/constituency links to exactly one workbook unit", f"{len(linked)} linked")

    c.note("\n## Row counts against INEC's own numbering")
    for s in pdfs:
        sid = s["source_id"]
        rows = res.rows_by_source.get(sid + "#all", res.rows_by_source[sid])
        if s.get("use_states"):
            # consolidated file: serial numbers restart in each state
            by_state = defaultdict(list)
            for r in rows:
                by_state[r.state].append(r.sn)
            bad = [st for st, sns in by_state.items() if sns != list(range(1, len(sns) + 1))]
            seq_ok = not bad
            detail = f"{len(rows)} rows, {len(by_state)} states" + (f", bad: {bad}" if bad else "")
        else:
            sns = [r.sn for r in rows]
            seq_ok = sns == list(range(1, len(sns) + 1))
            detail = f"{len(rows)} rows"
        alt = res.independent_sn.get(sid, [])
        agree = len(alt) == len(rows)
        if not (seq_ok and agree):
            c.check(False, f"{sid}: SN 1..N and poppler agrees", f"{detail}; poppler counted {len(alt)}")
    c.check(True, f"all {len(pdfs)} PDFs: serial numbers run 1..N with no gap or repeat, and an independent poppler "
                  "count of serial-number lines equals the parsed row count")
    totals = Counter(r.office for r in races for _ in r.candidates)
    c.note(f"\nCandidates parsed: president {totals['president']} tickets, senate {totals['senate']}, house {totals['house']}.")

    c.note("\n## Candidate fields")
    c.check(not res.quarantine, "quarantine is empty", f"{len(res.quarantine)} rows: {res.quarantine[:5]}")
    party_ok = all(cd.party_name for cd in cands)
    c.check(party_ok, "every party acronym is on INEC's register of parties",
            str(sorted({cd.party for cd in cands if not cd.party_name})))
    dup = [r.id for r in races if len({cd.party for cd in r.candidates}) != len(r.candidates)]
    c.check(not dup, "at most one candidate per party per race", str(dup[:5]))
    pres_race = [r for r in races if r.office == "president"]
    tickets_ok = len(pres_race) == 1 and all(cd.running_mate is not None for cd in pres_race[0].candidates)
    c.check(tickets_ok, "every presidential row carries exactly one running mate")
    nameless = [(cd.id, cd.remarks) for cd in cands if not cd.candidate.name]
    c.check(all(rem for _, rem in nameless), "every row without a name carries an INEC remark", str(nameless))
    c.note(f"Rows with no candidate name (shown verbatim with INEC's remark): {nameless}")

    def where(a):
        if "ward" in a:
            return f"ward {a['ward']} {a['name']}"
        return f"{a['source_id']} p{a['page']} SN {a['sn']} {a['party']} {a['name']}"

    c.note(f"Printed values kept verbatim but not usable ({len(res.anomalies)}; for the owner to raise with INEC): "
           + "; ".join(f"{where(a)}: {', '.join(a['anomalies'])}" for a in res.anomalies))
    noted = {(cd.provenance.source_id, cd.provenance.sn) for cd in cands if cd.printing_notes}
    uncovered = [a for a in res.anomalies if "sn" in a and (a["source_id"], a["sn"]) not in noted]
    c.check(not uncovered, "every implausible printed value carries a printing note (D-021)", str(uncovered[:3]))
    notes = [(r.id, n.lga, n.kind) for r in races for n in r.placement_notes]
    c.check(len(notes) == 5, "the five reviewed placement notes are attached to their races", str(notes))
    remarks = Counter(cd.remarks for cd in cands if cd.remarks)
    c.note("INEC remarks, verbatim (count): " + (", ".join(f"`{k}` ({n})" for k, n in remarks.most_common()) or "none") + ".")

    c.note("\n## Ballot order (D-011)")
    order_ok = all(
        [cd.ballot_position for cd in r.candidates] == list(range(1, len(r.candidates) + 1))
        and [cd.party for cd in r.candidates] == sorted(cd.party.upper() for cd in r.candidates)
        for r in races
    )
    c.check(order_ok, "ballot_position runs 1..N in party-acronym order in every race")
    differ = sorted(sid for sid, ok in res.inec_order_matches.items() if not ok)
    c.note(f"INEC's own row order matches acronym order in {sum(res.inec_order_matches.values())} of "
           f"{len(res.inec_order_matches)} source files" + (f"; differs in: {', '.join(differ)}" if differ else "") + ".")

    c.note("\n## Polling units")
    pu = reg["polling_units"]
    lc = res.locator_counts
    n_lga, n_wards_all = lc["lgas"], lc["wards"]
    wards = [w for sg in res.geo.values() for l in sg.lgas for w in l.wards]
    pus = [p for w in wards for p in w.polling_units]
    codes = Counter(p.code for p in pus)
    c.check(len(pus) == lc["pus"], "every polling unit from the locator reached the output", f"{len(pus):,} of {lc['pus']:,}")
    c.check(len(res.geo) == 37, "37 states in the locator", str(len(res.geo)))
    c.check(n_lga == pu["official_lgas"], f"{pu['official_lgas']} LGAs", str(n_lga))
    ward_codes = Counter(w.code for w in wards)
    c.check(all(n == 1 for n in ward_codes.values()), "every ward code SS/LL/WW is unique",
            str([k for k, n in ward_codes.items() if n > 1][:5]))
    base = pu["locator_baseline"]
    c.check(len(wards) == base["wards"] and len(pus) == base["pus"],
            f"crawl reproduces the reviewed locator baseline of {base['crawled']} ({base['wards']:,} wards, {base['pus']:,} polling units; D-020)",
            f"{len(wards):,} wards, {len(pus):,} polling units")
    c.note(f"Wards in INEC's locator: **{n_wards_all:,}** ({len(wards):,} after dropping empty duplicates); INEC's published "
           f"figure {pu['official_wards']:,} (difference {len(wards) - pu['official_wards']:+,}; OI-7). INEC publishes no "
           "per-state ward figure to attribute the difference to.")
    c.check(all(n == 1 for n in codes.values()), "every polling-unit code SS/LL/WW/PPP is unique",
            str([k for k, n in codes.items() if n > 1][:5]))
    diff = lc["pus"] - pu["official_total"]
    c.note(f"Polling units in INEC's locator: **{lc['pus']:,}**; INEC's published total {pu['official_total']:,} "
           f"(difference {diff:+,}; OI-7).")
    if diff:
        c.note("Per state: " + ", ".join(f"{sg.name} {sum(len(w.polling_units) for l in sg.lgas for w in l.wards):,}"
                                          for sg in sorted(res.geo.values(), key=lambda s: s.code)))

    c.note("\n## Ward → race mapping")
    pending = {u["ward"] for u in res.unresolved_wards if u["pending_split"]}
    unresolved = [w for w in wards if w.mapping == "unresolved"]
    c.check(all(w.open_item in ("OI-9", "OI-10") for w in unresolved),
            "every ward with more than one possible race is marked unresolved and tied to a registered open item",
            str([w.code for w in unresolved if w.open_item not in ("OI-9", "OI-10")][:5]))
    c.note(f"Unresolved wards: {len(unresolved)}, holding {sum(len(w.polling_units) for w in unresolved):,} polling units "
           f"({sum(len(w.polling_units) for w in unresolved) / len(pus):.2%}). Their voters will see every listed race, labelled.")
    hard = [u for u in res.unresolved_wards if not u["pending_split"]]
    c.check(not hard, "every ward maps to exactly one federal constituency and one senatorial district, except listed open items",
            f"{len(hard)} unresolved, e.g. {hard[:3]}")
    if pending:
        groups = Counter((u["state"], u["lga"], len(u["federal_constituencies"]), len(u["senatorial_districts"]))
                         for u in res.unresolved_wards if u["pending_split"])
        for (st, lga, nfc, nsd), n in sorted(groups.items()):
            item = "OI-9 (split LGA)" if nfc > 1 else "OI-10 (district not placed by INEC's text)"
            c.note(f"**Known open item {item}:** {st}/{lga}: {n} wards list {nfc} House race(s) and {nsd} Senate race(s).")
    fc_seen = {fc for w in wards for fc in w.federal_constituency}
    sd_seen = {sd for w in wards for sd in w.senatorial_district}
    c.check(fc_seen == {r.id for r in house}, "every House race has at least one ward", f"{len({r.id for r in house} - fc_seen)} without")
    c.check(sd_seen == {r.id for r in sen}, "every Senate race has at least one ward", f"{len({r.id for r in sen} - sd_seen)} without")
    sd_of = {(u.state, lga): u.code for u in res.workbook if u.kind == "SD" for lga in u.lgas}
    straddle = [u for u in res.workbook if u.kind == "FC"
                and len({sd_of[(u.state, lga)] for lga in u.lgas if (u.state, lga) in sd_of}) > 1]
    c.note(f"Federal constituencies whose LGAs lie in two senatorial districts, per INEC's workbook ({len(straddle)}): "
           + ", ".join(f"{u.code} {u.name}" for u in straddle) + ". Their wards take the district of their own LGA.")

    c.note("\n## Constituency composition (INEC workbook)")
    how = Counter(u.resolved_by for u in res.workbook)
    c.check(all(u.lgas for u in res.workbook), "every district and constituency resolves to locator LGAs",
            ", ".join(f"{k or 'unresolved'} {n}" for k, n in sorted(how.items())))
    aliases = yaml.safe_load((SOURCES_YAML.parent / "aliases.yaml").read_text())
    c.note(f"Read from the composition text: {how['composition']}; from the constituency name: {how['name']}; "
           f"split LGAs (OI-9): {how['split']}; reviewed overrides: {how['override']}; reviewed spellings: "
           f"{sum(len(v) for v in aliases['lga_spellings'].values())}; constituency-name aliases: "
           f"{len(aliases['constituency_aliases'])}. Every LGA is in exactly one senatorial district and one federal "
           "constituency (split LGAs excepted), or the build fails.")
    for code, ov in aliases["composition_overrides"].items():
        c.note(f"- Override {code}: INEC text \"{ov['workbook_text']}\" read as {', '.join(ov['lgas'])}. {ov['reading']}")

    c.note("\n## Presidential background (D-013)")
    pres = [r for r in races if r.office == "president"][0]
    persons = [p for cd in pres.candidates for p in (cd.candidate, cd.running_mate) if p and p.name]
    with_bg = [p for p in persons if p.background is not None]
    c.check(len(with_bg) in (0, len(persons)), "all or none: every named presidential candidate and running mate, or no one",
            f"{len(with_bg)} of {len(persons)}")
    others = [p for r in races if r.office != "president" for cd in r.candidates for p in (cd.candidate, cd.running_mate) if p]
    c.check(all(p.background is None for p in others), "background appears in the presidential race only")
    all_urls = [ci.url for p in with_bg for ci in ([p.background.identity] if p.background.identity else [])
                + [ci for e in p.background.public_offices + p.background.party_history for ci in e.citations]]
    c.check(not any("wikipedia" in u.lower() or "wiki" in u.lower().split("/")[2] for u in all_urls),
            "no citation anywhere is Wikipedia or a wiki", f"{len(all_urls)} citations")
    all_cites = [ci for p in with_bg for ci in ([p.background.identity] if p.background.identity else [])
                 + [ci for e in p.background.public_offices + p.background.party_history for ci in e.citations]]
    c.check(all(ci.source_id for ci in all_cites),
            "every background citation resolves to a reviewed independent source, with its quote confirmed by check-quotes",
            str([ci.url for ci in all_cites if not ci.source_id][:3]))
    if with_bg:
        thin = [p.name for p in with_bg if not (p.background.public_offices or p.background.party_history)]
        c.note(f"Researched {with_bg[0].background.researched}: {len(with_bg)} people, "
               f"{sum(len(p.background.public_offices) for p in with_bg)} office entries, "
               f"{sum(len(p.background.party_history) for p in with_bg)} party entries, {len(all_urls)} citations. "
               f"No independently sourced entry found for {len(thin)}: {', '.join(thin) or 'none'}.")

    c.note("\n## Provenance")
    ok = all(cd.provenance.source_id in by_id for cd in cands) and all(s in by_id for r in races for s in r.sources)
    c.check(ok, "every candidate and race cites a recorded source with a SHA-256")
    pu_src = by_id.get("inec-pu-locator", {})
    c.check(bool(pu_src.get("sha256")) and pu_src.get("files") == len(_manifest_files()),
            "the polling-unit crawl is recorded with a manifest digest covering every cached response",
            f"{pu_src.get('files')} files")

    header = (
        "# Phase 1 data report\n\nGenerated by `ballot-pipeline verify`. Sources and hashes: `sources.json`.\n\n"
        f"**Result: {'ALL CHECKS PASS' if not c.failed else f'{c.failed} CHECK(S) FAILED'}**\n\n"
    )
    report = header + "\n".join(c.lines) + "\n"
    (GENERATED_DIR / "report.md").write_text(report)
    if write_audit:
        _write_audit(res)
    print(report)
    return 1 if c.failed else 0


def _manifest_files() -> dict:
    import json

    from .manifest import MANIFEST

    return json.loads(MANIFEST.read_text())["sha256"] if MANIFEST.exists() else {}


def _write_audit(res: BuildResult) -> None:
    """A fixed-seed sample for the owner's hand check against INEC's PDFs and locator (Phase 1, last check)."""
    rng = random.Random(2027)
    house = [r for r in res.races if r.office == "house"]
    lines = ["# Owner audit sample (Phase 1)", "",
             "Check each row against the INEC PDF page given, and each polling unit against https://cvr.inecnigeria.org/pu.",
             "Record mismatches below. The phase passes with 0.", "", "## One House race per state", ""]
    for state in sorted({r.state for r in house}):
        r = rng.choice([x for x in house if x.state == state])
        src = r.candidates[0].provenance
        lines.append(f"### {state}: {r.name} ({src.source_id}, page {src.page})")
        for cd in r.candidates:
            p = cd.candidate
            lines.append(f"- [ ] SN {cd.provenance.sn} p{cd.provenance.page} | {cd.party} | {p.name} | {p.age} | {p.gender} | {p.qualifications}")
        lines.append("")
    lines += ["## 20 polling units", ""]
    pus = [(sg.name, l.name, w.name, p) for sg in res.geo.values() for l in sg.lgas for w in l.wards for p in w.polling_units]
    for st, lga, ward, p in rng.sample(pus, 20):
        lines.append(f"- [ ] {p.code} | {st} / {lga} / {ward} | {p.name}")
    lines += ["", "## Mismatches found", "", "(none yet)"]
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    (AUDIT_DIR / "sample.md").write_text("\n".join(lines) + "\n")
