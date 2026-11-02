"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import PageShell, { NavItem } from "@/components/layout/PageShell";
import { useRotaActions } from "@/lib/useRota";
import {
  MIN_MEMBERS,
  MAX_MEMBERS,
  MIN_PERIOD,
  MAX_PERIOD,
  MIN_CYCLES,
  MAX_CYCLES,
  MAX_NAME_BYTES,
} from "@/lib/limits";
import { parseNativeAmount } from "@/lib/botchain/amount";
import { Button } from "@/components/ui/Button";

const nav: NavItem[] = [
  { href: "/", label: "Rotas" },
  { href: "/new", label: "New Rota" },
  { href: "/me", label: "My Duties" },
];

const PERIOD_PRESETS = [
  { label: "1 hour", seconds: 3600 },
  { label: "6 hours", seconds: 21600 },
  { label: "12 hours", seconds: 43200 },
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
];

export default function NewRotaPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { createRota, isPending, txError, clearTxError } = useRotaActions();

  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [periodSecs, setPeriodSecs] = useState<number>(3600);
  const [cycles, setCycles] = useState<number>(2);
  const [bondInput, setBondInput] = useState("1.0");
  const [penaltyInput, setPenaltyInput] = useState("0.2");
  const [formError, setFormError] = useState<string | null>(null);

  const handleMemberChange = (index: number, val: string) => {
    const updated = [...members];
    updated[index] = val.trim();
    setMembers(updated);
  };

  const handleAddMember = () => {
    if (members.length < MAX_MEMBERS) {
      setMembers([...members, ""]);
    }
  };

  const handleRemoveMember = (index: number) => {
    if (members.length > MIN_MEMBERS) {
      const updated = members.filter((_, i) => i !== index);
      setMembers(updated);
    }
  };

  const handleAddMe = () => {
    if (!address) return;
    const lower = address.toLowerCase();
    const existingIdx = members.findIndex((m) => m.toLowerCase() === lower);
    if (existingIdx !== -1) return;

    // Fill first empty slot or append
    const emptyIdx = members.findIndex((m) => !m);
    if (emptyIdx !== -1) {
      const updated = [...members];
      updated[emptyIdx] = address;
      setMembers(updated);
    } else if (members.length < MAX_MEMBERS) {
      setMembers([...members, address]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearTxError();

    const trimmedName = name.trim();
    const nameBytes = new TextEncoder().encode(trimmedName).length;
    if (nameBytes === 0) {
      setFormError("Rota name is required.");
      return;
    }
    if (nameBytes > MAX_NAME_BYTES) {
      setFormError(`Name cannot exceed ${MAX_NAME_BYTES} bytes (${nameBytes} bytes provided).`);
      return;
    }

    // Validate members
    const cleanMembers = members.map((m) => m.trim());
    if (cleanMembers.length < MIN_MEMBERS || cleanMembers.length > MAX_MEMBERS) {
      setFormError(`Rota requires between ${MIN_MEMBERS} and ${MAX_MEMBERS} members.`);
      return;
    }

    const memberSet = new Set<string>();
    for (let i = 0; i < cleanMembers.length; i++) {
      const m = cleanMembers[i];
      if (!/^0x[a-fA-F0-9]{40}$/.test(m)) {
        setFormError(`Member #${i + 1} is not a valid 40-character hex address.`);
        return;
      }
      if (m === "0x0000000000000000000000000000000000000000") {
        setFormError(`Member #${i + 1} cannot be the zero address.`);
        return;
      }
      const lower = m.toLowerCase();
      if (memberSet.has(lower)) {
        setFormError(`Member #${i + 1} is duplicated in the roster.`);
        return;
      }
      memberSet.add(lower);
    }

    // Validate period & cycles
    if (periodSecs < MIN_PERIOD || periodSecs > MAX_PERIOD) {
      setFormError(`Period must be between 1 hour (${MIN_PERIOD}s) and 30 days (${MAX_PERIOD}s).`);
      return;
    }
    if (cycles < MIN_CYCLES || cycles > MAX_CYCLES) {
      setFormError(`Cycles must be between ${MIN_CYCLES} and ${MAX_CYCLES}.`);
      return;
    }

    // Parse bond & penalty
    const bondWei = parseNativeAmount(bondInput);
    if (!bondWei || bondWei <= 0n) {
      setFormError("Invalid bond amount: enter a positive number of BOT.");
      return;
    }

    const penaltyWei = parseNativeAmount(penaltyInput);
    if (!penaltyWei || penaltyWei <= 0n) {
      setFormError("Invalid penalty amount: enter a positive number of BOT.");
      return;
    }
    if (penaltyWei > bondWei) {
      setFormError("Penalty cannot exceed the total bond stake.");
      return;
    }

    try {
      await createRota(
        trimmedName,
        cleanMembers as Address[],
        periodSecs,
        cycles,
        bondWei,
        penaltyWei
      );
      router.push("/");
    } catch {
      // txError handled in hook
    }
  };

  return (
    <PageShell
      nav={nav}
      title="Create Rota"
      description="Design a shared duty roster, stake bonds, and configure missed-call penalties."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl mx-auto">
        {(formError || txError) && (
          <div className="p-4 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)] text-[var(--danger)] text-sm">
            {formError || txError}
          </div>
        )}

        {/* Section 1: Rota Name */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
            Rota Name (Max {MAX_NAME_BYTES} bytes)
          </label>
          <input
            type="text"
            required
            maxLength={MAX_NAME_BYTES}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Primary Incident Response"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Section 2: Members list */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Roster Members ({members.length}/{MAX_MEMBERS})
              </label>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Roster order dictates the exact duty sequence.
              </div>
            </div>
            {address && (
              <button
                type="button"
                onClick={handleAddMe}
                className="text-xs font-mono px-2.5 py-1 rounded bg-[var(--bg-base)] text-[var(--accent)] border border-[var(--accent)]/40 hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] transition-colors"
              >
                + Add Me
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {members.map((member, idx) => (
              <div key={`member-slot-${idx}`} className="flex items-center gap-2">
                <span className="w-7 text-xs font-mono text-[var(--text-muted)] text-right">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  required
                  value={member}
                  onChange={(e) => handleMemberChange(idx, e.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
                {members.length > MIN_MEMBERS && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(idx)}
                    className="px-2 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded font-mono"
                    title="Remove member"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {members.length < MAX_MEMBERS && (
            <button
              type="button"
              onClick={handleAddMember}
              className="mt-1 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] self-start transition-colors"
            >
              + Add another member
            </button>
          )}
        </div>

        {/* Section 3: Period and Cycles */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col gap-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Duty Period Duration
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={`preset-${preset.seconds}`}
                  onClick={() => setPeriodSecs(preset.seconds)}
                  className={`py-2 px-1 text-center rounded-lg text-xs font-mono border transition-all ${
                    periodSecs === preset.seconds
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] font-bold"
                      : "bg-[var(--bg-base)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Rotation Cycles ({cycles} cycle{cycles === 1 ? "" : "s"})
              </label>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                Total: {members.length * cycles} duty periods
              </span>
            </div>
            <input
              type="number"
              step="1"
              min={MIN_CYCLES}
              max={MAX_CYCLES}
              value={cycles}
              onChange={(e) => setCycles(parseInt(e.target.value) || MIN_CYCLES)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Section 4: Bond & Penalty */}
        <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Member Bond Stake (BOT)
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={bondInput}
                onChange={(e) => setBondInput(e.target.value)}
                placeholder="1.0"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Required deposit per participant
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Missed Duty Penalty (BOT)
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={penaltyInput}
                onChange={(e) => setPenaltyInput(e.target.value)}
                placeholder="0.2"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Deducted on unacknowledged turn
              </span>
            </div>
          </div>

          {/* Consequence sentence */}
          <div className="p-3.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] leading-relaxed">
            <strong className="text-[var(--text-primary)]">Consequence:</strong> Each member stakes{" "}
            <span className="text-[var(--accent)] font-mono font-semibold">{bondInput || "0"} BOT</span>. If you miss your call,{" "}
            <span className="text-[var(--danger)] font-mono font-semibold">{penaltyInput || "0"} BOT</span> is deducted from your bond and sent to the next member on duty.
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            size="lg"
            loading={isPending}
            disabled={isPending}
          >
            Create Roster Wheel
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
