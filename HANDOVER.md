# Rota Handover Report

> Take turns being on call. Miss yours and it costs you.

## Status: Ready for Handover

Rota is complete, verified, and adheres to all requirements specified in `docs/specs/29-rota.md`, `00-CONVENTIONS.md`, and `IMPLEMENT-WAVE3.md`.

## 1. Contract & Invariants (`Rota.sol`)

- **The One Transaction**: `ack(uint256 id)` ("I'm on duty")
- **Core Architecture & Mechanics**:
  - `create(name, members, periodSecs, cycles, bond, penalty)` sets a fixed roster order of 2–8 participants.
  - Participants stake `bond` BOT via `join(id)` payable function.
  - When all nominated participants join, the rotation starts (`startedAt = block.timestamp`).
  - Total duty periods equal `memberCount * cycles`. Period `p` belongs to `members[p % memberCount]`.
  - Member on duty must sign `ack(id)` during their active period window `[startedAt + p * periodSecs, startedAt + (p + 1) * periodSecs)`.
  - If a period lapses unacknowledged, anyone can call `settle(id, p)` to transfer `penalty` BOT from the negligent member's remaining bond to `pending[nextMember]`.
  - Solvency guarantee: `address(this).balance == sum(pending) + sum(bondLeft)`.
  - Once all periods have ended and all unacknowledged periods are settled, members can call `exit(id)` to reclaim their remaining bond balance.
  - Join window protection: If a rota fails to reach full quorum within 7 days (`JOIN_WINDOW = 604800`), any joined member can call `exit(id)` to reclaim 100% of their deposited bond.
  - Non-reentrant pull payments: Reclaimed bonds and earned penalties are disbursed via `withdraw()`.
- **Protocol Limits (Direct from Contract Constants)**:
  - `MIN_MEMBERS = 2`
  - `MAX_MEMBERS = 8`
  - `MIN_PERIOD = 3600` (1 hour)
  - `MAX_PERIOD = 2592000` (30 days)
  - `MIN_CYCLES = 1`
  - `MAX_CYCLES = 12`
  - `JOIN_WINDOW = 604800` (7 days)
  - `MAX_BATCH = 50`
  - `MAX_NAME_BYTES = 40`

## 2. Test Verification

### 2.1 Foundry Test Suite
- **27 Forge tests passed**:
  - 26 Unit & Fuzz tests (`Rota.t.sol`): `test_CreateRota`, `test_BadNameReverts`, `test_BadMembersReverts`, `test_BadPeriodReverts`, `test_BadCyclesReverts`, `test_BadBondReverts`, `test_StartsWhenAllJoined`, `test_OnlyMembersJoin`, `test_WrongBondReverts`, `test_JoinAlreadyJoinedReverts`, `test_AckByOnDutyOnly_ArgsExpected`, `test_AckTwiceReverts`, `test_AckNotStartedReverts`, `test_AckOverReverts`, `test_SettleBeforeEndReverts`, `test_SettleTwiceReverts`, `test_MissedPeriodMovesPenaltyToNext`, `test_PenaltyCappedByBondLeft`, `test_RotationOrderWrapsCycles`, `test_ExitBeforeSettledReverts`, `test_ExitAfterAllSettled`, `test_UnstartedRotaExitAfterJoinWindow`, `test_WithdrawZeroReverts`, `test_ReentrantWithdrawBlocked`, `testFuzz_CurrentPeriodMatchesTime`, `testFuzz_BondConservation`.
  - 1 Invariant Suite (`RotaInvariant.t.sol`): 32,768 stateful calls across 256 runs asserting `address(this).balance == sum(pending) + sum(bondLeft)` with 0 balance discrepancies.
- **Mutation Testing (`scripts/mutate.py`)**:
  - 25 of 25 mutants killed (100% mutation score).

### 2.2 Vitest Unit & Lint Suite
- **53 Vitest unit & lint tests passed**:
  - Hook-deps lint: 4 tests passed.
  - Network pinning lint (`test/lint/chain-write-pinned.test.ts`): 6 tests passed.
  - Rota unit tests (`lib/__tests__/rota.test.ts`): 7 tests passed (`periodAt`, `onDuty`, `armAngle`, `upcomingDuties`, `settleablePeriods`, `formatPeriod`, `formatBot`).
  - Limits, active chain, wagmi chains, amount, deployment, wallet tests: 36 tests passed.

### 2.3 On-Chain Integration Tests (`test/integration/rota.test.ts`)
- **7 Integration tests passed** against local Anvil on port 8629:
  - Full lifecycle: create, join quorum, active period ack, missed duty penalty transfer, exit, withdraw.
  - Join window timeout: unstarted rota allows joined members to exit after 7 days.
  - Error reverts: `BadName`, `BadMembers`, `WrongBond`, `NotOnDuty`, `NotEnded`.
  - ABI verification: `abi-matches-contract.test.ts`.

## 3. Frontend & Archetype AH · Roster Wheel

- **Archetype AH Implementation**:
  - **The Roster Dial (`RosterWheel.tsx`)**: Circular wheel with member badges arranged radially in roster order; bright orange indicator arm sweeping through the active period; orange ticks for acked duties and hollow notches for missed duties on outer ring; central hub displaying on-call member, live countdown, and the prominent "I'm on duty" ack button.
  - **Mobile Roster Alternative (`MobileRoster.tsx`)**: Responsive vertical roster stacked with member badges, status tags, bonds left, and check-in buttons for viewports under 600px.
  - **Ledger Strip (`LedgerStrip.tsx`)**: Plain strip below the dial detailing bonds remaining per member and upcoming duty schedule for the next three slots.
  - **Mini Dials on Home (`MiniDial.tsx`)**: Home screen displays a clean list of miniature wheel dials (no cards).
  - **Consequence Sentence in Form (`app/new/page.tsx`)**: Clear explanation of bond stakes and penalty routing.
  - **Limits Placard (`RotaNotice.tsx`)**: "What a check-in can't prove" heading with core operational caveats.
- **Shared UI Contract**:
  - 3 footer links on every route (`botchain.ai`, `scan.botchain.ai`, and contract on explorer via `BuiltOnBotChain`).
  - Wallet menu uses opaque `--menu-*` tokens.
  - Active network pinning to `activeBotChain.id`.

## 4. Browser CDP Walkthrough

Automated CDP test (`scripts/browser-walkthrough.mjs`) on local stack (port 8729) verified:
- Viewports 1280px and 360px across all routes (`/`, `/new`, `/rota/1`, `/rota/2`, `/rota/3`, `/rota/4`, `/me`, `/not-found`).
- 0px horizontal overflow across all tested viewports and routes.
- 0 browser console errors.
