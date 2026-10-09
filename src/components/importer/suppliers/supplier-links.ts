import { importerHref } from "@/lib/importer-nav";

/** Quotations list pre-filtered to one supplier. */
export function supplierQuotationsHref(supplierId: string): string {
  return `${importerHref("quotations")}?supplier=${supplierId}`;
}

export function supplierHref(supplierId: string): string {
  return importerHref(`suppliers/${supplierId}`);
}
