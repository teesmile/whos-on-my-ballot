from ballot_pipeline.logos import race_of


def test_a_candidate_belongs_to_the_race_its_id_starts_with():
    assert race_of("feb-2027-governor-kano-apc") == "feb-2027-governor-kano"
    assert race_of("feb-2027-governor-akwa-ibom-a") == "feb-2027-governor-akwa-ibom"
    assert race_of("jan-2027-president-ndc") == "jan-2027-president"


def test_the_office_is_the_third_part_of_an_id():
    from ballot_pipeline.photos import ON_DEMAND, office_of

    assert office_of("jan-2027-senate-lagos-lagos-central-apc") == "senate"
    assert office_of("feb-2027-sha-lagos-lagos-island-i-apc") == "sha"
    assert office_of("feb-2027-governor-kano-apc") not in ON_DEMAND
    assert office_of("jan-2027-president-adc") not in ON_DEMAND


def test_an_official_page_photo_goes_live_once_checked_but_a_public_upload_needs_the_owner():
    from ballot_pipeline.photos import approval_date

    nass = {"source": "National Assembly website", "file_page": "https://nass.gov.ng/mps/single/1",
            "file_url": "https://nass.gov.ng/themes/newnass/images/mps/1.jpg"}
    commons = {"source": "Wikimedia Commons", "file_page": "https://commons.wikimedia.org/wiki/File:X.jpg",
               "file_url": "https://upload.wikimedia.org/wikipedia/commons/x/xx/X.jpg"}
    assert approval_date({**nass, "official_checked": "2026-11-14"}) == "2026-11-14"
    assert approval_date({**nass}) is None
    assert approval_date({**commons, "official_checked": "2026-11-14"}) is None
    assert approval_date({**commons, "owner_approved": "2026-11-14"}) == "2026-11-14"
    # a Commons file disguised under another source name is still a public upload
    assert approval_date({**commons, "source": "National Assembly website", "official_checked": "2026-11-14"}) is None


def test_a_news_photo_goes_live_once_checked_and_never_from_an_agency(tmp_path, monkeypatch):
    """D-084 (owner, 15 Nov 2026): a news report naming the candidate with party and seat is a source, checked like an
    official page; a picture agency or stock library never is, and a public upload still needs the owner."""
    import pytest
    import yaml

    from ballot_pipeline import photos

    news = {"candidate_id": "jan-2027-house-x-y-pdp", "source": "Punch (punchng.com)", "file_page": "https://punchng.com/a/",
            "file_url": "https://cdn.punchng.com/a.jpg", "sha256": "0" * 64, "retrieved": "2026-11-15", "crop": [0, 0, 9, 9]}
    assert photos.approval_date({**news, "news_checked": "2026-11-15"}) == "2026-11-15"
    assert photos.approval_date(news) is None
    commons = {"file_page": "https://commons.wikimedia.org/wiki/File:X.jpg", "file_url": "https://upload.wikimedia.org/x/X.jpg"}
    assert photos.approval_date({**news, **commons, "news_checked": "2026-11-15"}) is None
    for credit in ("Photo: AFP", "Getty Images", "REUTERS/Someone", "Shutterstock", "Photo: NAN"):
        assert photos._agency({**news, "credit": credit}), credit
    assert not photos._agency({**news, "credit": "none shown"})

    for bad in ({**news, "news_checked": "2026-11-15", "credit": "Photo: AFP"},
                {**news, "news_checked": "2026-11-15", "official_checked": "2026-11-15"}):
        f = tmp_path / "photos.yaml"
        f.write_text(yaml.safe_dump({"people": [bad]}))
        monkeypatch.setattr(photos, "PHOTOS_YAML", f)
        with pytest.raises(ValueError):
            photos.load()


def test_a_race_shows_photos_once_any_candidate_but_the_governing_partys_has_one_first_five_or_not():
    import pytest

    from ballot_pipeline.photos import governing_party, race_photo_rule

    groups = {"r1": [("r1-gov", "first", "GOV"), ("r1-b", "first", "B"), ("r1-x", "rest", "X")],
              "r2": [("r2-gov", "first", "GOV"), ("r2-b", "first", "B"), ("r2-x", "rest", "X")],
              "r3": [("r3-gov", "first", "GOV"), ("r3-x", "rest", "X")],
              "r4": [("r4-b", "first", "B"), ("r4-x", "rest", "X")]}
    shown, held = race_photo_rule({"r1-gov", "r2-gov", "r2-x", "r3-x", "r4-x"}, groups, "GOV")
    # r1: the governing party's photo alone is held, and the race shows placeholders
    assert held == {"r1-gov": "r1"}
    # r2: a photo outside the first five switches the race on, and every photo in it shows, the governing party's included;
    # r3 and r4: a photo outside the first five alone is enough
    assert shown == {"r2-gov", "r2-x", "r3-x", "r4-x"}
    # the next photo of any other party switches a held race on by itself
    assert race_photo_rule({"r1-gov", "r1-x"}, groups, "GOV")[0] == {"r1-gov", "r1-x"}
    with pytest.raises(ValueError):
        race_photo_rule({"nobody"}, groups, "GOV")
    # one setting, with its source
    g = governing_party()
    assert g["acronym"] == "APC" and g["source"]["url"].startswith("http") and g["source"]["quote"]
