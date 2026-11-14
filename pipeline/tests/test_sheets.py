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
