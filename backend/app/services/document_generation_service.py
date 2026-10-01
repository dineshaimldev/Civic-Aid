"""
CivicAid Document Generation Service

Drafts a ready-to-submit official letter (complaint, application, or
objection) in the standard format used for Tamil Nadu government offices,
filled from a few fields instead of asking the person to write it from
scratch.

Honest scope: this produces a draft. It does not file anything, does not
know the specific officer's name unless given, and should be reviewed
by the person (or a lawyer / 1516) before submission — the output says
so explicitly.
"""
import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)


def generate_official_letter(
    applicant_name: str,
    father_or_husband_name: str,
    address: str,
    phone: str,
    recipient_designation: str,
    recipient_office: str,
    subject: str,
    details: str,
    survey_number: Optional[str] = None,
    village: Optional[str] = None,
    lang: str = "english",
) -> str:
    """
    Builds a standard-format petition/complaint letter addressed to a
    Tamil Nadu government office (VAO, Tahsildar, RDO, Sub-Registrar, etc).
    Returns plain text, ready to copy, print, or download.
    """
    today = date.today().strftime("%d-%m-%Y")

    location_line = ""
    if survey_number or village:
        parts = []
        if survey_number:
            parts.append(f"Survey No: {survey_number}")
        if village:
            parts.append(f"Village: {village}")
        location_line = "\n" + ", ".join(parts)

    if lang == "tamil":
        letter = f"""திகதி: {today}

அனுப்புநர்:
{applicant_name}
S/o./D/o./W/o. {father_or_husband_name}
{address}
தொலைபேசி: {phone}

பெறுநர்:
{recipient_designation}
{recipient_office}

பொருள்: {subject}

மதிப்பிற்குரியவரே,

{details}{location_line}

மேற்கூறிய விஷயத்தில் தங்களின் உடனடி கவனத்தையும் தேவையான நடவடிக்கையையும் பணிவுடன் கோருகிறேன்.

நன்றியுடன்,

({applicant_name})
கையொப்பம்: _______________

---
குறிப்பு: இது CivicAid மூலம் தயாரிக்கப்பட்ட வரைவு கடிதம். சமர்ப்பிக்கும் முன் விவரங்களைச் சரிபார்க்கவும். சட்ட உதவிக்கு 1516 (இலவசம், 24/7) அழைக்கவும்."""
    else:
        letter = f"""Date: {today}

From:
{applicant_name}
S/o./D/o./W/o. {father_or_husband_name}
{address}
Phone: {phone}

To:
{recipient_designation}
{recipient_office}

Subject: {subject}

Respected Sir/Madam,

{details}{location_line}

I respectfully request your immediate attention and necessary action in the above matter at the earliest.

Thanking you,

Yours faithfully,

({applicant_name})
Signature: _______________

---
Note: This is a draft letter prepared by CivicAid. Please review all details for accuracy before submitting. For legal guidance, call Tamil Nadu Legal Aid: 1516 (toll-free, 24/7)."""

    return letter


# Pre-filled subject/office suggestions per common procedure-guide situation.
# The frontend uses these to pre-populate the form when the person clicks
# "Draft a letter" from a specific guide step, so they don't start blank.
LETTER_PRESETS: dict[str, dict] = {
    "vao_patta_delay": {
        "recipient_designation": "The Tahsildar",
        "recipient_office": "Taluk Office",
        "subject": "Complaint regarding delay in VAO field inspection for Patta transfer application",
        "details_hint": "Mention your application number, the date you submitted it, and how many days have passed without the VAO visiting for inspection.",
    },
    "boundary_dispute": {
        "recipient_designation": "The Village Administrative Officer",
        "recipient_office": "Village Administrative Office",
        "subject": "Complaint regarding boundary encroachment on my land",
        "details_hint": "Describe what your Patta/FMB shows versus the actual ground situation, and who is encroaching.",
    },
    "fraudulent_patta": {
        "recipient_designation": "The Tahsildar",
        "recipient_office": "Taluk Office",
        "subject": "Urgent complaint regarding fraudulent transfer of my land without consent",
        "details_hint": "State when you discovered the fraudulent transfer and what documents you have to prove your original ownership.",
    },
    "general": {
        "recipient_designation": "",
        "recipient_office": "",
        "subject": "",
        "details_hint": "Describe your situation clearly and factually.",
    },
}
