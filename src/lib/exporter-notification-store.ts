"use client";

/*
 * Notification interaction state only:
 *
 *   ximverse:exporter:notifications  { v: 1, read: { [id]: fingerprint }, dismissed: { [id]: fingerprint } }
 *
 * No notification content is stored — signals are rebuilt from their
 * canonical sources on every render. A stale entry for a signal that no
 * longer exists is inert: it can't recreate the signal, and a changed
 * fingerprint makes it unread again.
 */

import { useMemo, useSyncExternalStore } from "react";
import type { InteractionState, NotificationSignal } from "./exporter-notifications";

export const NOTIFICATIONS_KEY = "ximverse:exporter:notifications";
const CHANGE_EVENT = "ximverse:exporter:notifications-change";
const EMPTY = { v: 1 as const, read: {}, dismissed: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(NOTIFICATIONS_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): InteractionState & { v: 1 } {
  if (!raw) return EMPTY;
  try {
    const d = JSON.parse(raw);
    return d && d.v === 1 ? { ...EMPTY, ...d } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: InteractionState): void {
  try {
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ v: 1, ...next }));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable: interaction state just isn't remembered.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useNotificationState(): InteractionState {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

export function markRead(signals: readonly Pick<NotificationSignal, "id" | "fingerprint">[]): void {
  const s = parse(readRaw());
  commit({ read: { ...s.read, ...Object.fromEntries(signals.map((x) => [x.id, x.fingerprint])) }, dismissed: s.dismissed });
}

export function markUnread(id: string): void {
  const s = parse(readRaw());
  const read = { ...s.read };
  delete read[id];
  commit({ read, dismissed: s.dismissed });
}

/** Informational notices only — action items stay until their source resolves. */
export function dismiss(signal: Pick<NotificationSignal, "id" | "fingerprint" | "dismissible">): boolean {
  if (!signal.dismissible) return false;
  const s = parse(readRaw());
  commit({ read: s.read, dismissed: { ...s.dismissed, [signal.id]: signal.fingerprint } });
  return true;
}
