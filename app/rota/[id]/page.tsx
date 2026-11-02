"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useAccount } from "wagmi";
import PageShell, { NavItem } from "@/components/layout/PageShell";
import { useRota, useRotaActions } from "@/lib/useRota";
import { RosterWheel } from "@/components/rota/RosterWheel";
import { MobileRoster } from "@/components/rota/MobileRoster";
import { LedgerStrip } from "@/components/rota/LedgerStrip";
import { RotaNotice } from "@/components/rota/RotaNotice";
import {
  formatAddress,
  formatBot,
  formatPeriod,
  onDuty,
  periodAt,
  settleablePeriods,
} from "@/lib/rota";
import { JOIN_WINDOW } from "@/lib/limits";
import { Button } from "@/components/ui/Button";

const nav: NavItem[] = [
  { href: "/", label: "Rotas" },
  { href: "/new", label: "New Rota" },
  { href: "/me", label: "My Duties" },
];

export default function RotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const rotaId = BigInt(resolvedParams.id || "0");

  const { address } = useAccount();
  const { rota, loading, error, refresh } = useRota(rotaId > 0n ? rotaId : null);
  const {
    joinRota,
    ackDuty,
    settlePeriod,
    exitRota,
    isPending,
    txError,
    clearTxError,
  } = useRotaActions();

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [activeSettleP, setActiveSettleP] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!loading && (!rota || rotaId <= 0n)) {
    if (error && error.includes("NotFound")) {
      notFound();
    }
  }

  if (loading || !rota) {
    return (
      <PageShell nav={nav}>
        <div className="flex flex-col items-center justify-center min-h-[360px] gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-mono text-[var(--text-muted)]">
            Loading roster dial #{String(rotaId)}...
          </div>
        </div>
      </PageShell>
    );
  }

  const {
    name,
    members,
    memberCount,
    startedAt,
    createdAt,
    periodSecs,
    cycles,
    bond,
    penalty,
    periodStates,
    userJoined,
    userExited,
  } = rota;

  const isStarted = startedAt > 0n;
  const totalPeriods = memberCount * cycles;
  const periodInfo = periodAt(startedAt, periodSecs, nowSec);
  const currentP = isStarted ? periodInfo.p : 0;
  const isAllOver = isStarted && currentP >= totalPeriods;

  const isUserNominated = Boolean(
    address && members.some((m) => m.toLowerCase() === address.toLowerCase())
  );

  // Join window expiry for unstarted rotas
  const joinDeadline = Number(createdAt) + JOIN_WINDOW;
  const isJoinWindowExpired = !isStarted && nowSec >= joinDeadline;

  // Unsettled missed periods
  const pastUnsettled = isStarted
    ? settleablePeriods(totalPeriods, currentP, periodStates)
    : [];

  // Handlers
  const handleJoin = async () => {
    clearTxError();
    try {
      await joinRota(rotaId, bond);
      refresh();
    } catch {}
  };

  const handleAck = async () => {
    clearTxError();
    try {
      await ackDuty(rotaId);
      refresh();
    } catch {}
  };

  const handleSettle = async (p: number) => {
    clearTxError();
    setActiveSettleP(p);
    try {
      await settlePeriod(rotaId, p);
      refresh();
    } catch {} finally {
      setActiveSettleP(null);
    }
  };

  const handleExit = async () => {
    clearTxError();
    try {
      await exitRota(rotaId);
      refresh();
    } catch {}
  };

  return (
    <PageShell
      nav={nav}
      title={name}
      description={`Roster #${String(rotaId)} • ${memberCount} members • ${formatPeriod(periodSecs)} periods • ${cycles} cycle${cycles === 1 ? "" : "s"}`}
    >
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {txError && (
          <div className="p-4 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)] text-[var(--danger)] text-sm">
            {txError}
          </div>
        )}

        {/* State Banners */}
        {!isStarted && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--warning)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-ping" />
                <h4 className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  Gathering Members ({rota.joined} of {memberCount} joined)
                </h4>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                {isJoinWindowExpired
                  ? "Join window expired (7 days passed). Rota will not start."
                  : `Join deadline: ${new Date(joinDeadline * 1000).toLocaleString()}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isJoinWindowExpired && isUserNominated && !userJoined && (
                <Button
                  variant="primary"
                  onClick={handleJoin}
                  loading={isPending}
                >
                  Join Rota (Stake {formatBot(bond)} BOT)
                </Button>
              )}
              {userJoined && !isJoinWindowExpired && (
                <span className="text-xs font-mono text-[var(--success)] font-medium px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                  ✓ Joined & Staked
                </span>
              )}
              {isJoinWindowExpired && userJoined && !userExited && (
                <Button
                  variant="secondary"
                  onClick={handleExit}
                  loading={isPending}
                >
                  Exit & Reclaim {formatBot(bond)} BOT
                </Button>
              )}
            </div>
          </div>
        )}

        {isAllOver && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--success)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold font-mono text-[var(--success)]">
                Rotation Completed ({totalPeriods} of {totalPeriods} periods ended)
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {pastUnsettled.length > 0
                  ? `Settle the remaining ${pastUnsettled.length} missed period(s) to unlock member exits.`
                  : "All cycles finished and all periods settled. Members can now exit to claim remaining bonds."}
              </p>
            </div>

            {pastUnsettled.length === 0 && isUserNominated && userJoined && !userExited && (
              <Button
                variant="primary"
                onClick={handleExit}
                loading={isPending}
              >
                Exit Rota & Claim Bond
              </Button>
            )}

            {userExited && (
              <span className="text-xs font-mono text-[var(--success)] px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                ✓ Exited (Balance sent to pending)
              </span>
            )}
          </div>
        )}

        {/* Missed Unsettled Periods Warning & Action Strip */}
        {pastUnsettled.length > 0 && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent)]/40 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span className="text-xs font-mono font-bold uppercase text-[var(--accent)]">
                  Unsettled Missed Duty ({pastUnsettled.length})
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Anyone can settle to transfer penalty
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {pastUnsettled.map((p) => {
                const missedMember = onDuty(members, p);
                const nextMember = onDuty(members, p + 1);

                return (
                  <div
                    key={`settle-row-${p}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]"
                  >
                    <div className="text-xs font-mono">
                      <span className="font-bold text-[var(--text-primary)]">
                        Period #{p + 1}:
                      </span>{" "}
                      <span className="text-[var(--danger)]">
                        {formatAddress(missedMember)}
                      </span>{" "}
                      missed call →{" "}
                      <span className="text-[var(--success)]">
                        {formatAddress(nextMember)}
                      </span>{" "}
                      receives {formatBot(penalty)} BOT
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSettle(p)}
                      loading={isPending && activeSettleP === p}
                    >
                      Settle Period #{p + 1}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* The Roster Dial (Desktop / Tablet) */}
        <div className="hidden sm:block">
          <RosterWheel
            rota={rota}
            currentUser={address}
            onAck={handleAck}
            isAckPending={isPending}
          />
        </div>

        {/* Vertical Roster Alternative for Mobile under 600px */}
        <div className="block sm:hidden">
          <MobileRoster
            rota={rota}
            currentUser={address}
            onAck={handleAck}
            isAckPending={isPending}
          />
        </div>

        {/* Ledger Strip below dial */}
        <LedgerStrip rota={rota} currentUser={address} />

        {/* Limits notice placard */}
        <RotaNotice />
      </div>
    </PageShell>
  );
}
