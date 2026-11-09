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
                                       "tied_to_people": ["jan-2027-president-x"], "tied_to_parties": []}),
       "partypaper.example": ("partypaper", {"publisher": "Party Paper", "ownership": "owned by an X Party senator",
                                             "tied_to_parties": ["X"], "tied_to_people": []}),
       "www.inecnigeria.org": ("inec", {"publisher": "INEC", "ownership": "official", "tied_to_parties": [], "tied_to_people": []})}


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


def test_outlet_tied_to_the_party_rejected(write):
    p = person("candidate", "DOE JOHN")
    p["party_history"] = [{"text": "Member of the X Party (XP)", "citations": [dict(CITE, url="https://partypaper.example/a")]}]
    write([p, person("running_mate", "ROE JANE")])
    assert any("not independent for this ticket" in e for e in background.load(PEOPLE)[1])


def test_archive_copy_counts_as_the_archived_host(write):
    url = "https://web.archive.org/web/20190301000000/https://www.inecnigeria.org/wp-content/uploads/2019/list.pdf"
    p = person("candidate", "DOE JOHN", parties=[])
    p["party_history"] = [{"text": "Presidential candidate of the X Party (XP), 2019 election",
                           "citations": [dict(CITE, url=url, quote="FINAL LIST FOR 2019 GENERAL ELECTION ... DOE JOHN XP")]}]
    write([p, person("running_mate", "ROE JANE")])
    out, errors = background.load(PEOPLE)
    assert errors == [] and out[("jan-2027-president-x", "candidate")].party_history[0].citations[0].source_id == "inec"


def test_quote_found_in_a_real_pdf():
    """INEC's own 2027 presidential list, fetched by `make fetch`: a quote spanning its title and a row."""
    from pathlib import Path

    from ballot_pipeline.quotes import page_text, quote_on_page

    pdf = Path(__file__).resolve().parents[1] / "raw" / "docs" / "president.pdf"
    if not pdf.exists():
        pytest.skip("run `make fetch` first")
    text = page_text(pdf.read_bytes())
    assert quote_on_page("ELECTIONS FOR JAN, 2027 - PRESIDENTIAL ... TINUBU BOLA AHMED", text)


def test_election_day_quotes_are_checked(tmp_path, monkeypatch):
    """A statement whose quote isn't on INEC's page fails the build."""
    import json

    from ballot_pipeline import election_day

    page = tmp_path / "edu.html"
    page.write_text("<p>Polling units open nationwide at 8:30 AM. Voting concludes at 2:30 PM.</p>")
    data = {"elections": [], "hours": {"open": "08:30", "close": "14:30", "source_id": "edu",
                                      "quotes": ["Polling units open nationwide at 8:30 AM", "Voting concludes at 2:30 PM"]},
            "steps": [{"text": "Polls open at 9", "quotes": ["Polling units open nationwide at 9:00 AM"]}], "steps_source_id": "edu"}
    f = tmp_path / "ed.yaml"
    f.write_text(yaml.safe_dump(data))
    monkeypatch.setattr(election_day, "FILE", f)
    monkeypatch.setattr(election_day, "RAW_DIR", tmp_path)
    monkeypatch.setattr(election_day, "GENERATED_DIR", tmp_path)
    errors = election_day.build({"edu": {"local_file": "edu.html", "file_url": "https://www.inecnigeria.org/voters/education"}})
    assert errors == ["election-day step 1: 'Polling units open nationwide at 9:00 AM' is not on https://www.inecnigeria.org/voters/education"]
    assert json.loads((tmp_path / "election-day.json").read_text())["hours"]["open"] == "08:30"


def test_archive_citations_are_checked_against_the_archived_file():
    from ballot_pipeline.quotes import raw_url

    assert raw_url("https://web.archive.org/web/20220923224421/https://inecnigeria.org/a.pdf") == \
        "https://web.archive.org/web/20220923224421id_/https://inecnigeria.org/a.pdf"
    assert raw_url("https://web.archive.org/web/20220923224421id_/https://inecnigeria.org/a.pdf") == \
        "https://web.archive.org/web/20220923224421id_/https://inecnigeria.org/a.pdf"
    assert raw_url("https://www.vanguardngr.com/x/") == "https://www.vanguardngr.com/x/"


@pytest.fixture
def ed(tmp_path, monkeypatch):
    from ballot_pipeline import election_day

    page = tmp_path / "inec.html"
    page.write_text("<p>Presidential / National Assembly Election January 16, 2027. Polling units open nationwide at 8:30 AM. "
                    "Accreditation and voting commence simultaneously and conclude at 2:30 PM.</p>")
    monkeypatch.setattr(election_day, "RAW_DIR", tmp_path)
    monkeypatch.setattr(election_day, "GENERATED_DIR", tmp_path)

    def run(date="2027-01-16", open_="08:30", close="14:30"):
        data = {"elections": [{"id": "jan", "date": date, "races": "R", "source_id": "inec",
                               "quotes": ["Presidential / National Assembly Election January 16, 2027"]}],
                "hours": {"open": open_, "close": close, "source_id": "inec",
                          "quotes": ["Polling units open nationwide at 8:30 AM", "conclude at 2:30 PM"]},
                "steps": [], "steps_source_id": "inec"}
        f = tmp_path / "ed.yaml"
        f.write_text(yaml.safe_dump(data))
        monkeypatch.setattr(election_day, "FILE", f)
        return election_day.build({"inec": {"local_file": "inec.html", "file_url": "https://www.inecnigeria.org/x"}})
    return run


def test_schedule_matching_its_quotes_passes(ed):
    assert ed() == []


@pytest.mark.parametrize("kwargs,expected", [
    ({"date": "2027-02-30"}, "is not a real date"),
    ({"date": "2027-01-17"}, "does not match its INEC quote"),
    ({"open_": "09:30"}, "open 09:30 does not match its INEC quote"),
    ({"close": "25:00"}, "is not a valid time"),
    ({"open_": "14:30", "close": "08:30"}, "must open before they close"),
])
def test_schedule_errors_are_rejected(ed, kwargs, expected):
    assert any(expected in e for e in ed(**kwargs))
