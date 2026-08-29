# backend/test_agent_tools.py
"""
Regression corpus for the autonomous agent's tools.

These tools are pure functions over text -- no API key, no network, no database
-- so their behaviour can be pinned exactly. That matters most for
tool_emergency_triager, which decides whether a CRITICAL_EMERGENCY banner is
raised across the site. It reaches that decision by keyword matching over
attacker-controllable Telegram text, and its correctness rests entirely on the
NOISE_PATTERNS list suppressing memorials, donation drives, drills and
metaphors. Every keyword added to NATURAL_DISASTERS or CONFLICT_EMERGENCIES can
silently resurrect a false positive that was fixed before.

Both directions are failures with real consequences: a false alarm about a
disaster shown to people who may act on it, or a missed warning about a real
one. The cases below are grouped accordingly.

    docker compose exec api python -m pytest backend/test_agent_tools.py -q
"""
from agent_core import AgentTools


# --- tool_emergency_triager: alerts that must fire ---------------------------

ACTIVE_EMERGENCIES = [
    ("landslide", "landslide",
     "မကွေးတိုင်းတွင် မြေပြိုကျမှုဖြစ်ပွား၍ လူ ၅ ဦး သေဆုံး"),
    ("flood", "flood",
     "ဧရာဝတီမြစ် ရေကြီးရေလျှံမှုကြောင့် ရွာသားများ ရွှေ့ပြောင်း"),
    ("earthquake", "earthquake",
     "စစ်ကိုင်းတွင် ငလျင်လှုပ်ခတ်မှု ဖြစ်ပွား"),
    ("cyclone", "cyclone",
     "ရခိုင်ကမ်းရိုးတန်း မုန်တိုင်းတိုက်ခတ်နေသည်"),
    ("fire", "fire",
     "ဈေးတွင် မီးလောင်ကျွမ်းနေပြီး ပစ္စည်းများ ပျက်စီး"),
    ("airstrike", "airstrike",
     "ကရင်ပြည်နယ်တွင် လေကြောင်းတိုက်ခိုက်မှု ဖြစ်ပွား"),
    ("artillery", "artillery_shelling",
     "လက်နက်ကြီးကျည်ကျရောက်ပြီး အိမ်များ ပျက်စီး"),
    ("displacement", "mass_displacement",
     "ဒေသခံများ စစ်ဘေးရှောင်နေရသည်"),
]


def test_triager_raises_alerts_for_active_emergencies():
    print("\n🧪 Emergency triage — alerts that must fire...")
    for label, expected_type, text in ACTIVE_EMERGENCIES:
        result = AgentTools.tool_emergency_triager(text)
        assert result["is_emergency_alert"] is True, f"{label}: no alert raised"
        assert result["emergency_type"] == expected_type, (
            f"{label}: expected {expected_type}, got {result['emergency_type']}")
        assert result["action_required"], f"{label}: alert carries no advice for civilians"
    print(f"✅ All {len(ACTIVE_EMERGENCIES)} active emergency types detected.")


def test_triager_priority_levels():
    """Shelling and airstrikes are immediate danger; displacement is urgent, not immediate."""
    print("\n🧪 Emergency triage — priority levels...")
    for label, expected_type, text in ACTIVE_EMERGENCIES:
        result = AgentTools.tool_emergency_triager(text)
        expected = "HIGH_PRIORITY" if expected_type == "mass_displacement" else "CRITICAL_EMERGENCY"
        assert result["priority_level"] == expected, (
            f"{label}: expected {expected}, got {result['priority_level']}")
    print("✅ Priority levels correct for every emergency type.")


# --- tool_emergency_triager: alerts that must NOT fire -----------------------
# A false CRITICAL_EMERGENCY banner is the most damaging thing this system can
# emit. Each case names a real pattern in Myanmar reporting that contains
# disaster vocabulary without being an active disaster.

