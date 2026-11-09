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


class Person(Strict):
    name: str  # verbatim from INEC; empty only when INEC printed none (e.g. a COURT ORDER row)
    age: int | None = Field(default=None, ge=25, le=100)  # None when INEC printed nothing or an impossible value
    age_as_printed: str  # verbatim; shown when it differs from `age` (e.g. INEC printed "947")
    gender: Literal["M", "F"] | None
    pwd: str  # verbatim ("None" means INEC recorded no disability)
    qualifications: str  # verbatim
    position: str = ""  # verbatim, ticket races only


class Candidate(Strict):
    id: str
    race_id: str
    party: str  # acronym, as printed by INEC
    party_name: str | None  # from INEC's /parties page; None only if INEC's register lacks the acronym
    ballot_position: int = Field(ge=1)
    remarks: str  # verbatim
    candidate: Person
    running_mate: Person | None = None
    provenance: Provenance


class Race(Strict):
    id: str
    election: Literal["jan-2027", "feb-2027"]
    office: Literal["president", "senate", "house"]
    state: str | None
    name: str  # constituency or district name as INEC prints it on the candidate list
    workbook_code: str | None  # SD/... or FC/... code from INEC's constituency workbook
    order_rule: str
    sources: list[str]
    candidates: list[Candidate]


class PollingUnit(Strict):
    code: str = Field(pattern=r"^\d{2}/\d{2}/\d{2}/\d{3}$")
    name: str


class Ward(Strict):
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
