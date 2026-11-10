import json

import pytest
from pydantic import ValidationError

from ballot_pipeline import manifest
from ballot_pipeline.models import PollingUnit, Ward


@pytest.fixture
def fake_crawl(tmp_path, monkeypatch):
    raw, gen = tmp_path / "pu", tmp_path / "gen"
    (raw / "pus").mkdir(parents=True)
    gen.mkdir()
    (raw / "locator.html").write_text("<select></select>")
    (raw / "pus" / "1.json").write_text('[{"0": "--SELECT--", "selected": "0", "9": "001 - SCHOOL"}]')
    monkeypatch.setattr(manifest, "PU_RAW_DIR", raw)
    monkeypatch.setattr(manifest, "MANIFEST", gen / "pu-manifest.json")
    manifest.write_pu_manifest()
    return raw


def test_untouched_crawl_verifies(fake_crawl):
    assert manifest.verify_pu_manifest() == []


def test_edited_cached_response_is_caught(fake_crawl):
    (fake_crawl / "pus" / "1.json").write_text('[{"0": "--SELECT--", "selected": "0", "9": "001 - ELSEWHERE"}]')
    assert any("differ" in e for e in manifest.verify_pu_manifest())


def test_deleted_or_added_response_is_caught(fake_crawl):
    (fake_crawl / "pus" / "2.json").write_text("[]")
    assert any("not in the manifest" in e for e in manifest.verify_pu_manifest())
    (fake_crawl / "pus" / "1.json").unlink()
    assert any("missing" in e for e in manifest.verify_pu_manifest())


def test_tampered_manifest_is_caught(fake_crawl):
    m = json.loads(manifest.MANIFEST.read_text())
    m["sha256"]["pus/1.json"] = "0" * 64
    manifest.MANIFEST.write_text(json.dumps(m))
    assert any("inconsistent" in e for e in manifest.verify_pu_manifest())


PU = [PollingUnit(code="24/01/01/001", name="X")]


def test_exact_ward_has_one_race_each():
    Ward(code="24/01/01", name="W", federal_constituency=["h"], senatorial_district=["s"], mapping="exact",
         open_item=None, polling_units=PU)


@pytest.mark.parametrize("fc,sd,mapping,item", [
    (["h1", "h2"], ["s"], "exact", None),          # ambiguity passed off as exact
    (["h1", "h2"], ["s"], "unresolved", None),     # ambiguity without an open item
    (["h"], ["s"], "unresolved", "OI-9"),          # exact ward mislabelled
])
def test_ward_status_must_match_its_races(fc, sd, mapping, item):
    with pytest.raises(ValidationError):
        Ward(code="24/01/01", name="W", federal_constituency=fc, senatorial_district=sd, mapping=mapping,
             open_item=item, polling_units=PU)


def test_an_error_found_during_the_build_fails_verify(raw_source, monkeypatch):
    """Review 5: a positional field shift in BuildResult once dropped every accumulated error, so verify passed."""
    from ballot_pipeline import build as build_mod
    from ballot_pipeline import verify as verify_mod
    from ballot_pipeline.paths import GENERATED_DIR

    raw_source("sha-2026-10-10")  # skips when INEC's files are not fetched
    monkeypatch.setattr(manifest, "verify_pu_manifest", lambda: ["injected: polling-unit manifest mismatch"])
    monkeypatch.setattr(build_mod, "write_outputs", lambda res: None)
    report = GENERATED_DIR / "report.md"
    saved = report.read_bytes()
    try:
        res = build_mod.build(log=lambda *a: None)
        assert "injected: polling-unit manifest mismatch" in res.errors
        assert verify_mod.verify(res, write_audit=False) == 1
    finally:
        report.write_bytes(saved)


def test_build_result_rejects_a_misplaced_errors_field():
    from ballot_pipeline.build import BuildResult

    with pytest.raises(TypeError):
        BuildResult(*([None] * 12), {"notes": []}, errors={"not": "a list"})