MUST_NOT_ALERT = [
    ("memorial ceremony",
     "ငလျင်လှုပ်ခတ်မှု နှစ်ပတ်လည် အောက်မေ့ဖွယ် အခမ်းအနား ကျင်းပ"),
    ("donation drive",
     "ရေကြီးရေလျှံ ဘေးသင့်သူများအတွက် အလှူငွေ ပေးအပ်"),
    ("preparedness drill",
     "မီးလောင်ကျွမ်းနေ ဖြစ်စဉ် ဇာတ်တိုက်လေ့ကျင့်မှု ပြုလုပ်"),
    ("political metaphor",
     "နိုင်ငံရေး ငလျင် တစ်ခု ဖြစ်ပွားခဲ့သည်"),
    ("retrospective piece",
     "ပြီးခဲ့သော နှစ်က မြေပြိုကျမှု အကြောင်း ပြန်လည်သုံးသပ်"),
    ("reconstruction news",
     "ရေကြီးရေလျှံ ဒေသတွင် ပြန်လည်ထူထောင်ရေး လုပ်ငန်းများ ဆောင်ရွက်"),
    ("ordinary news",
     "ရန်ကုန်တွင် အစည်းအဝေး ကျင်းပခဲ့သည်"),
]


def test_triager_suppresses_false_positives():
    print("\n🧪 Emergency triage — alerts that must NOT fire...")
    for label, text in MUST_NOT_ALERT:
        result = AgentTools.tool_emergency_triager(text)
        assert result["is_emergency_alert"] is False, (
            f"FALSE ALARM on '{label}': raised {result['emergency_type']} "
            f"at {result['priority_level']}")
        assert result["emergency_type"] == "none", f"{label}: {result['emergency_type']}"
    print(f"✅ All {len(MUST_NOT_ALERT)} non-emergencies suppressed.")


def test_triager_escalates_on_casualties():
    """Casualties raise an otherwise ordinary report, without inventing an emergency type."""
    print("\n🧪 Emergency triage — casualty escalation...")
    result = AgentTools.tool_emergency_triager("ယာဉ်တိုက်မှုတွင် လူနှစ်ဦး သေဆုံးခဲ့သည်")
    assert result["has_casualties"] is True
    assert result["priority_level"] == "HIGH_PRIORITY"
    assert result["is_emergency_alert"] is False, "casualties alone are not a disaster alert"
    assert result["emergency_type"] == "none"

    quiet = AgentTools.tool_emergency_triager("ရန်ကုန်တွင် အစည်းအဝေး ကျင်းပခဲ့သည်")
    assert quiet["priority_level"] == "STANDARD"
    assert quiet["has_casualties"] is False
    print("✅ Casualty escalation correct.")


def test_triager_respects_category_guards():
    """Crime news or accident reports with overlapping wording must never trigger natural disaster alerts."""
    print("\n🧪 Emergency triage — category guards (crime/accident)...")
    
    # Crime report that happens to contain disaster/flood vocabulary
    crime_report = "တောင်ဒဂုံမြို့နယ်တွင် လုယက်မှုဖြစ်ပွားပြီး ရေကြီးရေလျှံမှုသတင်းများကြောင့် ရဲတပ်ဖွဲ့ စုံစမ်းနေ"
    res1 = AgentTools.tool_emergency_triager(crime_report, event_type="မှုခင်းသတင်း")
    assert res1["is_emergency_alert"] is False, "Crime report should not trigger natural disaster emergency"
    assert res1["emergency_type"] == "none", f"Expected 'none', got {res1['emergency_type']}"

    # Accident report with drowning or water phrase
    accident_report = "ချောင်းအတွင်း ရေနစ်သေဆုံးမှု ဖြစ်ပွားခဲ့သည်"
    res2 = AgentTools.tool_emergency_triager(accident_report, event_type="မတော်တဆဖြစ်မှု")
    assert res2["is_emergency_alert"] is False, "Accident report should not trigger disaster alert"
    assert res2["emergency_type"] == "none", f"Expected 'none', got {res2['emergency_type']}"
    assert res2["priority_level"] == "HIGH_PRIORITY", "Casualties in accident should escalate to HIGH_PRIORITY"

    # Political report in 'အထွေထွေ' category with name 'Kim Aris / ကင်မ်အဲရစ်'
    political_report = "သံအမတ်ကြီး ဦးကျော်မိုးထွန်းကို ဆက်လက်ထားရှိရန် ဒေါ်အောင်ဆန်းစုကြည်၏သား ကင်မ်အဲရစ်နှင့် CDM ဝန်ထမ်းများ တောင်းဆို"
    res4 = AgentTools.tool_emergency_triager(political_report, event_type="အထွေထွေ", sub_category="နိုင်ငံရေး")
    assert res4["is_emergency_alert"] is False, "Political report should not trigger airstrike emergency"
    assert res4["emergency_type"] == "none", f"Expected 'none', got {res4['emergency_type']}"

    # Legitimate airstrike in military category
    airstrike_report = "ကရင်ပြည်နယ်တွင် စစ်ကောင်စီတပ်မှ ဂျက်ဖိုက်တာဖြင့် လေကြောင်းတိုက်ခိုက်မှု ပြုလုပ်"
    res5 = AgentTools.tool_emergency_triager(airstrike_report, event_type="စစ်ရေးသတင်း", sub_category="လေကြောင်း")
    assert res5["is_emergency_alert"] is True
    assert res5["emergency_type"] == "airstrike"
    assert res5["priority_level"] == "CRITICAL_EMERGENCY"
    print("✅ Category guards properly suppress false disaster/conflict alarms for crime, accidents, and politics.")


