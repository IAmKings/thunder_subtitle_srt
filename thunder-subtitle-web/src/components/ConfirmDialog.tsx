"use client";

import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loadingLabel?: string;
  onConfirm: () => void;
  variant?: "danger" | "default";
  isLoading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  loadingLabel = "Loading...",
  onConfirm,
  variant = "default",
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "rounded-lg bg-error px-4 py-2 text-xs font-bold text-on-primary transition-all hover:brightness-110 disabled:opacity-50"
      : "rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl bg-surface-container-high p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <h3 className="text-lg font-bold">{title}</h3>
        {message && (
          <p className="mt-2 text-sm text-on-surface-variant">{message}</p>
        )}
        {children && <div className="mt-2">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-outline px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high disabled:opacity-50"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmButtonClass}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
