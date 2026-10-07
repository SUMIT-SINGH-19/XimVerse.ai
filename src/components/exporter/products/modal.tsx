"use client";

import { useEffect, useRef } from "react";

/*
 * Modal surface built on the native <dialog>: showModal() gives focus
 * trapping, Escape to close and an inert background for free. Exporter-local
 * for now; promote to components/workspace/ once another role needs it.
 */

const VARIANTS = {
  /** Full-height panel from the right; full screen on phones. */
  drawer:
    "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-2xl sm:border-l sm:border-line",
  /** Centred card. */
  center: "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-2xl",
} as const;

export function Modal({
  open,
  onClose,
  labelledBy,
  variant = "center",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Id of the element that names the dialog. */
  labelledBy: string;
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    // The page behind shouldn't scroll while the dialog is up.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // A click whose target is the <dialog> itself landed on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`overflow-hidden bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] ${VARIANTS[variant]}`}
    >
      {open && <div className="flex h-full max-h-[inherit] flex-col">{children}</div>}
    </dialog>
  );
}
