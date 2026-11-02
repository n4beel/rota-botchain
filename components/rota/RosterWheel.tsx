"use client";

import React, { useEffect, useState } from "react";
import type { Address } from "viem";
import {
  periodAt,
  onDuty,
  armAngle,
  formatAddress,
} from "@/lib/rota";
import type { FullRota } from "@/lib/useRota";
import { Button } from "@/components/ui/Button";

interface RosterWheelProps {
  rota: FullRota;
  currentUser?: Address;
  onAck?: () => void;
  isAckPending?: boolean;
}

export function RosterWheel({
  rota,
  currentUser,
  onAck,
  isAckPending = false,
}: RosterWheelProps) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    memberCount,
    members,
    startedAt,
    periodSecs,
    cycles,
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

  // Member index on duty
  const dutyMemberIndex = isStarted && !isOver ? currentP % memberCount : 0;
  const angle = isStarted && !isOver
    ? armAngle(dutyMemberIndex, memberCount, periodInfo.progress)
    : 0;

  // Countdown timer
  let countdownText = "--:--:--";
  if (isStarted && !isOver) {
    const remainingSecs = Math.max(0, Number(periodInfo.endsAt) - nowSec);
    const hrs = Math.floor(remainingSecs / 3600);
    const mins = Math.floor((remainingSecs % 3600) / 60);
    const secs = remainingSecs % 60;
    countdownText = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Dial geometry
  const dialSize = 420;
  const center = dialSize / 2;
  const memberRadius = 140;
  const ticksRadius = 185;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
        <svg
          viewBox={`0 0 ${dialSize} ${dialSize}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Background radial glow */}
            <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FB5607" stopOpacity="0.1" />
              <stop offset="80%" stopColor="#1B1F3B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1B1F3B" stopOpacity="0.9" />
            </radialGradient>

            {/* Arm glow */}
            <filter id="armGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FB5607" />
            </filter>
          </defs>

          {/* Outer track */}
          <circle
            cx={center}
            cy={center}
            r={ticksRadius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Member track */}
          <circle
            cx={center}
            cy={center}
            r={memberRadius}
            fill="url(#wheelGlow)"
            stroke="var(--border-default)"
            strokeWidth="2"
          />

          {/* Period Ticks on outer ring */}
          {Array.from({ length: totalPeriods }).map((_, p) => {
            const tickAngle = ((p / totalPeriods) * 360 - 90) * (Math.PI / 180);
            const tx = center + ticksRadius * Math.cos(tickAngle);
            const ty = center + ticksRadius * Math.sin(tickAngle);
            const state = periodStates[p] ?? 0;
            const isPast = isStarted && p < currentP;
            const isCurrent = isStarted && p === currentP && !isOver;

            if (state === 1) {
              // Orange tick: acked
              return (
                <circle
                  key={`tick-${p}`}
                  cx={tx}
                  cy={ty}
                  r={5}
                  fill="var(--accent)"
                  stroke="#1B1F3B"
                  strokeWidth="2"
                />
              );
            }
            if (state === 2 || (isPast && state === 0)) {
              // Hollow notch: missed
              return (
                <circle
                  key={`tick-${p}`}
                  cx={tx}
                  cy={ty}
                  r={5}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
              );
            }
            if (isCurrent) {
              // Current active slot
              return (
                <circle
                  key={`tick-${p}`}
                  cx={tx}
                  cy={ty}
                  r={6}
                  fill="var(--text-primary)"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  className="animate-pulse"
                />
              );
            }
            // Future slot
            return (
              <circle
                key={`tick-${p}`}
                cx={tx}
                cy={ty}
                r={3}
                fill="var(--border-default)"
              />
            );
          })}

          {/* Indicator Sweep Arm */}
          {isStarted && !isOver && (
            <g
              transform={`rotate(${angle} ${center} ${center})`}
              className="transition-transform duration-1000 ease-linear"
              style={{
                transformOrigin: `${center}px ${center}px`,
              }}
            >
              {/* Pointer line */}
              <line
                x1={center}
                y1={center}
                x2={center}
                y2={center - memberRadius + 18}
                stroke="var(--accent)"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#armGlow)"
              />
              {/* Arm beacon head */}
              <circle
                cx={center}
                cy={center - memberRadius + 18}
                r={5}
                fill="var(--accent)"
              />
            </g>
          )}

          {/* Member Avatars around ring */}
          {members.map((m, idx) => {
            const mAngle = ((idx / memberCount) * 360 - 90) * (Math.PI / 180);
            const mx = center + memberRadius * Math.cos(mAngle);
            const my = center + memberRadius * Math.sin(mAngle);
            const isDuty = isStarted && !isOver && dutyMemberIndex === idx;
            const isUser = currentUser && m.toLowerCase() === currentUser.toLowerCase();
            const initials = m.slice(2, 6).toUpperCase();

            return (
              <g key={`member-${m}-${idx}`} className="select-none cursor-default">
                {/* Member Node Circle */}
                <circle
                  cx={mx}
                  cy={my}
                  r={22}
                  fill={isDuty ? "var(--bg-surface)" : "var(--bg-base)"}
                  stroke={isDuty ? "var(--accent)" : isUser ? "var(--success)" : "var(--border-default)"}
                  strokeWidth={isDuty ? 3 : 2}
                  filter={isDuty ? "url(#armGlow)" : undefined}
                />
                {/* Initials / 4 chars */}
                <text
                  x={mx}
                  y={my + 4}
                  textAnchor="middle"
                  fill={isDuty ? "var(--accent)" : "var(--text-primary)"}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {initials}
                </text>
              </g>
            );
          })}

          {/* Inner Hub Circle */}
          <circle
            cx={center}
            cy={center}
            r={88}
            fill="var(--bg-surface)"
            stroke="var(--border-default)"
            strokeWidth="2"
          />
        </svg>

        {/* Center Content overlay HTML */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
          <div className="pointer-events-auto flex flex-col items-center max-w-[160px]">
            {!isStarted ? (
              <>
                <span className="text-[11px] font-mono tracking-wider uppercase text-[var(--text-muted)]">
                  GATHERING
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                  {rota.joined} of {memberCount} joined
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                  {formatAddress(members[0])}
                </span>
              </>
            ) : isOver ? (
              <>
                <span className="text-[11px] font-mono tracking-wider uppercase text-[var(--success)]">
                  COMPLETED
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  All cycles done
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-1">
                  {totalPeriods} periods ended
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)]">
                  ON CALL
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                    {isUserOnDuty ? "YOU" : formatAddress(activeDutyMember)}
                  </span>
                  {isUserOnDuty && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping" />
                  )}
                </div>
                <div className="text-xs font-mono font-medium text-[var(--text-muted)] mt-1">
                  {countdownText}
                </div>

                <div className="mt-2.5">
                  {currentPeriodAcked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-base)] text-[var(--success)] border border-[var(--border-default)]">
                      <span>✓</span> Acknowledged
                    </span>
                  ) : isUserOnDuty ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={onAck}
                      loading={isAckPending}
                      className="shadow-lg shadow-[var(--accent)]/20"
                    >
                      I&apos;m on duty
                    </Button>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] italic">
                      Awaiting check-in
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
