# Data pipeline. All steps except fetch/crawl/watch run offline from pipeline/raw/.
PIPE = cd pipeline && uv run

.PHONY: fetch crawl-pu crawl-irev build test verify-data verify watch site verify-site

fetch:        ## download INEC sources, record hashes (network)
	$(PIPE) ballot-pipeline fetch

crawl-pu:     ## crawl INEC's polling-unit locator politely; resumable (network, ~2 h cold)
	$(PIPE) ballot-pipeline crawl-pu

crawl-irev:   ## cache IReV's 2023 State Assembly ward lists politely; resumable (network, ~2 min)
	$(PIPE) ballot-pipeline crawl-irev

build:        ## raw -> data/generated (offline)
	$(PIPE) ballot-pipeline build

test:         ## unit tests (PDF tests skip if raw files are absent)
	$(PIPE) pytest -q

verify-data:  ## build + every Phase 1 check; non-zero on any failure (offline)
	$(PIPE) ballot-pipeline verify

site:         ## data/generated -> static site in out/ (offline)
	pnpm build

verify-site:  ## every Phase 2 check on the built site (offline; needs `make site` and Playwright's Chromium)
	pnpm lint && pnpm typecheck && pnpm test && pnpm test:site && pnpm test:e2e && pnpm size && pnpm lighthouse

verify: test verify-data site verify-site

watch:        ## exit 3 if INEC published or changed anything we depend on (network)
	$(PIPE) ballot-pipeline watch
