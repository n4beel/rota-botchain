"use client";

import React from "react";
import Link from "next/link";
import type { Address } from "viem";
import { formatAddress, formatBot, formatPeriod, onDuty, periodAt, armAngle } from "@/lib/rota";
import type { FullRota } from "@/lib/useRota";

interface MiniDialProps {
  rota: FullRota;
  currentUser?: Address;
}

export function MiniDial({ rota, currentUser }: MiniDialProps) {
  const nowSec = Math.floor(Date.now() / 1000);
  const {
    id,
    name,
    memberCount,
    members,
    startedAt,
    periodSecs,
    cycles,
    bond,
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

  const dutyMemberIndex = isStarted && !isOver ? currentP % memberCount : 0;
  const angle = isStarted && !isOver
    ? armAngle(dutyMemberIndex, memberCount, periodInfo.progress)
    : 0;

  // SVG parameters
  const size = 110;
  const center = size / 2;
  const radius = 38;

  return (
    <Link
      href={`/rota/${id}`}
      className="group flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--accent)] transition-all hover:shadow-md hover:shadow-[var(--accent)]/5"
    >
      {/* Miniature Dial Wheel */}
      <div className="relative w-[110px] h-[110px] flex-shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {/* Ring Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="var(--bg-base)"
            stroke="var(--border-default)"
            strokeWidth="2"
          />

          {/* Member dots */}
          {members.map((m, idx) => {
            const mAngle = ((idx / memberCount) * 360 - 90) * (Math.PI / 180);
            const mx = center + radius * Math.cos(mAngle);
            const my = center + radius * Math.sin(mAngle);
            const isDuty = isStarted && !isOver && dutyMemberIndex === idx;

            return (
              <circle
                key={`mini-m-${idx}`}
                cx={mx}
                cy={my}
                r={isDuty ? 5 : 3.5}
                fill={isDuty ? "var(--accent)" : "var(--text-muted)"}
              />
            );
          })}

          {/* Arm line if active */}
          {isStarted && !isOver && (
            <g
              transform={`rotate(${angle} ${center} ${center})`}
              style={{ transformOrigin: `${center}px ${center}px` }}
            >
              <line
                x1={center}
                y1={center}
                x2={center}
                y2={center - radius + 6}
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Center Hub */}
          <circle
            cx={center}
            cy={center}
            r={16}
            fill="var(--bg-surface)"
            stroke="var(--border-subtle)"
            strokeWidth="1.5"
          />
          <text
            x={center}
            y={center + 3}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            #{String(id)}
          </text>
        </svg>
      </div>

      {/* Info column */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-base text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
            {name}
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${
              !isStarted
                ? "bg-[var(--bg-base)] text-[var(--warning)] border-[var(--warning)]/30"
                : isOver
                ? "bg-[var(--bg-base)] text-[var(--success)] border-[var(--success)]/30"
                : isUserOnDuty
                ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] font-bold animate-pulse"
                : "bg-[var(--bg-base)] text-[var(--text-muted)] border-[var(--border-default)]"
            }`}
          >
            {!isStarted
              ? "Gathering"
              : isOver
              ? "Completed"
              : isUserOnDuty
              ? "Your Duty!"
              : "Running"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
          <span>{memberCount} members</span>
          <span>•</span>
          <span>{formatPeriod(periodSecs)} periods</span>
          <span>•</span>
          <span>{formatBot(bond)} BOT bond</span>
        </div>

        <div className="text-xs font-mono text-[var(--text-muted)] mt-1 flex items-center justify-between">
          {!isStarted ? (
            <span>{rota.joined} of {memberCount} joined</span>
          ) : isOver ? (
            <span className="text-[var(--success)]">All cycles finished</span>
          ) : (
            <span>
              On duty:{" "}
              <strong className="text-[var(--text-primary)] font-semibold">
                {isUserOnDuty ? "YOU" : formatAddress(activeDutyMember)}
              </strong>
            </span>
          )}
          <span className="text-[var(--accent)] group-hover:translate-x-0.5 transition-transform text-sm">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
