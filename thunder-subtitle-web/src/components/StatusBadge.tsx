"use client";

import type { ReviewState } from "@/lib/types";

/**
 * Status label mapping for scan result statuses.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "downloaded":
      return "bg-green-500/15 text-green-400";
    case "skipped":
      return "bg-tertiary/15 text-tertiary";
    case "no_match":
      return "bg-on-surface-variant/15 text-on-surface-variant";
    default:
      return "bg-error/15 text-error";
  }
}

/**
 * Dry state label mapping for scan result dry_run states.
 */
export function getDryStateColor(dryState: string): string {
  switch (dryState) {
    case "need_download":
      return "bg-primary/15 text-primary";
    case "need_review":
      return "bg-tertiary/15 text-tertiary";
    case "reviewed_ok":
      return "bg-green-500/15 text-green-400";
    case "reviewed_fail":
      return "bg-error/15 text-error";
    case "reviewed_fail_new_subs":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-tertiary/15 text-tertiary";
  }
}

/**
 * Review status color mapping for verification subtitle list.
 */
export function getReviewStatusColor(status: ReviewState): string {
  switch (status) {
    case "ok":
      return "bg-green-500/15 text-green-400";
    case "fail":
      return "bg-error/15 text-error";
    case "not_reviewed":
    default:
      return "bg-on-surface-variant/15 text-on-surface-variant";
  }
}

interface StatusBadgeProps {
  status: string;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(status)}`}
    >
      {label}
    </span>
  );
}

interface DryStateBadgeProps {
  dryState: string;
  label: string;
}

export function DryStateBadge({ dryState, label }: DryStateBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${getDryStateColor(dryState)}`}
    >
      {label}
    </span>
  );
}
