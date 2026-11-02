import { describe, expect, it } from "vitest";
import {
  periodAt,
  onDuty,
  armAngle,
  upcomingDuties,
  settleablePeriods,
  formatPeriod,
  formatBot,
  formatAddress,
} from "../rota";
import { decodeContractError } from "../errors";

describe("rota helpers", () => {
  const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const CHARLIE = "0xcccccccccccccccccccccccccccccccccccccccc";
  const MEMBERS = [ALICE, BOB, CHARLIE];

  it("calculates period and progress accurately", () => {
    // Unstarted
    const unstarted = periodAt(0n, 3600, 1000);
    expect(unstarted.started).toBe(false);
    expect(unstarted.p).toBe(0);

    // Started at t=1000, now=1900 (900s in = 25% of 3600s)
    const p0 = periodAt(1000n, 3600, 1900);
    expect(p0.started).toBe(true);
    expect(p0.p).toBe(0);
    expect(p0.progress).toBe(0.25);
    expect(p0.endsAt).toBe(4600n);

    // Period 1 (at t=4600 + 1800 = 6400 -> p=1, progress 50%)
    const p1 = periodAt(1000n, 3600, 6400);
    expect(p1.p).toBe(1);
    expect(p1.progress).toBe(0.5);
  });

  it("determines on-duty member with cycle wrapping", () => {
    expect(onDuty(MEMBERS, 0)).toBe(ALICE);
    expect(onDuty(MEMBERS, 1)).toBe(BOB);
    expect(onDuty(MEMBERS, 2)).toBe(CHARLIE);
    expect(onDuty(MEMBERS, 3)).toBe(ALICE); // wraps to cycle 2
    expect(onDuty(MEMBERS, 4)).toBe(BOB);
  });

  it("computes dial arm sweep angle across sectors", () => {
    // 3 members -> 120 degrees per sector
    // Member 0 (0..120 deg) at 50% progress -> 60 deg
    expect(armAngle(0, 3, 0.5)).toBe(60);

    // Member 1 (120..240 deg) at 0% progress -> 120 deg
    expect(armAngle(1, 3, 0)).toBe(120);

    // Member 2 (240..360 deg) at 100% progress -> 360 % 360 = 0 deg
    expect(armAngle(2, 3, 1)).toBe(0);
  });

  it("identifies upcoming duty slots", () => {
    // 3 members, 2 cycles = 6 periods. Current period is 1 (Bob).
    // Upcoming: p=2 (Charlie), p=3 (Alice), p=4 (Bob).
    const slots = upcomingDuties(MEMBERS, 1000n, 3600, 6, 1, 3);
    expect(slots.length).toBe(3);
    expect(slots[0].p).toBe(2);
    expect(slots[0].member).toBe(CHARLIE);
    expect(slots[1].p).toBe(3);
    expect(slots[1].member).toBe(ALICE);
    expect(slots[2].p).toBe(4);
    expect(slots[2].member).toBe(BOB);
  });

  it("finds settleable periods correctly", () => {
    // Current period is 3. Periods 0, 1, 2 are in the past.
    // P0: 1 (acked), P1: 0 (unacked), P2: 2 (settled).
    const states = { 0: 1, 1: 0, 2: 2 };
    const settleable = settleablePeriods(6, 3, states);
    expect(settleable).toEqual([1]);
  });

  it("formats periods, balances, and addresses", () => {
    expect(formatPeriod(3600)).toBe("1 hour");
    expect(formatPeriod(7200)).toBe("2 hours");
    expect(formatPeriod(86400)).toBe("1 day");
    expect(formatPeriod(86400 * 7)).toBe("7 days");

    expect(formatBot(1000000000000000000n)).toBe("1");
    expect(formatBot(1500000000000000000n)).toBe("1.5");
    expect(formatBot(0n)).toBe("0");

    expect(formatAddress(ALICE)).toBe("0xaaaa...aaaa");
  });

  it("decodes contract errors with friendly messages", () => {
    expect(
      decodeContractError(
        new Error(`execution reverted: NotOnDuty("${ALICE}")`)
      )
    ).toBe("It's 0xaaaa...aaaa's turn.");

    expect(
      decodeContractError(
        new Error("execution reverted: WrongBond(1000000000000000000)")
      )
    ).toBe("Join with exactly 1 BOT.");

    expect(decodeContractError(new Error("execution reverted: NotEnded()"))).toBe(
      "That period hasn't ended."
    );

    expect(
      decodeContractError(new Error("execution reverted: NotSettled()"))
    ).toBe("All ended periods must be settled before exiting.");
  });
});
