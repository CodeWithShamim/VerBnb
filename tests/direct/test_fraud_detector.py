"""Direct-mode tests for fraud_detector.py (pattern detection)."""

import json

CONTRACT = "contracts/fraud_detector.py"

ADDR = "0xaAaA000000000000000000000000000000000001"

DAY = 24 * 60 * 60
BASE_TS = 1_700_000_000  # fixed epoch base for deterministic windows


def test_no_flag_for_single_dispute(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    out = json.loads(c.check_and_flag_patterns(ADDR, "d1", False, BASE_TS))
    assert out["flagged"] is False
    assert out["confidence"] < 40
    assert json.loads(c.get_fraud_flags(ADDR))["flags"] == []


def test_repeat_disputant_low_severity(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # 5 disputes, alternating verdicts (no skew), spread > 30d apart (no rapid).
    last = None
    for i in range(5):
        favorable = (i % 2 == 0)
        ts = BASE_TS + i * 40 * DAY  # 40 days apart -> never 2 in a 30d window
        last = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", favorable, ts))
    assert last["flagged"] is True
    assert last["flag_type"] == "REPEAT_DISPUTANT"
    assert last["severity"] == "LOW"  # confidence 45
    assert 40 <= last["confidence"] <= 70


def test_skewed_verdicts_flag(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # 4 disputes, all unfavorable, spread out (no rapid, below repeat threshold).
    last = None
    for i in range(4):
        ts = BASE_TS + i * 40 * DAY
        last = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", False, ts))
    assert last["flagged"] is True
    assert last["flag_type"] == "SKEWED_VERDICTS"
    assert last["severity"] in ("MEDIUM", "HIGH")
    details = json.loads(c.get_flag_details(last["flag_id"]))
    assert details["evidence"]["direction"] == "all_unfavorable"


def test_rapid_cycling_high_severity(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # 14 disputes within a few days -> RAPID_CYCLING. Mixed verdicts so SKEW
    # doesn't dominate; rapid confidence 72 + (14-10)*4 = 88 -> HIGH.
    last = None
    for i in range(14):
        favorable = (i % 2 == 0)
        ts = BASE_TS + i * (DAY // 2)  # 12h apart -> all inside 30 days
        last = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", favorable, ts))
    assert last["flagged"] is True
    assert last["flag_type"] == "RAPID_CYCLING"
    assert last["severity"] == "HIGH"
    assert last["confidence"] > 85
    assert c.has_high_severity_flag(ADDR) is True


def test_confidence_in_range(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    for i in range(20):
        ts = BASE_TS + i * (DAY // 2)
        out = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", i % 2 == 0, ts))
        assert 0 <= out["confidence"] <= 100


def test_severity_bands(direct_vm, direct_deploy):
    # LOW band: exactly 5 repeat disputes, no other pattern -> conf 45.
    c = direct_deploy(CONTRACT)
    out = None
    for i in range(5):
        ts = BASE_TS + i * 40 * DAY
        out = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", i % 2 == 0, ts))
    assert out["severity"] == "LOW"
    assert 40 <= out["confidence"] <= 70


def test_has_high_severity_flag_false_when_none(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.check_and_flag_patterns(ADDR, "d1", False, BASE_TS)
    assert c.has_high_severity_flag(ADDR) is False


def test_resolve_flag_hides_it(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    last = None
    for i in range(5):
        ts = BASE_TS + i * 40 * DAY
        last = json.loads(c.check_and_flag_patterns(ADDR, f"d{i}", i % 2 == 0, ts))
    flag_id = last["flag_id"]
    assert len(json.loads(c.get_fraud_flags(ADDR))["flags"]) >= 1
    c.resolve_flag(flag_id)
    # Resolved flags are excluded from the active list.
    active = json.loads(c.get_fraud_flags(ADDR))["flags"]
    assert all(f["flag_id"] != flag_id for f in active)


def test_flag_details_not_found(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    assert json.loads(c.get_flag_details("nope"))["error"] == "not_found"
