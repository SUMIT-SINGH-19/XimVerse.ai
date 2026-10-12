import type { Metadata } from "next";
import { MessagesList } from "@/components/exporter/messages/messages-list";

export const metadata: Metadata = { title: "Messages" };

/* ?new=<ORD-…|SHP-…|DOC-…> opens a new, transaction-linked thread. */
export default async function ExporterMessagesPage({ searchParams }: PageProps<"/exporter/messages">) {
  const { new: newFor } = await searchParams;
  return <MessagesList newFor={typeof newFor === "string" ? newFor : undefined} />;
}
