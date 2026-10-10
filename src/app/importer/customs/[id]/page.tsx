import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomsDetail } from "@/components/importer/customs/customs-detail";
import { CUSTOMS_CASE_ID_PATTERN, MOCK_CUSTOMS_CASES } from "@/lib/importer-customs";

/*
 * Demo customs cases are pre-rendered. Other well-formed IDs render on
 * request, because cases created in the browser exist only in session storage.
 */

export function generateStaticParams() {
  return MOCK_CUSTOMS_CASES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/importer/customs/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Customs ${id}` };
}

export default async function CustomsCasePage({ params }: PageProps<"/importer/customs/[id]">) {
  const { id } = await params;
  if (!CUSTOMS_CASE_ID_PATTERN.test(id)) notFound();
  return <CustomsDetail id={id} />;
}
