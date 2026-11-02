import { formatEther } from "viem";

export interface RotaData {
  id: bigint;
  createdAt: bigint;
  startedAt: bigint;
  periodSecs: number;
  memberCount: number;
  cycles: number;
  joined: number;
  bond: bigint;
  penalty: bigint;
  name: string;
}

export interface PeriodInfo {
  started: boolean;
  p: number;
  elapsedInPeriod: number;
  progress: number;
  endsAt: bigint;
}

export interface DutySlot {
  p: number;
  cycle: number;
  member: string;
  startsAt: bigint;
  endsAt: bigint;
}

/**
 * Calculates current period and progress through it based on time.
 */
export function periodAt(
  startedAt: bigint | number,
  periodSecs: number,
  nowSec: bigint | number
): PeriodInfo {
  const started = typeof startedAt === "bigint" ? Number(startedAt) : startedAt;
  const now = typeof nowSec === "bigint" ? Number(nowSec) : Math.floor(nowSec);

  if (started <= 0 || periodSecs <= 0) {
    return {
      started: false,
      p: 0,
      elapsedInPeriod: 0,
      progress: 0,
      endsAt: 0n,
    };
  }

  if (now < started) {
    return {
      started: true,
      p: 0,
      elapsedInPeriod: 0,
      progress: 0,
      endsAt: BigInt(started + periodSecs),
    };
  }

  const elapsed = now - started;
  const p = Math.floor(elapsed / periodSecs);
  const elapsedInPeriod = elapsed % periodSecs;
  const progress = Math.min(Math.max(elapsedInPeriod / periodSecs, 0), 1);
  const endsAt = BigInt(started + (p + 1) * periodSecs);

  return {
    started: true,
    p,
    elapsedInPeriod,
    progress,
    endsAt,
  };
}

/**
 * Returns which member address is on duty for period p.
 */
export function onDuty(members: string[], p: number): string {
  if (!members || members.length === 0) return "";
  const idx = ((p % members.length) + members.length) % members.length;
  return members[idx];
}

/**
 * Calculates the dial arm sweep angle in degrees for the roster wheel.
 * The arm starts at member i's position and sweeps through their arc sector over the period.
 */
export function armAngle(
  memberIndex: number,
  memberCount: number,
  periodProgress: number
): number {
  if (memberCount <= 0) return 0;
  const sectorSize = 360 / memberCount;
  const baseAngle = memberIndex * sectorSize;
  const sweep = Math.min(Math.max(periodProgress, 0), 1) * sectorSize;
  return (baseAngle + sweep) % 360;
}

/**
 * Returns the upcoming duty slots starting after the current period.
 */
export function upcomingDuties(
  members: string[],
  startedAt: bigint | number,
  periodSecs: number,
  totalPeriods: number,
  currentP: number,
  count = 3
): DutySlot[] {
  const started = typeof startedAt === "bigint" ? Number(startedAt) : startedAt;
  const slots: DutySlot[] = [];
  const startP = currentP + 1;
  const mLen = members.length;
  if (mLen === 0) return slots;

  for (let i = 0; i < count; i++) {
    const p = startP + i;
    if (p >= totalPeriods) break;
    const cycle = Math.floor(p / mLen) + 1;
    const member = members[p % mLen];
    const startsAt = BigInt(started + p * periodSecs);
    const endsAt = BigInt(started + (p + 1) * periodSecs);

    slots.push({
      p,
      cycle,
      member,
      startsAt,
      endsAt,
    });
  }

  return slots;
}

/**
 * Checks which past periods have ended but remain unacked and unsettled.
 */
export function settleablePeriods(
  totalPeriods: number,
  currentP: number,
  periodStates: Record<number, number>
): number[] {
  const list: number[] = [];
  // Only periods strictly before current period can be settled
  for (let p = 0; p < currentP && p < totalPeriods; p++) {
    // 0 = open (unacked)
    if ((periodStates[p] ?? 0) === 0) {
      list.push(p);
    }
  }
  return list;
}

/**
 * Human-readable duration formatting.
 */
export function formatPeriod(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return days === 1 ? "1 day" : `${days} days`;
  }
  const hours = Math.round(seconds / 3600);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * Formats wei balance to human-readable BOT string.
 */
export function formatBot(wei: bigint): string {
  const formatted = formatEther(wei);
  const [whole, dec] = formatted.split(".");
  if (!dec || dec === "0") return whole;
  const trimmed = dec.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/**
 * Truncated address formatting.
 */
export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
