"""Output schemas. Every displayed fact carries provenance; models are strict and forbid unknown fields."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Provenance(Strict):
    source_id: str = Field(min_length=1)
    page: int = Field(ge=1)
    sn: int = Field(ge=1)


class Citation(Strict):
    url: str = Field(pattern=r"^https://")
    publisher: str = Field(min_length=2)
    title: str = Field(min_length=2)
    published: str  # YYYY-MM-DD, or "unknown" when the page gives no date
    quote: str = Field(min_length=10, max_length=400)  # verbatim from the page, confirmed when researched
    retrieved: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    source_id: str | None = None  # set from pipeline/independent_sources.yaml; a citation without one fails the build


class BackgroundEntry(Strict):
    text: str = Field(min_length=3)
    citations: list[Citation] = Field(min_length=1)
    note: str | None = None  # a neutral note shown with the entry, e.g. how the source spells the name (D-029)


class Background(Strict):
    """Presidential race only (D-013): the same two fields for every candidate and running mate."""

    identity: Citation | None  # ties this person to their 2027 ticket; None means no entries could be attributed
    public_offices: list[BackgroundEntry]
    party_history: list[BackgroundEntry]
    researched: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class Person(Strict):
    name: str  # verbatim from INEC; empty only when INEC printed none (e.g. a COURT ORDER row)
    age: int | None = Field(default=None, ge=25, le=100)  # None when INEC printed nothing or an impossible value
    age_as_printed: str  # verbatim; shown when it differs from `age` (e.g. INEC printed "947")
    gender: Literal["M", "F"] | None
    pwd: str  # verbatim ("None" means INEC recorded no disability)
    qualifications: str  # verbatim
    position: str = ""  # verbatim, ticket races only
    background: Background | None = None  # presidential race only, all-or-none (D-013)


class PrintingNote(Strict):
    """A value INEC printed that is clearly an error. Shown as printed with a neutral note (D-021)."""

    person: Literal["candidate", "running_mate"]
    field: Literal["age", "remarks", "name", "qualifications", "gender", "pwd"]
    as_printed: str


class PlacementNote(Strict):
    """Why an LGA's polling units are in this race when INEC's text doesn't say so plainly (D-018, D-021)."""

    lga: str
    kind: Literal["inferred", "unconfirmed"]
    reason: str
    inec_text: str
    source_id: str
    row: int


class Candidate(Strict):
    id: str
    race_id: str
    party: str  # acronym, as printed by INEC
    party_name: str | None  # from INEC's /parties page; None only if INEC's register lacks the acronym
    ballot_position: int = Field(ge=1)  # ballot-paper order (D-011)
    display_group: Literal["first", "rest"]  # owner decision D-042: shown first, or with all other parties in ballot order
    remarks: str  # verbatim
    candidate: Person
    running_mate: Person | None = None
    printing_notes: list[PrintingNote] = []
    provenance: Provenance


class Race(Strict):
    id: str
    election: Literal["jan-2027", "feb-2027"]
    office: Literal["president", "senate", "house", "governor", "state_assembly"]
    state: str | None
    name: str  # constituency or district name as INEC prints it on the candidate list
    workbook_code: str | None  # SD/... or FC/... code from INEC's constituency workbook
    order_rule: str
    sources: list[str]
    placement_notes: list[PlacementNote] = []
    candidates: list[Candidate]


class PollingUnit(Strict):
    code: str = Field(pattern=r"^\d{2}/\d{2}/\d{2}/\d{3}$")
    name: str


class Ward(Strict):
    @model_validator(mode="after")
    def _sc_status_consistent(self):
        n = len(self.state_constituency)
        expected = "none" if n == 0 else "exact" if n == 1 else "unresolved"
        if self.sc_mapping != expected or (self.sc_mapping == "unresolved") != (self.sc_open_item in ("OI-6", "OI-13")):
            raise ValueError(f"ward {self.code}: sc_mapping {self.sc_mapping!r} inconsistent with {n} State Assembly races")
        return self

    @model_validator(mode="after")
    def _status_consistent(self):
        exact = len(self.federal_constituency) == 1 and len(self.senatorial_district) == 1
        if exact != (self.mapping == "exact") or (self.mapping == "unresolved") != bool(self.open_item):
            raise ValueError(f"ward {self.code}: mapping {self.mapping!r} / open_item {self.open_item!r} "
                             f"inconsistent with {len(self.federal_constituency)} House and "
                             f"{len(self.senatorial_district)} Senate races")
        return self

    code: str = Field(pattern=r"^\d{2}/\d{2}/\d{2}$")
    name: str
    federal_constituency: list[str]  # House race ids; exactly one unless the LGA is split (OI-9)
    senatorial_district: list[str]  # Senate race ids; exactly one unless INEC's text doesn't place the LGA (OI-10)
    # "exact": one House and one Senate race. "unresolved": INEC's published sources don't say which of the listed
    # races is this ward's; the site must show all of them as "one of these is on your ballot", never pick one.
    mapping: Literal["exact", "unresolved"]
    open_item: str | None  # required when mapping is "unresolved"
    # 6 February (D-028): State House of Assembly race ids. One when INEC's sources settle it; several (OI-6) when INEC's
    # 2011 workbook doesn't match its 2027 constituencies here; none in Borno (no list published, OI-11) and the FCT.
    state_constituency: list[str] = []
    sc_mapping: Literal["exact", "unresolved", "none"] = "none"
    sc_open_item: str | None = None  # OI-6: the workbook doesn't split the LGA; OI-13: INEC's workbook and IReV disagree (D-030)
    sc_sources: list[str] = []  # the source ids that decided state_constituency (D-030)
    polling_units: list[PollingUnit]


class Lga(Strict):
    code: str = Field(pattern=r"^\d{2}/\d{2}$")
    name: str
    wards: list[Ward]


class StateGeo(Strict):
    code: str = Field(pattern=r"^\d{2}$")
    name: str
    source_id: str
    lgas: list[Lga]
