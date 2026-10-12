import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThreadById } from "@/components/exporter/messages/thread-detail";
import { LOCAL_THREAD_ID, SEEDED_THREAD_IDS } from "@/lib/exporter-communications";

/*
 * Seeded threads are known to the server. Threads created in this browser
 * (THR-YYYY-9xxx) resolve on the client. Anything else is a 404.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return SEEDED_THREAD_IDS.map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/exporter/messages/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Thread ${id}` };
}

export default async function ThreadPage({ params }: PageProps<"/exporter/messages/[id]">) {
  const { id } = await params;
  if (!SEEDED_THREAD_IDS.includes(id) && !LOCAL_THREAD_ID.test(id)) notFound();
  return <ThreadById id={id} />;
}
