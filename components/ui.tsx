"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, X } from "lucide-react";

export type Toast = { id: number; text: string; tone: "ok" | "err" };

/** Toasts sit above the bottom nav and clear of the iPhone home indicator. */
export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-md flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            onClick={() => onDismiss(t.id)}
            className={`pointer-events-auto w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold shadow-lg ${
              t.tone === "err" ? "bg-red-600 text-white" : "bg-slate-900 text-white"
            }`}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Bottom sheet on mobile, centred dialog from `sm` up. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Đóng"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type ConfirmState = { title: string; body: string; confirmLabel: string; onConfirm: () => void } | null;

export function ConfirmDialog({ state, busy, onClose }: { state: ConfirmState; busy: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!state} title={state?.title ?? ""} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-600">{state?.body}</p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          className="min-h-[44px] flex-1 rounded-2xl bg-slate-100 px-4 font-bold text-slate-700"
        >
          Hủy
        </button>
        <button
          disabled={busy}
          onClick={() => state?.onConfirm()}
          className="min-h-[44px] flex-1 rounded-2xl bg-red-600 px-4 font-bold text-white disabled:opacity-60"
        >
          {busy ? "Đang xóa..." : state?.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

/** Shared empty-state block: icon, message, optional call to action. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-7 text-center">
      <div className="mx-auto mb-2.5 grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>
      <p className="font-bold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />;
}

export type MenuItem = { label: string; icon?: React.ReactNode; danger?: boolean; onSelect: () => void };

/** Overflow menu for row actions, so destructive ones sit one tap away
 *  instead of competing with the card's primary buttons. */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => { setOpen(false); it.onSelect(); }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-slate-50 ${it.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
