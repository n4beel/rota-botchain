# Architectural & Security Decisions: Rota

## 1. Storage & Round-Robin Representation
- `_members` array stores fixed roster addresses in order of rotation.
- Total periods for a rota is `memberCount * cycles`. Period `p` (0-indexed) belongs to `_members[id][p % memberCount]`.
- Period state tracking `_periodState[id][p]` uses uint8:
  - `0`: Open (awaits check-in or expiration).
  - `1`: Acked (member on duty checked in).
  - `2`: Missed & settled (missed duty settled, penalty credited to next member).

## 2. Invariant & Solvency Guarantees
- Invariant: `address(this).balance == sum(pending) + sum(bondLeft)`.
- When a period is missed, penalty is capped by `_bondLeft[id][member]`. A member's bond can never underflow.
- Penalty transfer is routed directly to `pending[nextMember]`, where `nextMember = _members[id][(p + 1) % memberCount]`.

## 3. Pull Payments vs Push Transfers
- All disbursements (penalties won and returned remaining bonds upon exit) are routed into `pending[who]`.
- `withdraw()` zero-then-calls `msg.sender.call{value: amt}("")` guarded by `nonReentrant` mutex.
- This shields the protocol from malicious contract members reverting on receive or performing reentrancy attacks.

## 4. Join Window & Deadlock Prevention
- If a created rota does not gather all members, the 7-day join window (`JOIN_WINDOW = 604800`) allows any joined member to call `exit()` and reclaim 100% of their deposited bond.
- Started rotas require all periods to have completed and all unacked periods to be settled before `exit()` is unlocked, preventing premature exit while penalties could still be owed.
