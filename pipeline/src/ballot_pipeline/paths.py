"""Filesystem locations shared by every pipeline step."""

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PIPELINE_DIR.parent
RAW_DIR = PIPELINE_DIR / "raw"
PU_RAW_DIR = RAW_DIR / "pu"
AUDIT_DIR = PIPELINE_DIR / "audit"
SOURCES_YAML = PIPELINE_DIR / "sources.yaml"
ALIASES_YAML = PIPELINE_DIR / "aliases.yaml"
DATA_DIR = REPO_DIR / "data"
GENERATED_DIR = DATA_DIR / "generated"

USER_AGENT = "whos-on-my-ballot-pipeline/0.1 (+https://github.com/teesmile/whos-on-my-ballot)"
