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


def test_a_race_shows_photos_only_once_two_of_its_first_group_have_one():
    from ballot_pipeline.photos import race_photo_rule

    groups = {"r1": [("r1-a", "first"), ("r1-b", "first"), ("r1-c", "first"), ("r1-x", "rest")],
              "r2": [("r2-a", "first"), ("r2-b", "first"), ("r2-x", "rest")]}
    # one of the first group in r1: held, placeholders for all; r2 has two, so its photos show, the rest group's too
    shown, held = race_photo_rule({"r1-a", "r1-x", "r2-a", "r2-b", "r2-x"}, groups)
    assert shown == {"r2-a", "r2-b", "r2-x"}
    assert held == {"r1-a": "r1", "r1-x": "r1"}
    # a photo outside the first group never counts towards the two
    assert race_photo_rule({"r1-a", "r1-x"}, groups)[0] == set()
    # the second photo switches the race on by itself
    assert race_photo_rule({"r1-a", "r1-c", "r1-x"}, groups)[0] == {"r1-a", "r1-c", "r1-x"}
    import pytest

    with pytest.raises(ValueError):
        race_photo_rule({"nobody"}, groups)
