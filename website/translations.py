"""i18n mínimo para templates CRM (Manager Prop)."""

from __future__ import annotations

from flask import session

TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "master_finance": "Manager Prop",
        "crm_home": "CRM Home",
    },
    "pt": {
        "master_finance": "Manager Prop",
        "crm_home": "Início CRM",
    },
    "es": {
        "master_finance": "Manager Prop",
        "crm_home": "Inicio CRM",
    },
}


def get_locale() -> str:
    lang = session.get("locale") or "en"
    if lang not in TRANSLATIONS:
        return "en"
    return lang


def t(key: str) -> str:
    loc = get_locale()
    return TRANSLATIONS.get(loc, TRANSLATIONS["en"]).get(key, key)
