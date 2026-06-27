# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Verdix - Reputation Tracker (user reputation + history)

Tracks reputation for every address that touches the platform - disputants
(filed / won / lost) and validators (rounds / agreements) - plus appeal
outcomes, and rolls them into a single 0-100 credibility score.

Deterministic only. Written by the off-chain orchestrator at the same
lifecycle points the existing registry uses (register_dispute / mark_resolved):
when a dispute is filed, when a verdict finalizes, after each validator round,
and when an appeal resolves.

Credibility score (0-100):
    (win_rate * 50) + (validator_accuracy * 40) + (appeal_success * 10)
where each rate is a fraction in [0, 1].
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from genlayer import *

# Cap on activity events retained per address (keeps storage + views bounded).
MAX_ACTIVITY_EVENTS = 200
DEFAULT_LOG_LIMIT = 20

EVENT_DISPUTE_FILED = "DISPUTE_FILED"
EVENT_DISPUTE_WON = "DISPUTE_WON"
EVENT_DISPUTE_LOST = "DISPUTE_LOST"
EVENT_VALIDATOR_ROUND = "VALIDATOR_ROUND"
EVENT_APPEAL_FILED = "APPEAL_FILED"
EVENT_APPEAL_WON = "APPEAL_WON"


@allow_storage
@dataclass
class UserReputation:
    address: str
    disputes_filed: u32
    disputes_won: u32
    disputes_lost: u32
    validator_rounds: u32
    validator_agreements: u32
    appeal_filed: u8
    appeal_won: u8
    overall_score: u8  # 0-100
    last_active: u256


@allow_storage
@dataclass
class ActivityEvent:
    event_type: str
    timestamp: u256
    dispute_id: str
    details: str  # JSON blob


def _credibility(rep: UserReputation) -> int:
    """(win_rate*50) + (validator_accuracy*40) + (appeal_success*10) -> 0..100."""
    filed = int(rep.disputes_filed)
    won = int(rep.disputes_won)
    lost = int(rep.disputes_lost)
    decided = won + lost
    win_rate = (won / decided) if decided > 0 else 0.0

    rounds = int(rep.validator_rounds)
    agreements = int(rep.validator_agreements)
    accuracy = (agreements / rounds) if rounds > 0 else 0.0

    appeals = int(rep.appeal_filed)
    appeals_won = int(rep.appeal_won)
    appeal_success = (appeals_won / appeals) if appeals > 0 else 0.0

    score = win_rate * 50 + accuracy * 40 + appeal_success * 10
    return max(0, min(100, int(round(score))))


