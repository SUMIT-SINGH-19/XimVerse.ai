"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Plus } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { focusRing } from "@/components/workspace/styles";
import { SumitInsight } from "@/components/exporter/company/profile-readiness";
import { exporterHref } from "@/lib/exporter-nav";
import {
  catalogueSummary,
  CERTIFICATION_OPTIONS,
  readinessBand,
  type ExporterProduct,
} from "@/lib/exporter-products";
import { CatalogueSummary } from "./catalogue-summary";
import { CatalogueFilters, EMPTY_FILTERS, type CatalogueFilterState } from "./catalogue-filters";
import { EmptyCatalogue, ProductList } from "./product-list";
import { ProductDetail } from "./product-detail";
import { AddProductForm } from "./add-product-form";
import { MatchFlow } from "./match-flow";
import { Modal } from "./modal";

function applyFilters(products: readonly ExporterProduct[], f: CatalogueFilterState): ExporterProduct[] {
  const q = f.query.trim().toLowerCase();
  const matches = products.filter(
    (p) =>
      (!q || [p.name, p.productCode, p.hsCode, p.category, p.subcategory ?? ""].some((s) => s.toLowerCase().includes(q))) &&
      (!f.status || p.status === f.status) &&
      (!f.category || p.category === f.category) &&
      (!f.readiness || readinessBand(p.readiness) === f.readiness) &&
      (!f.certification || p.certifications.some((c) => c.certificationKey === f.certification)),
  );
  const by: Record<CatalogueFilterState["sort"], (a: ExporterProduct, b: ExporterProduct) => number> = {
    readiness: (a, b) => b.readiness - a.readiness,
    available: (a, b) => b.supply.availableCapacity.value - a.supply.availableCapacity.value,
    updated: (a, b) => b.updatedOn.localeCompare(a.updatedOn),
  };
  return matches.sort(by[f.sort]);
}

/**
 * The products page body. Holds the catalogue in local state so demo products
 * can be added for the session; nothing here is persisted.
 */
export function ProductCatalogue({
  initialProducts,
  insight,
}: {
  initialProducts: readonly ExporterProduct[];
  insight: string;
}) {
  const [products, setProducts] = useState<readonly ExporterProduct[]>(initialProducts);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visible = useMemo(() => applyFilters(products, filters), [products, filters]);
  const summary = useMemo(() => catalogueSummary(products), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const open = products.find((p) => p.id === openId);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const add = (product: ExporterProduct) => {
    setProducts((list) => [product, ...list]);
    setAdding(false);
    setFilters(EMPTY_FILTERS);
    setToast(`“${product.name}” added to the demo catalogue as a draft. It isn't saved and will disappear on reload.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Manage the products and supply capabilities Ximverse uses to match you with buyer demand."
        aside={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`inline-flex h-10 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-semibold text-on-brand shadow-sm shadow-teal/20 transition hover:brightness-110 ${focusRing}`}
          >
            <Plus className="size-4" aria-hidden />
            Add Product
          </button>
        }
      />

      <CatalogueSummary summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col justify-center gap-2 rounded-2xl border border-line bg-surface px-5 py-4 lg:col-span-3">
          <p className="text-sm text-ink-muted">
            Your product profiles are matched against buyer requirements to score and surface opportunities.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MatchFlow />
            <Link
              href={exporterHref("opportunities")}
              className={`inline-flex items-center gap-1 text-sm font-semibold text-teal hover:text-ink ${focusRing}`}
            >
              Buyer Opportunities
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="lg:col-span-2">
          <SumitInsight title="SUMIT insight" insight={insight} />
        </div>
      </div>

      <section aria-labelledby="catalogue-heading" className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-3 pt-5 sm:px-6">
          <h2 id="catalogue-heading" className="text-base font-semibold tracking-tight text-ink">
            Export Catalogue
          </h2>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {visible.length} of {products.length} products
          </p>
        </div>
        <CatalogueFilters
          filters={filters}
          onChange={setFilters}
          categories={categories}
          certifications={CERTIFICATION_OPTIONS}
        />
        {visible.length ? (
          <ProductList products={visible} onOpen={setOpenId} />
        ) : (
          <EmptyCatalogue onReset={() => setFilters(EMPTY_FILTERS)} />
        )}
      </section>

      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} labelledBy="product-detail-title" variant="drawer">
        {open && <ProductDetail product={open} onClose={() => setOpenId(null)} />}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} labelledBy="add-product-title">
        <AddProductForm onAdd={add} onCancel={() => setAdding(false)} />
      </Modal>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6">
        {toast && (
          <p className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-xl">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-orange-soft" aria-hidden />
            {toast}
          </p>
        )}
      </div>
    </div>
  );
}
