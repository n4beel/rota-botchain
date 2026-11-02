# Rota

Take turns being on call. Miss yours and it costs you.

Rota is a peer-to-peer on-call duty rotation on BOT Chain. A group forms a fixed roster order, deposits required bond collateral, and takes turns serving time-based on-call duty slots. If a member acknowledges their turn with `ack()`, their bond is preserved. If they miss their window, anyone can call `settle()` to deduct the penalty from their bond and transfer it directly to the next person on the roster.

## Protocol Limits & Parameters

All limits are enforced directly on-chain via immutable constants in `contracts/src/Rota.sol`:

| Parameter | Value | Description |
|---|---|---|
| `MIN_MEMBERS` | 2 | Minimum participants required in a roster |
| `MAX_MEMBERS` | 8 | Maximum participants permitted in a roster |
| `MIN_PERIOD` | 3,600s (1 hour) | Minimum duty period length |
| `MAX_PERIOD` | 2,592,000s (30 days) | Maximum duty period length |
| `MIN_CYCLES` | 1 | Minimum complete rotation cycles |
| `MAX_CYCLES` | 12 | Maximum complete rotation cycles |
| `JOIN_WINDOW` | 604,800s (7 days) | Grace period to gather all members before exit is unlocked |
| `MAX_BATCH` | 50 | Maximum items returned by batch view functions |
| `MAX_NAME_BYTES` | 40 bytes | Maximum UTF-8 length for rota name |

## Architecture & Mechanics

- **Round-Robin Execution**: Total duty periods equal `memberCount * cycles`. Period `p` belongs to `members[p % memberCount]`.
- **Acknowledgement**: The member on duty signs `ack(id)` during their active period window `[startedAt + p * periodSecs, startedAt + (p + 1) * periodSecs)`.
- **Missed Duty Penalty**: If a period ends unacknowledged, anyone may call `settle(id, p)`. The penalty is deducted from the negligent member's remaining bond and credited to `pending[nextMember]`.
- **Solvency Invariant**: `address(this).balance == sum(pending) + sum(bondLeft)`. Staked bonds and earned penalties are strictly segregated.
- **Pull Payment Payouts**: Reclaimed bonds and penalties are disbursed via non-reentrant `withdraw()`, preventing reentrancy attacks or denial-of-service from malicious receivers.
- **Join Window Deadlock Protection**: If a rota fails to reach full quorum within 7 days (`JOIN_WINDOW = 604,800s`), any joined member can call `exit(id)` to recover 100% of their deposited bond.

## Local Development & Testing

```bash
# Run unit & fuzz tests
cd contracts && forge test

# Run stateful invariant solvency suite (32,768 calls)
cd contracts && forge test --match-contract RotaInvariantTest

# Run mutation testing
python3 scripts/mutate.py

# Run local stack runner with 4 seeded scenarios on port 8729
node scripts/local-stack.mjs

# Start frontend
npm run dev
```
