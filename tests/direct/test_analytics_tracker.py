"""Direct-mode tests for analytics_tracker.py (outcome stats + insights)."""

import json

CONTRACT = "contracts/analytics_tracker.py"


def test_category_stats_updated_on_outcome(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 3600, 0, "view accuracy violated")
    stats = json.loads(c.get_category_stats("RENTAL"))
    assert stats["total_disputes"] == 1
    assert stats["favorable_verdicts"] == 1
    assert stats["unfavorable"] == 0
    assert stats["avg_refund_pct"] == 60
    assert stats["avg_resolution_time"] == 3600
    assert stats["consensus_rate"] == 100  # 0 appeals -> first round


def test_avg_refund_rolling(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 40, 1000, 0, "amenity missing")
    c.record_outcome("d2", "RENTAL", "FAVORABLE", 80, 3000, 0, "wrong location")
    stats = json.loads(c.get_category_stats("RENTAL"))
    # (40 + 80) / 2 = 60
    assert stats["avg_refund_pct"] == 60
    # (1000 + 3000) / 2 = 2000
    assert stats["avg_resolution_time"] == 2000
    assert stats["total_disputes"] == 2


def test_consensus_rate(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # 3 first-round, 1 appealed -> consensus 75%.
    c.record_outcome("d1", "PRODUCT", "FAVORABLE", 50, 100, 0, "counterfeit item")
    c.record_outcome("d2", "PRODUCT", "UNFAVORABLE", 0, 100, 0, "minor scratch")
    c.record_outcome("d3", "PRODUCT", "FAVORABLE", 90, 100, 0, "wrong product")
    c.record_outcome("d4", "PRODUCT", "FAVORABLE", 70, 100, 2, "broken on arrival")
    stats = json.loads(c.get_category_stats("PRODUCT"))
    assert stats["consensus_rate"] == 75
    assert stats["favorable_verdicts"] == 3
    assert stats["unfavorable"] == 1


def test_verdict_inferred_from_refund(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    # Empty verdict string -> inferred from refund pct.
    c.record_outcome("d1", "DELIVERY", "", 0, 100, 0, "lost parcel")
    c.record_outcome("d2", "DELIVERY", "", 50, 100, 0, "late delivery")
    stats = json.loads(c.get_category_stats("DELIVERY"))
    assert stats["unfavorable"] == 1
    assert stats["favorable_verdicts"] == 1


def test_get_similar_disputes(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 100, 0, "ocean view was actually a parking lot")
    c.record_outcome("d2", "RENTAL", "UNFAVORABLE", 0, 100, 1, "minor paint scuff in bathroom")
    c.record_outcome("d3", "RENTAL", "FAVORABLE", 80, 100, 0, "advertised ocean view missing entirely")

    sim = json.loads(c.get_similar_disputes("RENTAL", "the ocean view was missing"))
    assert sim["match_count"] >= 2
    # Top match should be one of the ocean-view disputes.
    top = sim["results"][0]
    assert top["dispute_id"] in ("d1", "d3")
    assert "verdict" in top and "refund_percentage" in top
    assert len(sim["results"]) <= 5


def test_get_all_stats(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 100, 0, "x")
    c.record_outcome("d2", "SOURCING", "UNFAVORABLE", 0, 100, 0, "y")
    allstats = json.loads(c.get_all_stats())
    assert set(allstats.keys()) == {"RENTAL", "PRODUCT", "SOURCING", "DELIVERY"}
    assert allstats["RENTAL"]["total_disputes"] == 1
    assert allstats["PRODUCT"]["total_disputes"] == 0  # empty default


def test_platform_health(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 2000, 0, "x")
    c.record_outcome("d2", "RENTAL", "UNFAVORABLE", 0, 4000, 1, "y")
    c.record_outcome("d3", "PRODUCT", "FAVORABLE", 50, 3000, 0, "z")

    health = json.loads(c.get_platform_health())
    assert health["total_disputes_all_time"] == 3
    # avg time = (2000+4000+3000)/3 = 3000
    assert health["avg_resolution_time_all_categories"] == 3000
    # 2 of 3 first round -> 66
    assert health["consensus_rate_overall"] == 66
    assert health["most_common_category"] == "RENTAL"  # 2 disputes


def test_duplicate_outcome_reverts(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 100, 0, "x")
    with direct_vm.expect_revert("already recorded"):
        c.record_outcome("d1", "RENTAL", "FAVORABLE", 60, 100, 0, "x")


def test_unknown_category_reverts(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("unknown category"):
        c.record_outcome("d1", "TAXI", "FAVORABLE", 60, 100, 0, "x")


def test_empty_category_stats(direct_vm, direct_deploy):
    c = direct_deploy(CONTRACT)
    stats = json.loads(c.get_category_stats("RENTAL"))
    assert stats["total_disputes"] == 0
    assert stats["consensus_rate"] == 0
