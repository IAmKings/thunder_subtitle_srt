"use client";

import { Trash2, XCircle } from "lucide-react";

interface VerificationFilterBarProps {
  sortBySize: null | "desc" | "asc";
  setSortBySize: (v: null | "desc" | "asc") => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  setListPage: (v: number | ((prev: number) => number)) => void;
  okCount: number;
  failCount: number;
  unreviewedCount: number;
  visibleItemsCount: number;
  t: (key: string) => string;
}

export function VerificationFilterBar({
  sortBySize,
  setSortBySize,
  statusFilter,
  setStatusFilter,
  setListPage,
  okCount,
  failCount,
  unreviewedCount,
  visibleItemsCount,
  t,
}: VerificationFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => { setSortBySize(sortBySize === null ? "desc" : sortBySize === "desc" ? "asc" : null); setListPage(0); }}
        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
          sortBySize !== null ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-outline-variant"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {t("size")}{sortBySize === "desc" ? " \u2193" : sortBySize === "asc" ? " \u2191" : ""}
      </button>
      <div className="flex flex-wrap gap-1 text-[10px] font-bold">
        <button
          type="button"
          onClick={() => { setStatusFilter(null); setListPage(0); }}
          className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === null ? "bg-primary text-on-primary" : "bg-on-surface-variant/15 text-on-surface-variant"}`}
        >
          {t("all_status")} {visibleItemsCount}
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter(statusFilter === "not_reviewed" ? null : "not_reviewed"); setListPage(0); }}
          className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "not_reviewed" ? "bg-primary text-on-primary" : "bg-on-surface-variant/15 text-on-surface-variant"}`}
        >
          {t("untagged")} {unreviewedCount}
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter(statusFilter === "ok" ? null : "ok"); setListPage(0); }}
          className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "ok" ? "bg-green-500 text-on-primary" : "bg-green-500/15 text-green-400"}`}
        >
          {"\u2713"} {okCount}
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter(statusFilter === "fail" ? null : "fail"); setListPage(0); }}
          className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "fail" ? "bg-error text-on-primary" : "bg-error/15 text-error"}`}
        >
          {"\u2717"} {failCount}
        </button>
      </div>
    </div>
  );
}

interface BatchActionBarProps {
  pinnedCount: number;
  setConfirmKeepOnly: (v: boolean) => void;
  isKeepingOnly: boolean;
  setConfirmDeleteAll: (v: boolean) => void;
  setConfirmMarkAllFail: (v: boolean) => void;
  t: (key: string) => string;
}

export function BatchActionBar({
  pinnedCount,
  setConfirmKeepOnly,
  isKeepingOnly,
  setConfirmDeleteAll,
  setConfirmMarkAllFail,
  t,
}: BatchActionBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
      {pinnedCount > 0 && (
        <button
          type="button"
          onClick={() => setConfirmKeepOnly(true)}
          disabled={isKeepingOnly}
          className="flex items-center gap-1.5 rounded-lg bg-error/15 px-3 py-1.5 text-[10px] font-bold text-error transition-all hover:bg-error/25 active:scale-95 disabled:opacity-50"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Trash2 size={12} /> {t("delete_unselected")}
        </button>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setConfirmMarkAllFail(true)}
        className="flex items-center gap-1.5 rounded-lg bg-tertiary/15 px-3 py-1.5 text-[10px] font-bold text-tertiary transition-all hover:bg-tertiary/25 active:scale-95"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <XCircle size={12} /> {t("mark_all_fail")}
      </button>
      <button
        type="button"
        onClick={() => setConfirmDeleteAll(true)}
        className="flex items-center gap-1.5 rounded-lg bg-error/10 px-3 py-1.5 text-[10px] font-bold text-error transition-all hover:bg-error/20 active:scale-95 disabled:opacity-50"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <Trash2 size={12} /> {t("delete_all")}
      </button>
    </div>
  );
}
