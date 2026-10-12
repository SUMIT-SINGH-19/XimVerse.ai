"use client";

/*
 * Communication state created in this browser.
 *
 *   ximverse:exporter:communications
 *   { v: 1, created: Thread[], appended: { [threadId]: Message[] }, read: { [threadId]: ISO } }
 *
 * Messages are canonical here and append-only: nothing is edited or deleted,
 * resolving or reopening is itself a message. Seeded threads are combined at
 * read time, never copied in. Nothing is sent anywhere — "Send" stores the
 * message locally for the demo.
 */

import { useMemo, useSyncExternalStore } from "react";
import { negotiationNow } from "./exporter-negotiations";
import { nextThreadId, SEEDED_THREADS, threadState, type EntityRef, type Message, type MessageType, type Role, type SubjectType, type Thread } from "./exporter-communications";

export const COMMUNICATIONS_KEY = "ximverse:exporter:communications";
const CHANGE_EVENT = "ximverse:exporter:communications-change";

interface StoredState {
  v: 1;
  created: Thread[];
  appended: Record<string, Message[]>;
  read: Record<string, string>;
}

const EMPTY: StoredState = { v: 1, created: [], appended: {}, read: {} };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(COMMUNICATIONS_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): StoredState {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw);
    return data && data.v === 1 ? { ...EMPTY, ...data } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: StoredState): boolean {
  try {
    window.localStorage.setItem(COMMUNICATIONS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
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

function combine(s: StoredState): Thread[] {
  const seeded = new Set(SEEDED_THREADS.map((t) => t.id));
  return [...SEEDED_THREADS, ...s.created.filter((t) => !seeded.has(t.id))].map((t) => ({ ...t, messages: [...t.messages, ...(s.appended[t.id] ?? [])] }));
}

export interface Communications {
  threads: Thread[];
  /** The exporter's read position per thread. */
  read: Record<string, string>;
}

/** All threads and read positions, live. Server render and hydration see the seeds only. */
export function useCommunications(): Communications {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    const s = parse(raw);
    return { threads: combine(s), read: s.read };
  }, [raw]);
}

export type CommResult = { ok: true; id?: string } | { ok: false; reason: string };
const fail = (reason: string): CommResult => ({ ok: false, reason });

function append(threadId: string, m: Omit<Message, "id" | "threadId" | "at" | "demo">): CommResult {
  const s = parse(readRaw());
  const t = combine(s).find((x) => x.id === threadId);
  if (!t) return fail("Thread not found");
  if (!m.body.trim()) return fail("Write a message first");
  const at = negotiationNow();
  const next: Message = { ...m, body: m.body.trim(), id: `${threadId}-m${t.messages.length + 1}`, threadId, at, demo: true };
  // The exporter has read everything up to its own message.
  return commit({ ...s, appended: { ...s.appended, [threadId]: [...(s.appended[threadId] ?? []), next] }, read: { ...s.read, [threadId]: at } }) ? { ok: true, id: next.id } : fail("Couldn't save — browser storage unavailable");
}

export function sendReply(threadId: string, body: string): CommResult {
  return append(threadId, { sender: "exporter", type: "text", body, visibility: "participants" });
}

/** PRIVATE — visible only to the exporter's team; excluded from every external projection. */
export function addInternalNote(threadId: string, body: string): CommResult {
  return append(threadId, { sender: "team", type: "text", body, visibility: "exporter-internal" });
}

/** Communication state only — never changes the underlying order, shipment or document. */
export function markResolved(threadId: string, note?: string): CommResult {
  const s = parse(readRaw());
  const t = combine(s).find((x) => x.id === threadId);
  if (!t) return fail("Thread not found");
  if (threadState(t, s.read[threadId]).status === "resolved") return fail("Already resolved");
  return append(threadId, { sender: "exporter", type: "resolution", body: note?.trim() || "Marked resolved.", visibility: "participants" });
}

export function reopenThread(threadId: string): CommResult {
  const s = parse(readRaw());
  const t = combine(s).find((x) => x.id === threadId);
  if (!t) return fail("Thread not found");
  if (threadState(t, s.read[threadId]).status !== "resolved") return fail("Thread is not resolved");
  return append(threadId, { sender: "exporter", type: "reopened", body: "Reopened.", visibility: "participants" });
}

/** Marks every visible external message up to now as read. */
export function markRead(threadId: string, upTo: string): void {
  const s = parse(readRaw());
  if ((s.read[threadId] ?? "") >= upTo) return;
  commit({ ...s, read: { ...s.read, [threadId]: upTo } });
}

export interface NewThread {
  subjectType: SubjectType;
  subjectId: string;
  refs: EntityRef[];
  topic: string;
  /** Ximverse for a query, or your team for an internal discussion. */
  with: Extract<Role, "ximverse" | "team">;
  body: string;
  type?: MessageType;
}

/** Scoped creation only: a transaction-linked query to Ximverse, or an internal discussion. */
export function createThread(n: NewThread): CommResult {
  if (!n.topic.trim()) return fail("Give the thread a subject");
  if (!n.body.trim()) return fail("Write the first message");
  if (!n.subjectId) return fail("Choose what this thread is about");
  const s = parse(readRaw());
  const at = negotiationNow();
  const id = nextThreadId(s.created, Number(at.slice(0, 4)));
  const internal = n.with === "team";
  const thread: Thread = {
    id,
    subjectType: n.subjectType,
    subjectId: n.subjectId,
    refs: n.refs,
    topic: n.topic.trim(),
    participants: internal ? ["exporter", "team"] : ["exporter", "ximverse"],
    priority: "normal",
    createdAt: at,
    messages: [
      { id: `${id}-m1`, threadId: id, sender: internal ? "team" : "exporter", type: n.type ?? "request", body: n.body.trim(), at, visibility: internal ? "exporter-internal" : "participants", refs: n.refs, demo: true },
    ],
  };
  return commit({ ...s, created: [...s.created, thread], read: { ...s.read, [id]: at } }) ? { ok: true, id } : fail("Couldn't save — browser storage unavailable");
}
