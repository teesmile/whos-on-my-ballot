import pytest
import yaml

from ballot_pipeline import background

PEOPLE = {("jan-2027-president-x", "candidate"): "DOE JOHN", ("jan-2027-president-x", "running_mate"): "ROE JANE"}
CITE = {"url": "https://www.premiumtimesng.com/a", "publisher": "Premium Times", "title": "A report", "published": "2026-01-01",
        "quote": "John Doe was governor of X State from 1999 to 2007", "retrieved": "2026-11-09"}


def person(role, name, offices=(), parties=(), identity=CITE):
    return {"candidate_id": "jan-2027-president-x", "role": role, "inec_name": name, "identity": identity,
            "public_offices": [{"text": t, "citations": [CITE]} for t in offices],
            "party_history": [{"text": t, "citations": [CITE]} for t in parties]}


REG = {"www.premiumtimesng.com": ("premiumtimes", {"publisher": "Premium Times", "ownership": "private"}),
       "founder.example": ("founder", {"publisher": "Founder News", "ownership": "founded by the X candidate",
                                       "not_independent_for": ["jan-2027-president-x"]})}


@pytest.fixture
def write(tmp_path, monkeypatch):
    import json

    f = tmp_path / "bg.yaml"
    checks = tmp_path / "checks.json"
    monkeypatch.setattr(background, "FILE", f)
    monkeypatch.setattr(background, "QUOTE_CHECK", checks)
    monkeypatch.setattr(background, "registry", lambda: REG)

    def _write(people, confirmed=True):
        f.write_text(yaml.safe_dump({"researched": "2026-11-09", "people": people}))
        cites = [c for p in people for c in ([p["identity"]] if p["identity"] else [])
                 + [c for k in ("public_offices", "party_history") for e in p[k] for c in e["citations"]]]
        checks.write_text(json.dumps({"results": {f"{c['url']}\n{c['quote']}": {"result": "ok" if confirmed else "quote not found"}
                                                  for c in cites}}))
    return _write


def test_absent_file_means_none(tmp_path, monkeypatch):
    monkeypatch.setattr(background, "FILE", tmp_path / "missing.yaml")
    assert background.load(PEOPLE) == ({}, [])


def test_valid_records(write):
    write([person("candidate", "DOE JOHN", offices=["Governor of X State, 1999–2007"]), person("running_mate", "ROE JANE")])
    out, errors = background.load(PEOPLE)
    assert errors == [] and len(out) == 2


def test_all_or_none(write):
    write([person("candidate", "DOE JOHN")])
    assert any("all-or-none" in e for e in background.load(PEOPLE)[1])


@pytest.mark.parametrize("url", ["https://en.wikipedia.org/wiki/X", "https://www.facebook.com/x", "https://x.com/y",
                                 "https://someone.blogspot.com/p", "https://medium.com/@a/b"])
def test_banned_sources(write, url):
    bad = dict(CITE, url=url)
    p = person("candidate", "DOE JOHN")
    p["public_offices"] = [{"text": "Senator (X)", "citations": [bad]}]
    write([p, person("running_mate", "ROE JANE")])
    assert any("not an allowed source" in e for e in background.load(PEOPLE)[1])


def test_evaluative_words_rejected(write):
    write([person("candidate", "DOE JOHN", offices=["Popular Governor of X State"]), person("running_mate", "ROE JANE")])
    assert any("evaluative" in e for e in background.load(PEOPLE)[1])


def test_entries_need_identity(write):
    write([person("candidate", "DOE JOHN", offices=["Senator (X)"], identity=None), person("running_mate", "ROE JANE", identity=None)])
    assert any("identity" in e for e in background.load(PEOPLE)[1])


def test_entry_without_citation_rejected(write):
    p = person("candidate", "DOE JOHN")
    p["party_history"] = [{"text": "Member of the X Party (XP)", "citations": []}]
    write([p, person("running_mate", "ROE JANE")])
    assert background.load(PEOPLE)[1]


def test_name_must_match_inec(write):
    write([person("candidate", "JOHN DOE"), person("running_mate", "ROE JANE")])
    assert any("differs from INEC" in e for e in background.load(PEOPLE)[1])


def test_years_must_come_from_a_quote(write):
    write([person("candidate", "DOE JOHN", parties=["Presidential candidate of the X Party (XP), 2023 election"]),
           person("running_mate", "ROE JANE")])
    assert any("year 2023" in e for e in background.load(PEOPLE)[1])


def test_quote_matching_ignores_typography_but_not_words():
    from ballot_pipeline.quotes import page_text, quote_on_page

    text = page_text(b"<p>He was the \xe2\x80\x9cGovernor\xe2\x80\x9d of  Lagos State \xe2\x80\x93 1999 to 2007.</p><script>x</script>")
    assert quote_on_page('He was the "Governor" of Lagos State - 1999', text)
    assert quote_on_page("He was the ... Lagos State", text)
    assert not quote_on_page("He was the Governor of Ogun State", text)


def test_unreviewed_source_rejected(write):
    p = person("candidate", "DOE JOHN")
    p["public_offices"] = [{"text": "Senator (X)", "citations": [dict(CITE, url="https://candidate.example/campaign/biography")]}]
    write([p, person("running_mate", "ROE JANE")])
    assert any("not a reviewed independent source" in e for e in background.load(PEOPLE)[1])


def test_source_tied_to_the_ticket_rejected(write):
    p = person("candidate", "DOE JOHN")
    p["party_history"] = [{"text": "Member of the X Party (XP)", "citations": [dict(CITE, url="https://founder.example/a")]}]
    write([p, person("running_mate", "ROE JANE")])
    assert any("not independent for this ticket" in e for e in background.load(PEOPLE)[1])


def test_unconfirmed_quote_rejected(write):
    write([person("candidate", "DOE JOHN", offices=["Governor of X State, 1999–2007"]), person("running_mate", "ROE JANE")],
          confirmed=False)
    assert any("not confirmed on the live page" in e for e in background.load(PEOPLE)[1])


def test_valid_citations_get_their_source_id(write):
    write([person("candidate", "DOE JOHN", offices=["Governor of X State, 1999–2007"]), person("running_mate", "ROE JANE")])
    out, errors = background.load(PEOPLE)
    assert errors == []
    assert out[("jan-2027-president-x", "candidate")].public_offices[0].citations[0].source_id == "premiumtimes"