def test_triager_known_suppression_gap():
    """
    DOCUMENTS A KNOWN WEAKNESS -- these assertions describe behaviour that is
    arguably wrong, and exist so that changing it is a deliberate act.

    Suppression is unconditional: NOISE_PATTERNS gates the whole detection
    block, so a single noise word anywhere in the text drops the alert no
    matter how active the emergency is. A landslide report that also appeals
    for donations -- routine phrasing in Myanmar crisis reporting -- raises
    nothing at all.

    Fixing it is a judgement call with cost in both directions: loosening
    suppression recovers these, and risks alarming people over memorials that
    mention deaths. If this test fails, someone changed that trade-off; make
    sure that was intended and update the cases here.
    """
    print("\n🧪 Emergency triage — known suppression gap...")
    missed = [
        ("landslide + relief appeal",
         "ယနေ့နံနက် မြေပြိုကျမှုဖြစ်ပွားပြီး ဘေးသင့်သူများအတွက် အလှူငွေ အလိုအပ်ဆုံး ဖြစ်နေသည်"),
        ("flood worse than last year",
         "ရေကြီးရေလျှံမှုသည် ပြီးခဲ့သော နှစ်ကထက် ပိုဆိုးနေသည်"),
    ]
    for label, text in missed:
        result = AgentTools.tool_emergency_triager(text)
        assert result["is_emergency_alert"] is False, (
            f"'{label}' now raises an alert. The suppression gap looks fixed -- "
            f"confirm that was deliberate and move this case into ACTIVE_EMERGENCIES.")
    print(f"✅ {len(missed)} known-missed cases still behave as documented.")


# --- tool_fact_checker -------------------------------------------------------

def test_fact_checker_flags_spam():
    print("\n🧪 Fact checker — spam...")
    result = AgentTools.tool_fact_checker(
        "2d 3d slot ဂိမ်း အကောင့်ဖွင့်ရန် link ကိုနှိပ်ပါ", "@somechannel")
    assert result["is_spam"] is True
    assert result["verdict"] == "SPAM"
    assert result["credibility_score"] < 0.2
    assert result["reasons"], "a spam verdict must say which keyword triggered it"
    print("✅ Commercial spam rejected.")


def test_fact_checker_source_tiering():
    """Credibility must be ordered by source reputation, whatever the exact numbers."""
    print("\n🧪 Fact checker — source tiering...")
    text = "ရန်ကုန်တွင် ဖြစ်စဉ်တစ်ခု ဖြစ်ပွား"
    tier1 = AgentTools.tool_fact_checker(text, "@khitthitnews")["credibility_score"]
    tier2 = AgentTools.tool_fact_checker(text, "@shannews")["credibility_score"]
    community = AgentTools.tool_fact_checker(text, "@somechannel")["credibility_score"]
    unattributed = AgentTools.tool_fact_checker(text, "unknown")["credibility_score"]

    assert tier1 > tier2 > community > unattributed, (
        f"tiering out of order: {tier1} {tier2} {community} {unattributed}")
    for score in (tier1, tier2, community, unattributed):
        assert 0.0 <= score <= 1.0, f"credibility score out of range: {score}"
    print("✅ Tier-1 > Tier-2 > community > unattributed.")


