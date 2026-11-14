from ballot_pipeline.logos import race_of


def test_a_candidate_belongs_to_the_race_its_id_starts_with():
    assert race_of("feb-2027-governor-kano-apc") == "feb-2027-governor-kano"
    assert race_of("feb-2027-governor-akwa-ibom-a") == "feb-2027-governor-akwa-ibom"
    assert race_of("jan-2027-president-ndc") == "jan-2027-president"