class ReputationTracker(gl.Contract):
    reputations: TreeMap[str, UserReputation]
    activity_log: TreeMap[str, DynArray[ActivityEvent]]

    def __init__(self) -> None:
        pass

    # ---------------------------------------------------------------- helpers

    def _key(self, address: str) -> str:
        return address.lower()

    def _get_or_create(self, address: str) -> UserReputation:
        key = self._key(address)
        rep = self.reputations.get(key)
        if rep is None:
            rep = UserReputation(
                address=address,
                disputes_filed=u32(0),
                disputes_won=u32(0),
                disputes_lost=u32(0),
                validator_rounds=u32(0),
                validator_agreements=u32(0),
                appeal_filed=u8(0),
                appeal_won=u8(0),
                overall_score=u8(0),
                last_active=u256(0),
            )
            self.reputations[key] = rep
        return self.reputations[key]

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _log(self, address: str, event_type: str, dispute_id: str, details: str) -> None:
        events = self.activity_log.get_or_insert_default(self._key(address))
        events.append(
            ActivityEvent(
                event_type=event_type,
                timestamp=u256(self._now()),
                dispute_id=dispute_id,
                details=details[:500],
            )
        )
        # Trim oldest if we exceed the cap.
        while len(events) > MAX_ACTIVITY_EVENTS:
            events.pop(0)

    def _refresh_score(self, rep: UserReputation) -> None:
        rep.overall_score = u8(_credibility(rep))
        rep.last_active = u256(self._now())

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def record_dispute_filed(self, address: str, dispute_id: str) -> None:
        rep = self._get_or_create(address)
        rep.disputes_filed = u32(int(rep.disputes_filed) + 1)
        self._refresh_score(rep)
        self._log(address, EVENT_DISPUTE_FILED, dispute_id, json.dumps({"role": "disputant"}))

    @gl.public.write
    def record_verdict(
        self,
        winner_address: str,
        loser_address: str,
        dispute_id: str,
        verdict_string: str,
    ) -> None:
        winner = self._get_or_create(winner_address)
        winner.disputes_won = u32(int(winner.disputes_won) + 1)
        self._refresh_score(winner)
        self._log(
            winner_address, EVENT_DISPUTE_WON, dispute_id,
            json.dumps({"verdict": verdict_string[:200], "outcome": "won"}),
        )

        loser = self._get_or_create(loser_address)
        loser.disputes_lost = u32(int(loser.disputes_lost) + 1)
        self._refresh_score(loser)
        self._log(
            loser_address, EVENT_DISPUTE_LOST, dispute_id,
            json.dumps({"verdict": verdict_string[:200], "outcome": "lost"}),
        )

    @gl.public.write
    def record_validator_round(self, validator_address: str, agreed_with_majority: bool) -> None:
        rep = self._get_or_create(validator_address)
        rep.validator_rounds = u32(int(rep.validator_rounds) + 1)
        if agreed_with_majority:
            rep.validator_agreements = u32(int(rep.validator_agreements) + 1)
        self._refresh_score(rep)
        self._log(
            validator_address, EVENT_VALIDATOR_ROUND, "",
            json.dumps({"agreed": bool(agreed_with_majority)}),
        )

    @gl.public.write
    def record_appeal_outcome(self, appellant_address: str, appeal_won: bool) -> None:
        rep = self._get_or_create(appellant_address)
        rep.appeal_filed = u8(min(255, int(rep.appeal_filed) + 1))
        event_type = EVENT_APPEAL_FILED
        if appeal_won:
            rep.appeal_won = u8(min(255, int(rep.appeal_won) + 1))
            event_type = EVENT_APPEAL_WON
        self._refresh_score(rep)
        self._log(
            appellant_address, event_type, "",
            json.dumps({"appeal_won": bool(appeal_won)}),
        )

    # ----------------------------------------------------------------- views

    @gl.public.view
    def get_reputation(self, address: str) -> str:
        rep = self.reputations.get(self._key(address))
        if rep is None:
            return json.dumps(
                {
                    "address": address,
                    "disputes_filed": 0,
                    "disputes_won": 0,
                    "disputes_lost": 0,
                    "validator_rounds": 0,
                    "validator_agreements": 0,
                    "appeal_filed": 0,
                    "appeal_won": 0,
                    "overall_score": 0,
                    "last_active": 0,
                    "exists": False,
                }
            )
        return json.dumps(
            {
                "address": rep.address,
                "disputes_filed": int(rep.disputes_filed),
                "disputes_won": int(rep.disputes_won),
                "disputes_lost": int(rep.disputes_lost),
                "validator_rounds": int(rep.validator_rounds),
                "validator_agreements": int(rep.validator_agreements),
                "appeal_filed": int(rep.appeal_filed),
                "appeal_won": int(rep.appeal_won),
                "overall_score": _credibility(rep),
                "last_active": int(rep.last_active),
                "exists": True,
            }
        )

    @gl.public.view
    def get_user_stats(self, address: str) -> str:
        rep = self.reputations.get(self._key(address))
        if rep is None:
            return json.dumps(
                {
                    "address": address,
                    "disputes_filed": 0,
                    "win_rate": 0,
                    "validator_accuracy": 0,
                    "appeal_success": 0,
                }
            )
        decided = int(rep.disputes_won) + int(rep.disputes_lost)
        win_rate = (int(rep.disputes_won) * 100 // decided) if decided > 0 else 0
        rounds = int(rep.validator_rounds)
        accuracy = (int(rep.validator_agreements) * 100 // rounds) if rounds > 0 else 0
        appeals = int(rep.appeal_filed)
        appeal_success = (int(rep.appeal_won) * 100 // appeals) if appeals > 0 else 0
        return json.dumps(
            {
                "address": rep.address,
                "disputes_filed": int(rep.disputes_filed),
                "disputes_won": int(rep.disputes_won),
                "disputes_lost": int(rep.disputes_lost),
                "win_rate": win_rate,  # percentage 0-100
                "validator_accuracy": accuracy,  # percentage 0-100
                "appeal_success": appeal_success,  # percentage 0-100
                "overall_score": _credibility(rep),
            }
        )

    @gl.public.view
    def get_activity_log(self, address: str, limit: int) -> str:
        n = int(limit) if limit and int(limit) > 0 else DEFAULT_LOG_LIMIT
        events = self.activity_log.get(self._key(address))
        out = []
        if events is not None:
            total = len(events)
            start = max(0, total - n)
            # Most-recent first.
            for i in range(total - 1, start - 1, -1):
                e = events[i]
                out.append(
                    {
                        "event_type": e.event_type,
                        "timestamp": int(e.timestamp),
                        "dispute_id": e.dispute_id,
                        "details": e.details,
                    }
                )
        return json.dumps({"address": address, "events": out})

    @gl.public.view
    def get_credibility_score(self, address: str) -> int:
        rep = self.reputations.get(self._key(address))
        if rep is None:
            return 0
        return _credibility(rep)
