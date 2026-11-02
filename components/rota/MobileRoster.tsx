"use client";

import React from "react";
import type { Address } from "viem";
import { formatAddress, formatBot, onDuty, periodAt } from "@/lib/rota";
import type { FullRota } from "@/lib/useRota";
import { Button } from "@/components/ui/Button";

interface MobileRosterProps {
  rota: FullRota;
  currentUser?: Address;
  onAck?: () => void;
  isAckPending?: boolean;
}

export function MobileRoster({
  rota,
  currentUser,
  onAck,
  isAckPending = false,
}: MobileRosterProps) {
  const nowSec = Math.floor(Date.now() / 1000);
  const {
    memberCount,
    members,
    startedAt,
    periodSecs,
    cycles,
    bondsLeft,
    periodStates,
  } = rota;

  const isStarted = startedAt > 0n;
  const totalPeriods = memberCount * cycles;
  const periodInfo = periodAt(startedAt, periodSecs, nowSec);
  const currentP = isStarted ? periodInfo.p : 0;
  const isOver = isStarted && currentP >= totalPeriods;

  const activeDutyMember = isStarted && !isOver ? onDuty(members, currentP) : "";
  const isUserOnDuty =
    Boolean(currentUser && activeDutyMember) &&
    currentUser!.toLowerCase() === activeDutyMember.toLowerCase();

  const currentPeriodAcked = (periodStates[currentP] ?? 0) === 1;

  return (
    <div className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
          Roster Order ({memberCount} Members)
        </span>
        <span className="text-xs font-mono text-[var(--accent)] font-semibold">
          {!isStarted
            ? `${rota.joined}/${memberCount} Joined`
            : isOver
            ? "Completed"
            : `Period ${currentP + 1}/${totalPeriods}`}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {members.map((m, idx) => {
          const isDuty = isStarted && !isOver && currentP % memberCount === idx;
          const isUser = currentUser && m.toLowerCase() === currentUser.toLowerCase();
          const bondLeft = bondsLeft[m.toLowerCase()] ?? rota.bond;
          const initials = m.slice(2, 6).toUpperCase();

          return (
            <div
              key={`mobile-m-${m}-${idx}`}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                isDuty
                  ? "bg-[var(--bg-base)] border-[var(--accent)] shadow-sm"
                  : "bg-[var(--bg-base)]/50 border-[var(--border-subtle)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold border ${
                    isDuty
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]"
                  }`}
                >
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
                      {formatAddress(m)}
                    </span>
                    {isUser && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)]">
                    Bond: {formatBot(bondLeft)} BOT
                  </div>
                </div>
              </div>

              <div className="text-right">
                {isDuty ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                      ON DUTY
                    </span>
                    {currentPeriodAcked ? (
                      <span className="text-[11px] text-[var(--success)] font-medium">
                        ✓ Acked
                      </span>
                    ) : isUserOnDuty ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={onAck}
                        loading={isAckPending}
                      >
                        I&apos;m on duty
                      </Button>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] italic">
                        Pending ack
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    Slot #{idx + 1}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
