"""The 36 states and the FCT with INEC's delimitation state codes, as the polling-unit locator labels them (FCT = 37)."""

STATES: dict[str, str] = {
    "01": "ABIA", "02": "ADAMAWA", "03": "AKWA IBOM", "04": "ANAMBRA", "05": "BAUCHI", "06": "BAYELSA",
    "07": "BENUE", "08": "BORNO", "09": "CROSS RIVER", "10": "DELTA", "11": "EBONYI", "12": "EDO",
    "13": "EKITI", "14": "ENUGU", "15": "GOMBE", "16": "IMO", "17": "JIGAWA", "18": "KADUNA",
    "19": "KANO", "20": "KATSINA", "21": "KEBBI", "22": "KOGI", "23": "KWARA", "24": "LAGOS",
    "25": "NASARAWA", "26": "NIGER", "27": "OGUN", "28": "ONDO", "29": "OSUN", "30": "OYO",
    "31": "PLATEAU", "32": "RIVERS", "33": "SOKOTO", "34": "TARABA", "35": "YOBE", "36": "ZAMFARA",
    "37": "FCT",
}
STATE_NAMES = set(STATES.values())
CODE_BY_STATE = {v: k for k, v in STATES.items()}


def slug(text: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def state_from_slug(s: str) -> str:
    name = s.replace("-", " ").upper()
    if name not in STATE_NAMES:
        raise ValueError(f"unknown state slug {s!r}")
    return name
