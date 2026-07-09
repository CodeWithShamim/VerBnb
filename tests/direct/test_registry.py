"""Direct-mode tests for verBnb_registry.py (master registry)."""

import json

CONTRACT = "contracts/verBnb_registry.py"

A = "0x1111111111111111111111111111111111111111"  # listing judge
B = "0x2222222222222222222222222222222222222222"  # not as described
C = "0x3333333333333333333333333333333333333333"  # ethical sourcing
D = "0x4444444444444444444444444444444444444444"  # delivery


def _deploy(direct_deploy):
    return direct_deploy(CONTRACT, A, B, C, D)


def test_category_routing(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    assert reg.get_contract_for_category("RENTAL") == A
    assert reg.get_contract_for_category("PRODUCT") == B
    assert reg.get_contract_for_category("SOURCING") == C
    assert reg.get_contract_for_category("DELIVERY") == D
    assert reg.get_contract_for_category("rental") == A  # case-insensitive
    assert reg.get_contract_for_category("UNKNOWN") == ""
    addrs = json.loads(reg.get_addresses())
    assert addrs["RENTAL"] == A and addrs["DELIVERY"] == D


def test_register_and_stats_and_resolve(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice

    reg.register_dispute("rent-1", "RENTAL", A)

    stats = json.loads(reg.get_platform_stats())
    assert stats["total_disputes"] == 1
    assert stats["total_resolved"] == 0
    assert stats["resolution_rate"] == 0

    d = json.loads(reg.get_dispute("rent-1"))
    assert d["category"] == "RENTAL"
    assert d["contract_address"] == A
    assert d["resolved"] is False
    assert d["timestamp"] > 0
    submitter = d["submitter"]

    # User dispute index keyed by submitter.
    ud = json.loads(reg.get_user_disputes(submitter))
    assert ud["dispute_ids"] == ["rent-1"]

    reg.mark_resolved("rent-1")
    stats = json.loads(reg.get_platform_stats())
    assert stats["total_resolved"] == 1
    assert stats["resolution_rate"] == 100
    assert json.loads(reg.get_dispute("rent-1"))["resolved"] is True


def test_multiple_disputes_resolution_rate(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    reg.register_dispute("d1", "RENTAL", A)
    reg.register_dispute("d2", "PRODUCT", B)
    reg.register_dispute("d3", "DELIVERY", D)
    reg.register_dispute("d4", "SOURCING", C)
    reg.mark_resolved("d1")
    reg.mark_resolved("d2")
    stats = json.loads(reg.get_platform_stats())
    assert stats["total_disputes"] == 4
    assert stats["total_resolved"] == 2
    assert stats["resolution_rate"] == 50


def test_mark_resolved_idempotent(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    reg.register_dispute("d1", "RENTAL", A)
    reg.mark_resolved("d1")
    reg.mark_resolved("d1")  # second call must not double-count
    assert json.loads(reg.get_platform_stats())["total_resolved"] == 1


def test_unknown_category_reverts(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unknown category"):
        reg.register_dispute("bad-1", "TAXI", A)


def test_duplicate_register_reverts(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    reg.register_dispute("dup", "RENTAL", A)
    with direct_vm.expect_revert("already registered"):
        reg.register_dispute("dup", "RENTAL", A)


def test_mark_resolved_unknown_reverts(direct_vm, direct_deploy, direct_alice):
    reg = _deploy(direct_deploy)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unknown dispute"):
        reg.mark_resolved("missing")


def test_get_dispute_not_found(direct_vm, direct_deploy):
    reg = _deploy(direct_deploy)
    assert json.loads(reg.get_dispute("nope"))["error"] == "not_found"


def test_empty_user_disputes(direct_vm, direct_deploy):
    reg = _deploy(direct_deploy)
    ud = json.loads(reg.get_user_disputes("0x9999999999999999999999999999999999999999"))
    assert ud["dispute_ids"] == []


# --------------------------------------------------------------------------
# Phase 2: extension contract wiring (appeal/reputation/fraud/analytics).
# These exercise the new, backward-compatible registry surface only.
# --------------------------------------------------------------------------

E6 = "0x6666666666666666666666666666666666666666"  # appeal_manager
E7 = "0x7777777777777777777777777777777777777777"  # reputation_tracker
E8 = "0x8888888888888888888888888888888888888888"  # fraud_detector
E9 = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"  # analytics_tracker


def test_extension_addresses_default_empty(direct_vm, direct_deploy):
    # The original 4-arg constructor still works; extensions default to "".
    reg = _deploy(direct_deploy)
    ext = json.loads(reg.get_extension_addresses())
    assert ext["appeal_manager"] == ""
    assert ext["reputation_tracker"] == ""
    assert ext["fraud_detector"] == ""
    assert ext["analytics_tracker"] == ""


def test_constructor_accepts_extension_addresses(direct_vm, direct_deploy):
    reg = direct_deploy(CONTRACT, A, B, C, D, E6, E7, E8, E9)
    ext = json.loads(reg.get_extension_addresses())
    assert ext["appeal_manager"] == E6
    assert ext["reputation_tracker"] == E7
    assert ext["fraud_detector"] == E8
    assert ext["analytics_tracker"] == E9


def test_set_extension_addresses(direct_vm, direct_deploy):
    reg = _deploy(direct_deploy)
    reg.set_extension_addresses(E6, E7, E8, E9)
    ext = json.loads(reg.get_extension_addresses())
    assert ext["appeal_manager"] == E6
    assert ext["analytics_tracker"] == E9


def test_set_extension_addresses_partial_update(direct_vm, direct_deploy):
    reg = direct_deploy(CONTRACT, A, B, C, D, E6, E7, E8, E9)
    # Empty strings are ignored - only the appeal manager changes.
    new_appeal = "0xAAaAAAAAaaaaAAaAAAaaAAAaaaAaAaaAAaAaAAaA"
    reg.set_extension_addresses(new_appeal, "", "", "")
    ext = json.loads(reg.get_extension_addresses())
    assert ext["appeal_manager"] == new_appeal
    assert ext["reputation_tracker"] == E7  # unchanged


def test_existing_routing_unchanged_with_extensions(direct_vm, direct_deploy):
    # Adding extensions must not disturb the original category routing.
    reg = direct_deploy(CONTRACT, A, B, C, D, E6, E7, E8, E9)
    assert reg.get_contract_for_category("RENTAL") == A
    assert reg.get_contract_for_category("DELIVERY") == D
    addrs = json.loads(reg.get_addresses())
    assert addrs["RENTAL"] == A and addrs["PRODUCT"] == B
