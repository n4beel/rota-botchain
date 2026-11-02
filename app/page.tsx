"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import PageShell, { NavItem } from "@/components/layout/PageShell";
import { useRotasList } from "@/lib/useRota";
import { MiniDial } from "@/components/rota/MiniDial";
import { RotaNotice } from "@/components/rota/RotaNotice";
import { Button } from "@/components/ui/Button";

const nav: NavItem[] = [
  { href: "/", label: "Rotas" },
  { href: "/new", label: "New Rota" },
  { href: "/me", label: "My Duties" },
];

export default function HomePage() {
  const { address } = useAccount();
  const { rotas, userRotas, loading, error, refresh } = useRotasList(address);

  return (
    <PageShell
      nav={nav}
      title="Roster Wheels"
      description="Take turns being on call. Miss yours and it costs you."
    >
      <div className="flex flex-col gap-8">
        {/* Actions bar */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="text-xs font-mono text-[var(--text-muted)]">
            {loading
              ? "Scanning roster dials..."
              : `${rotas.length} total active rota${rotas.length === 1 ? "" : "s"}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refresh()}
              className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              ↻ Refresh
            </button>
            <Link href="/new">
              <Button size="sm">Create Rota</Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}

        {/* User Rotas section if connected and has rotas */}
        {address && userRotas.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-[var(--accent)]">
                Your Rotas ({userRotas.length})
              </h2>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Rosters you participate in
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userRotas.map((r) => (
                <MiniDial key={`user-rota-${r.id}`} rota={r} currentUser={address} />
              ))}
            </div>
          </div>
        )}

        {/* Public All Rotas */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-[var(--text-primary)]">
              All Roster Dials
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Live on Bohr network
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-32 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse"
                />
              ))}
            </div>
          ) : rotas.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-base)] flex items-center justify-center text-2xl text-[var(--accent)]">
                ◎
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                No active rotas yet
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm">
                Create a rotation with your team, stake bonds, and hold each other accountable on call.
              </p>
              <Link href="/new" className="mt-2">
                <Button>Create the first rota</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rotas.map((r) => (
                <MiniDial key={`public-rota-${r.id}`} rota={r} currentUser={address} />
              ))}
            </div>
          )}
        </div>

        {/* Limits notice placard */}
        <RotaNotice />
      </div>
    </PageShell>
  );
}
