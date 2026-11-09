# Data pipeline. All steps except fetch/crawl/watch run offline from pipeline/raw/.
PIPE = cd pipeline && uv run

.PHONY: fetch crawl-pu build test verify-data verify watch

fetch:        ## download INEC sources, record hashes (network)
	$(PIPE) ballot-pipeline fetch

crawl-pu:     ## crawl INEC's polling-unit locator politely; resumable (network, ~2 h cold)
	$(PIPE) ballot-pipeline crawl-pu

build:        ## raw -> data/generated (offline)
	$(PIPE) ballot-pipeline build

test:         ## unit tests (PDF tests skip if raw files are absent)
	$(PIPE) pytest -q

verify-data:  ## build + every Phase 1 check; non-zero on any failure (offline)
	$(PIPE) ballot-pipeline verify

verify: test verify-data

watch:        ## exit 3 if INEC published or changed anything we depend on (network)
	$(PIPE) ballot-pipeline watch
