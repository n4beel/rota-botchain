"use client";

import React from "react";
import type { Address } from "viem";
import { formatAddress, formatBot, upcomingDuties } from "@/lib/rota";
import type { FullRota } from "@/lib/useRota";

interface LedgerStripProps {
  rota: FullRota;
  currentUser?: Address;
}

export function LedgerStrip({ rota, currentUser }: LedgerStripProps) {
  const {
    memberCount,
    members,
    startedAt,
    periodSecs,
    cycles,
    bondsLeft,
    currentP,
  } = rota;

  const isStarted = startedAt > 0n;
  const totalPeriods = memberCount * cycles;
  const nextDuties = isStarted
    ? upcomingDuties(members, startedAt, periodSecs, totalPeriods, currentP, 3)
    : [];

  return (
    <div className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl divide-y divide-[var(--border-subtle)] overflow-hidden">
      {/* Top section: Member Bonds */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Member Bonds ({formatBot(rota.bond)} BOT stake)
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Penalty: {formatBot(rota.penalty)} BOT/miss
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {members.map((m, idx) => {
            const bond = bondsLeft[m.toLowerCase()] ?? rota.bond;
            const isUser = currentUser && m.toLowerCase() === currentUser.toLowerCase();
            const hasPenalty = isStarted && bond < rota.bond;

            return (
              <div
                key={`ledger-b-${m}-${idx}`}
                className="p-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[var(--text-muted)]">
                    #{idx + 1} {formatAddress(m)}
                  </span>
                  {isUser && (
                    <span className="text-[10px] text-[var(--success)] font-mono">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      hasPenalty ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {formatBot(bond)} BOT
                  </span>
                  {hasPenalty && (
                    <span className="text-[10px] text-[var(--danger)] font-mono">
                      -{formatBot(rota.bond - bond)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom section: Next Three Duty Slots */}
      <div className="p-4 bg-[var(--bg-surface)]/60">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Upcoming Duty Slots
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Cycle {Math.min(Math.floor(currentP / Math.max(memberCount, 1)) + 1, cycles)} of {cycles}
          </span>
        </div>

        {nextDuties.length === 0 ? (
          <div className="text-xs font-mono text-[var(--text-muted)] italic py-1">
            {!isStarted ? "Rotation has not started yet." : "No remaining duty slots."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {nextDuties.map((duty, idx) => {
              const isUser =
                currentUser && duty.member.toLowerCase() === currentUser.toLowerCase();

              return (
                <div
                  key={`duty-slot-${duty.p}`}
                  className="p-2.5 rounded-lg bg-[var(--bg-base)]/70 border border-[var(--border-subtle)] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                    <span>Slot +{idx + 1} (P{duty.p + 1})</span>
                    <span>Cycle {duty.cycle}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                      {isUser ? "You" : formatAddress(duty.member)}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--accent)]">
                      Starts in ~{Math.max(0, Math.round((Number(duty.startsAt) - Date.now() / 1000) / 60))}m
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
