"""Direct-mode tests for the access-control layer added to the contracts.

Deploys always run as the default sender (the "owner"); tests switch
direct_vm.sender to alice/bob to exercise the unauthorized paths.
"""

import json
import time

REGISTRY = "contracts/verBnb_registry.py"
APPEAL = "contracts/appeal_manager.py"
REPUTATION = "contracts/reputation_tracker.py"
FRAUD = "contracts/fraud_detector.py"
ANALYTICS = "contracts/analytics_tracker.py"

A = "0x1111111111111111111111111111111111111111"  # listing judge
B = "0x2222222222222222222222222222222222222222"  # not as described
C = "0x3333333333333333333333333333333333333333"  # ethical sourcing
D = "0x4444444444444444444444444444444444444444"  # delivery

E6 = "0x6666666666666666666666666666666666666666"
E7 = "0x7777777777777777777777777777777777777777"
E8 = "0x8888888888888888888888888888888888888888"
E9 = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"


def _hex(addr) -> str:
    if hasattr(addr, "as_hex"):
        return addr.as_hex.lower()
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + addr.hex()
    return str(addr).lower()


# ------------------------------------------------------------------ registry


def test_registry_owner_is_deployer(direct_vm, direct_deploy, direct_owner):
    reg = direct_deploy(REGISTRY, A, B, C, D)
    assert reg.get_owner() == _hex(direct_owner)


def test_set_extension_addresses_owner_only(direct_vm, direct_deploy, direct_alice):
    reg = direct_deploy(REGISTRY, A, B, C, D)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        reg.set_extension_addresses(E6, E7, E8, E9)
    # Extensions must be unchanged.
    ext = json.loads(reg.get_extension_addresses())
    assert ext["appeal_manager"] == ""


def test_register_dispute_rejects_wrong_contract_address(
    direct_vm, direct_deploy, direct_alice
):
    reg = direct_deploy(REGISTRY, A, B, C, D)
    direct_vm.sender = direct_alice
    # B is the PRODUCT contract, not the RENTAL one.
    with direct_vm.expect_revert("does not match"):
        reg.register_dispute("r-1", "RENTAL", B)
    # The routed address (case-insensitive) is accepted.
    reg.register_dispute("r-1", "RENTAL", A.upper().replace("0X", "0x"))


def test_mark_resolved_only_owner_or_submitter(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    reg = direct_deploy(REGISTRY, A, B, C, D)
    direct_vm.sender = direct_alice
    reg.register_dispute("d-1", "RENTAL", A)
    reg.register_dispute("d-2", "PRODUCT", B)

    # A third party cannot resolve alice's dispute.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("unauthorized"):
        reg.mark_resolved("d-1")

    # The submitter can resolve their own dispute.
    direct_vm.sender = direct_alice
    reg.mark_resolved("d-1")

    # The owner (orchestrator) can resolve anyone's dispute.
    from gltest.direct.loader import create_address

    direct_vm.sender = create_address("default_sender")
    reg.mark_resolved("d-2")

    stats = json.loads(reg.get_platform_stats())
    assert stats["total_resolved"] == 2


def test_transfer_ownership(direct_vm, direct_deploy, direct_alice, direct_bob):
    reg = direct_deploy(REGISTRY, A, B, C, D)

    # Non-owner cannot transfer.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        reg.transfer_ownership(_hex(direct_alice))

    # Owner transfers to alice; alice gains admin rights.
    from gltest.direct.loader import create_address

    direct_vm.sender = create_address("default_sender")
    with direct_vm.expect_revert("invalid owner"):
        reg.transfer_ownership("not-an-address")
    reg.transfer_ownership(_hex(direct_alice))
    assert reg.get_owner() == _hex(direct_alice)

    direct_vm.sender = direct_alice
    reg.set_extension_addresses(E6, "", "", "")
    assert json.loads(reg.get_extension_addresses())["appeal_manager"] == E6


# ------------------------------------------------------------- appeal manager


def test_finalize_appeal_owner_only(direct_vm, direct_deploy, direct_alice):
    mgr = direct_deploy(APPEAL)
    now = int(time.time())
    direct_vm.sender = direct_alice
    mgr.create_appeal(
        "disp-1", _hex(direct_alice), now, 40, _hex(direct_alice), "0x" + "b" * 40,
        "verdict ignored my evidence", "",
    )
    with direct_vm.expect_revert("unauthorized"):
        mgr.finalize_appeal("disp-1-appeal-1", "UPHELD", 40)


def test_create_appeal_sender_must_be_appellant(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    mgr = direct_deploy(APPEAL)
    now = int(time.time())
    # Bob cannot file an appeal pretending to be alice.
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not the appellant"):
        mgr.create_appeal(
            "disp-2", _hex(direct_alice), now, 40, _hex(direct_alice),
            _hex(direct_bob), "reason", "",
        )
    # The owner (orchestrator) may file on a user's behalf.
    from gltest.direct.loader import create_address

    direct_vm.sender = create_address("default_sender")
    appeal_id = mgr.create_appeal(
        "disp-2", _hex(direct_alice), now, 40, _hex(direct_alice),
        _hex(direct_bob), "reason", "",
    )
    assert appeal_id == "disp-2-appeal-1"
    # And the owner can finalize it.
    out = json.loads(mgr.finalize_appeal(appeal_id, "OVERTURNED", 70))
    assert out["did_overturn_original"] is True


# ---------------------------------------------------------- tracker contracts


def test_reputation_writes_owner_only(direct_vm, direct_deploy, direct_alice):
    rep = direct_deploy(REPUTATION)
    me = _hex(direct_alice)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        rep.record_dispute_filed(me, "d-1")
    with direct_vm.expect_revert("unauthorized"):
        rep.record_verdict(me, "0x" + "b" * 40, "d-1", "REFUND_GRANTED")
    with direct_vm.expect_revert("unauthorized"):
        rep.record_validator_round(me, True)
    with direct_vm.expect_revert("unauthorized"):
        rep.record_appeal_outcome(me, True)
    # Nothing was written; alice cannot self-inflate her score.
    assert rep.get_credibility_score(me) == 0


def test_fraud_detector_writes_owner_only(direct_vm, direct_deploy, direct_alice):
    fd = direct_deploy(FRAUD)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        fd.check_and_flag_patterns(_hex(direct_alice), "d-1", True, 0)
    with direct_vm.expect_revert("unauthorized"):
        fd.resolve_flag("any-flag-id")


def test_analytics_record_outcome_owner_only(direct_vm, direct_deploy, direct_alice):
    an = direct_deploy(ANALYTICS)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        an.record_outcome("d-1", "RENTAL", "FAVORABLE", 50, 3600, 0, "snippet")
    health = json.loads(an.get_platform_health())
    assert health["total_disputes_all_time"] == 0
