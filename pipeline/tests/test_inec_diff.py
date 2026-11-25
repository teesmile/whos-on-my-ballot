import json

from ballot_pipeline.inec_diff import compare


def cand(party, name, age="40", rm=None, remarks=""):
    c = {"party": party, "remarks": remarks, "candidate": {"name": name, "age_as_printed": age, "gender": "M", "pwd": "None", "qualifications": "BSc"},
         "running_mate": rm}
    return c


def race(rid, election, *cands):
    return {"id": rid, "election": election, "candidates": list(cands)}


def write(d, jan, feb=()):
    d.mkdir()
    (d / "jan-2027.json").write_text(json.dumps(list(jan)))
    (d / "feb-2027.json").write_text(json.dumps(list(feb)))
    return d


def test_no_change(tmp_path):
    r = [race("jan-2027-house-x", "jan-2027", cand("APC", "A B"), cand("PDP", "C D"))]
    d = compare(write(tmp_path / "a", r), write(tmp_path / "b", r))
    assert d.changed_candidates == 0 and d.reasons_to_wait() == []


def test_small_change_publishes(tmp_path):
    before = [race("jan-2027-house-x", "jan-2027", *[cand(p, f"N{p}") for p in ("A", "APC", "LP", "NDC", "PDP", "SDP")] * 1)]
    after = [race("jan-2027-house-x", "jan-2027", *[cand(p, f"N{p}", age="41" if p == "LP" else "40") for p in ("A", "APC", "LP", "NDC", "PDP", "SDP")])]
    d = compare(write(tmp_path / "a", before), write(tmp_path / "b", after))
    assert d.changed_candidates == 1
    assert "LP: NLP: age_as_printed '40' -> '41'" in d.races[0].changed
    assert d.reasons_to_wait() == []


def test_added_removed_and_remarks(tmp_path):
    before = [race("r1", "jan-2027", cand("APC", "A"), cand("PDP", "B"))]
    after = [race("r1", "jan-2027", cand("APC", "A", remarks="COURT ORDER"), cand("LP", "C"))]
    d = compare(write(tmp_path / "a", before), write(tmp_path / "b", after))
    rc = d.races[0]
    assert rc.added == ["LP: C"] and rc.removed == ["PDP: B"] and rc.changed[0].startswith("APC: A: remarks")


def test_waits_on_25_changes_an_empty_race_or_a_5_percent_shift(tmp_path):
    many_before = [race(f"r{i}", "feb-2027", cand("APC", f"X{i}")) for i in range(30)]
    many_after = [race(f"r{i}", "feb-2027", cand("APC", f"Y{i}")) for i in range(30)]
    d = compare(write(tmp_path / "a", [], many_before), write(tmp_path / "b", [], many_after))
    assert any("30 candidates changed" in w for w in d.reasons_to_wait())

    before = [race("r1", "jan-2027", cand("APC", "A")), *[race(f"s{i}", "jan-2027", cand("APC", "Z")) for i in range(30)]]
    after = [race("r1", "jan-2027", cand("APC", "")), *[race(f"s{i}", "jan-2027", cand("APC", "Z")) for i in range(30)]]
    d = compare(write(tmp_path / "c", before), write(tmp_path / "d", after))
    assert d.empty_races == ["r1"] and any("no candidates" in w for w in d.reasons_to_wait())

    before = [race(f"r{i}", "jan-2027", cand("APC", "A"), cand("PDP", "B")) for i in range(10)]
    after = [race(f"r{i}", "jan-2027", cand("APC", "A"), *([cand("PDP", "B")] if i > 1 else [])) for i in range(10)]
    d = compare(write(tmp_path / "e", before), write(tmp_path / "f", after))
    assert d.totals["jan-2027"] == (20, 18) and any("more than 5%" in w for w in d.reasons_to_wait())
