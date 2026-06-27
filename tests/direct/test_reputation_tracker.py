"""Direct-mode tests for reputation_tracker.py (user reputation + history)."""

import json

CONTRACT = "contracts/reputation_tracker.py"

ALICE = "0xaAaA000000000000000000000000000000000001"
BOB = "0xbBbB000000000000000000000000000000000002"
VAL = "0xddDD000000000000000000000000000000000004"


def test_dispute_filed_and_log(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_dispute_filed(ALICE, "d1")
    rep = json.loads(c.get_reputation(ALICE))
    assert rep["disputes_filed"] == 1
    assert rep["exists"] is True

    log = json.loads(c.get_activity_log(ALICE, 20))
    assert len(log["events"]) == 1
    assert log["events"][0]["event_type"] == "DISPUTE_FILED"
    assert log["events"][0]["dispute_id"] == "d1"


def test_score_updates_on_verdict(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # Alice wins all 4 disputes -> win_rate 1.0 -> 50 points from win component.
    for i in range(4):
        c.record_verdict(ALICE, BOB, f"d{i}", "REFUND_GRANTED")

    a = json.loads(c.get_reputation(ALICE))
    assert a["disputes_won"] == 4
    assert a["disputes_lost"] == 0
    # win_rate*50 = 50, no validator/appeal activity.
    assert a["overall_score"] == 50

    b = json.loads(c.get_reputation(BOB))
    assert b["disputes_lost"] == 4
    assert b["overall_score"] == 0  # lost everything


def test_win_rate_calculation(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # Alice: 3 wins, 1 loss -> win_rate 75%.
    c.record_verdict(ALICE, BOB, "d1", "v")
    c.record_verdict(ALICE, BOB, "d2", "v")
    c.record_verdict(ALICE, BOB, "d3", "v")
    c.record_verdict(BOB, ALICE, "d4", "v")  # Alice loses this one

    stats = json.loads(c.get_user_stats(ALICE))
    assert stats["win_rate"] == 75
    assert stats["disputes_won"] == 3
    assert stats["disputes_lost"] == 1
    # score = 0.75*50 = 37.5 -> 38 (rounded)
    assert stats["overall_score"] == 38


def test_validator_accuracy(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # 8 of 10 rounds agreed -> accuracy 80%.
    for i in range(10):
        agreed = i < 8
        c.record_validator_round(VAL, agreed)

    stats = json.loads(c.get_user_stats(VAL))
    assert stats["validator_accuracy"] == 80
    rep = json.loads(c.get_reputation(VAL))
    assert rep["validator_rounds"] == 10
    assert rep["validator_agreements"] == 8
    # score = accuracy(0.8)*40 = 32
    assert rep["overall_score"] == 32


def test_credibility_full_formula(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # win_rate 1.0 (2/2), validator_acc 1.0 (2/2), appeal_success 1.0 (1/1)
    c.record_verdict(ALICE, BOB, "d1", "v")
    c.record_verdict(ALICE, BOB, "d2", "v")
    c.record_validator_round(ALICE, True)
    c.record_validator_round(ALICE, True)
    c.record_appeal_outcome(ALICE, True)
    # 50 + 40 + 10 = 100
    assert c.get_credibility_score(ALICE) == 100


def test_appeal_outcome_recorded(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_appeal_outcome(ALICE, True)
    c.record_appeal_outcome(ALICE, False)
    rep = json.loads(c.get_reputation(ALICE))
    assert rep["appeal_filed"] == 2
    assert rep["appeal_won"] == 1
    stats = json.loads(c.get_user_stats(ALICE))
    assert stats["appeal_success"] == 50


def test_activity_log_records_all_events(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_dispute_filed(ALICE, "d1")
    c.record_verdict(ALICE, BOB, "d1", "v")
    c.record_validator_round(ALICE, True)
    c.record_appeal_outcome(ALICE, True)

    log = json.loads(c.get_activity_log(ALICE, 20))
    types = [e["event_type"] for e in log["events"]]
    # Most-recent first.
    assert types[0] == "APPEAL_WON"
    assert "DISPUTE_FILED" in types
    assert "DISPUTE_WON" in types
    assert "VALIDATOR_ROUND" in types
    assert len(log["events"]) == 4


def test_activity_log_limit(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    for i in range(30):
        c.record_dispute_filed(ALICE, f"d{i}")
    log = json.loads(c.get_activity_log(ALICE, 5))
    assert len(log["events"]) == 5
    # default limit when 0 passed
    log_def = json.loads(c.get_activity_log(ALICE, 0))
    assert len(log_def["events"]) == 20


def test_get_user_stats_unknown(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    stats = json.loads(c.get_user_stats("0x9999999999999999999999999999999999999999"))
    assert stats["win_rate"] == 0
    assert stats["disputes_filed"] == 0


def test_unknown_reputation_defaults(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    rep = json.loads(c.get_reputation("0x9999999999999999999999999999999999999999"))
    assert rep["exists"] is False
    assert rep["overall_score"] == 0
    assert c.get_credibility_score("0x9999999999999999999999999999999999999999") == 0
