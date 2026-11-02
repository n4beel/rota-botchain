"use client";

import React from "react";

export function RotaNotice() {
  return (
    <div className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] font-mono text-base flex-shrink-0">
          ⚠️
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] font-mono">
            What a check-in can&apos;t prove
          </h4>
          <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc list-inside">
            <li>
              <strong className="text-[var(--text-primary)]">
                Acknowledging is not the same as doing the work.
              </strong>{" "}
              The contract verifies that you showed up and signed on-chain during your period window, not the quality of your operational response.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">
                The penalty goes to the next person on the roster.
              </strong>{" "}
              If you miss your call, your deducted penalty is transferred directly to the next person taking over duty.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">
                Members and order are fixed. Only join people you trust.
              </strong>{" "}
              The roster order, cycle length, and bonds cannot be modified once set. All participants must stake the full bond before the rotation begins.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
