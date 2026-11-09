import json

import pytest

from ballot_pipeline.paths import GENERATED_DIR, RAW_DIR


@pytest.fixture(scope="session")
def raw_source():
    """Path to a fetched INEC file by source_id. INEC's PDFs are not committed (D-005): run `make fetch` first."""
    sources_json = GENERATED_DIR / "sources.json"
    if not sources_json.exists():
        pytest.skip("no sources.json; run `make fetch`")
    by_id = {s["source_id"]: s for s in json.loads(sources_json.read_text())}

    def get(source_id: str):
        path = RAW_DIR / by_id[source_id]["local_file"]
        if not path.exists():
            pytest.skip(f"{path} not fetched; run `make fetch`")
        return path

    return get
