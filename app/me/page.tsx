"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import PageShell, { NavItem } from "@/components/layout/PageShell";
import { useRotasList, useUserPending, useRotaActions } from "@/lib/useRota";
import { formatAddress, formatBot, formatPeriod, onDuty, periodAt, upcomingDuties } from "@/lib/rota";
import { Button } from "@/components/ui/Button";

const nav: NavItem[] = [
  { href: "/", label: "Rotas" },
  { href: "/new", label: "New Rota" },
  { href: "/me", label: "My Duties" },
];

export default function MyDutiesPage() {
  const { address, isConnected } = useAccount();
  const { userRotas, loading: rotasLoading, refresh: refreshRotas } = useRotasList(address);
  const { pending, loading: pendingLoading, refresh: refreshPending } = useUserPending(address);
  const { withdrawPending, isPending, txError, clearTxError } = useRotaActions();

  const nowSec = Math.floor(Date.now() / 1000);

  const handleWithdraw = async () => {
    clearTxError();
    try {
      await withdrawPending();
      refreshPending();
    } catch {}
  };

  if (!isConnected || !address) {
    return (
      <PageShell
        nav={nav}
        title="My Duties & Balances"
        description="Track your locked bonds, duty commitments, and claim accrued earnings."
      >
        <div className="p-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-base)] flex items-center justify-center text-xl text-[var(--accent)] font-mono">
            ?
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Connect your wallet
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            Connect a wallet to view your scheduled on-call duty slots, locked bond deposits, and pending payout balance.
          </p>
        </div>
      </PageShell>
    );
  }

  // Calculate total locked bonds across user's rotas
  let totalBondLocked = 0n;
  const userUpcomingSlots: {
    rotaId: bigint;
    rotaName: string;
    p: number;
    cycle: number;
    startsAt: bigint;
    endsAt: bigint;
  }[] = [];

  userRotas.forEach((r) => {
    const isStarted = r.startedAt > 0n;
    const totalPeriods = r.memberCount * r.cycles;
    const periodInfo = periodAt(r.startedAt, r.periodSecs, nowSec);
    const currentP = isStarted ? periodInfo.p : 0;
    const isOver = isStarted && currentP >= totalPeriods;

    if (r.userJoined && !r.userExited) {
      totalBondLocked += r.bond;
    }

    if (isStarted && !isOver) {
      // Check upcoming duties
      const slots = upcomingDuties(r.members, r.startedAt, r.periodSecs, totalPeriods, currentP, 8);
      slots.forEach((s) => {
        if (s.member.toLowerCase() === address.toLowerCase()) {
          userUpcomingSlots.push({
            rotaId: r.id,
            rotaName: r.name,
            p: s.p,
            cycle: s.cycle,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          });
        }
      });
    }
  });

  // Sort upcoming duties by startsAt
  userUpcomingSlots.sort((a, b) => Number(a.startsAt - b.startsAt));

  const hasPending = pending !== null && pending > 0n;

  return (
    <PageShell
      nav={nav}
      title="My Duties & Balances"
      description={`Account: ${formatAddress(address)}`}
    >
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        {txError && (
          <div className="p-4 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)] text-[var(--danger)] text-sm">
            {txError}
          </div>
        )}

        {/* Balance & Payout Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pending Claimable */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Claimable Pending Balance
              </span>
              <div className="text-2xl font-extrabold font-mono text-[var(--accent)] mt-1">
                {pendingLoading ? "..." : pending !== null ? `${formatBot(pending)} BOT` : "0 BOT"}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                From exited bonds and earned missed-duty penalties
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={!hasPending || isPending}
              loading={isPending}
              onClick={handleWithdraw}
            >
              Withdraw to Wallet
            </Button>
          </div>

          {/* Locked in active rotas */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Active Staked Bonds
              </span>
              <div className="text-2xl font-extrabold font-mono text-[var(--text-primary)] mt-1">
                {rotasLoading ? "..." : `${formatBot(totalBondLocked)} BOT`}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                Locked in {userRotas.length} active roster{userRotas.length === 1 ? "" : "s"}
              </div>
            </div>

            <Link href="/" className="w-full">
              <Button variant="secondary" size="md" className="w-full">
                View Rotas
              </Button>
            </Link>
          </div>
        </div>

        {/* Upcoming Duties Schedule */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
              Your Upcoming Duty Slots ({userUpcomingSlots.length})
            </h3>
            <button
              onClick={() => {
                refreshRotas();
                refreshPending();
              }}
              className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ↻ Refresh
            </button>
          </div>

          {rotasLoading ? (
            <div className="text-xs font-mono text-[var(--text-muted)] italic py-2">
              Loading scheduled duty slots...
            </div>
          ) : userUpcomingSlots.length === 0 ? (
            <div className="text-xs font-mono text-[var(--text-muted)] italic py-2">
              No upcoming duty periods scheduled in your active rotas.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {userUpcomingSlots.map((slot, idx) => {
                const startsInMinutes = Math.max(
                  0,
                  Math.round((Number(slot.startsAt) - nowSec) / 60)
                );

                return (
                  <Link
                    key={`slot-${slot.rotaId}-${slot.p}-${idx}`}
                    href={`/rota/${slot.rotaId}`}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                          {slot.rotaName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                          Period #{slot.p + 1}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-[var(--text-muted)] mt-1">
                        Cycle {slot.cycle} • Starts {new Date(Number(slot.startsAt) * 1000).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[var(--accent)]">
                        In ~{startsInMinutes > 60 ? `${Math.round(startsInMinutes / 60)}h` : `${startsInMinutes}m`}
                      </span>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        Be on call →
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