# --- tool_geo_inferencer -----------------------------------------------------

def test_geo_inferencer_resolves_from_ontology():
    print("\n🧪 Geo inferencer — ontology lookup...")
    result = AgentTools.tool_geo_inferencer(raw_text="", township="ကမာရွတ်")
    assert result["source"] == "myanmar_admin_dictionary"
    assert result["region"] == "ရန်ကုန်"
    assert result["confidence"] >= 0.9
    print("✅ Township resolved from the admin dictionary.")


def test_geo_inferencer_reports_failure_rather_than_guessing():
    """An unresolvable location must return None, not a plausible-looking point."""
    print("\n🧪 Geo inferencer — unresolvable input...")
    result = AgentTools.tool_geo_inferencer(raw_text="", township=None, city=None, region=None)
    assert result["source"] == "unresolved_location"
    assert result["latitude"] is None and result["longitude"] is None
    assert result["confidence"] < 0.5
    print("✅ Unresolvable locations reported, not invented.")


def test_geo_inferencer_output_is_inside_myanmar():
    """Whatever path resolves, the coordinates must satisfy the storage guard."""
    from geolocator import is_within_myanmar
    print("\n🧪 Geo inferencer — output stays in Myanmar...")
    for name in ["ကမာရွတ်", "မောင်တော", "ကိုကိုးကျွန်း", "မိတ္ထီလာ", "မြစ်ကြီးနား", "တံတားဦး"]:
        result = AgentTools.tool_geo_inferencer(raw_text="", township=name)
        assert is_within_myanmar(result["latitude"], result["longitude"]), (
            f"{name} resolved outside Myanmar: {result['latitude']},{result['longitude']}")
    print("✅ Resolved coordinates all pass the storage guard.")


def test_geo_inferencer_prioritizes_target_over_airbase():
    """When text mentions both a departure airbase and a target township, target township must be preferred."""
    print("\n🧪 Geo inferencer — airbase origin vs target township...")
    air_scout_text = "တံတားဦးလေတပ်မှ Y-12 စစ်သုံးကုန်တင်လေယာဉ်တစ်စီးသည် ဝက်လက်နယ်ကိုဖြတ်၍ ပျံသန်းသွားသည်။"
    result = AgentTools.tool_geo_inferencer(raw_text=air_scout_text)
    assert result["township"] == "ဝက်လက်", f"Expected target township ဝက်လက်, got {result['township']}"
    assert result["region"] == "စစ်ကိုင်း"
    print("✅ Target township correctly prioritized over departure airbase.")


# --- tool_emergency_broadcaster ---------------------------------------------

def test_broadcaster_payload_shape():
    """The UI banner, map pulse and live stream all read this payload."""
    print("\n🧪 Broadcaster — payload...")
    payload = AgentTools.tool_emergency_broadcaster(
        emergency_type="flood", alert_level="CRITICAL_EMERGENCY",
        region="", township="", headline="H", action_required="A")

    for key in ["dispatch_id", "timestamp", "alert_level", "emergency_type",
                "region", "township", "headline", "action_required",
                "broadcast_status", "channels"]:
        assert key in payload, f"missing key: {key}"

    assert payload["dispatch_id"].startswith("ALERT-")
    assert payload["region"] == "Myanmar", "blank region must fall back, not render empty"
    assert payload["township"] == "General"
    assert len(payload["channels"]) == 3

    other = AgentTools.tool_emergency_broadcaster("flood", "CRITICAL_EMERGENCY", "", "", "H", "A")
    assert other["dispatch_id"] != payload["dispatch_id"], "dispatch ids must be unique"
    print("✅ Broadcast payload complete and uniquely identified.")


# --- tool_semantic_correlator ------------------------------------------------

def test_correlator_without_database():
    """Must degrade quietly: the scraper calls this with db=None in some paths."""
    print("\n🧪 Correlator — no database...")
    result = AgentTools.tool_semantic_correlator("summary", "ကမာရွတ်", None)
    assert result["corroborated"] is False
    assert result["match_count"] == 0
    assert result["confidence_boost"] == 0.0
    print("✅ Degrades without a database.")


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("\n✅ All agent tool tests passed.")
