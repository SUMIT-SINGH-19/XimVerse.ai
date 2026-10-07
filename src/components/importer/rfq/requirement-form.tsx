"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Info } from "lucide-react";
import type { ImportRequirement } from "@/lib/import-requirements";
import { importerHref } from "@/lib/importer-nav";
import { ImportId } from "../dashboard/dashboard-ui";
import { focusRing, ghostButton, primaryButton, secondaryButton } from "../styles";
import {
  EMPTY_FORM,
  FORM_STEPS,
  firstInvalidStep,
  stepErrors,
  toRequirement,
  validate,
  type RequirementFormValues,
  type StepId,
} from "./requirement-form-model";
import {
  CommercialStep,
  DeliveryStep,
  ProductStep,
  QualityStep,
  SupplierStep,
  type StepProps,
} from "./requirement-form-steps";
import {
  AttachmentList,
  commercialFacts,
  deliveryFacts,
  FactList,
  notesFacts,
  productFacts,
  qualityFacts,
  supplierFacts,
  type Fact,
} from "./requirement-sections";
import { useImportRequirements } from "./requirements-store";
import { SumitHelpCard } from "./sumit-help-card";

const STEP_COPY: Record<StepId, { title: string; description: string }> = {
  product: {
    title: "What do you need?",
    description: "Describe the product. The clearer the specification, the more comparable the quotations.",
  },
  delivery: {
    title: "Quantity & delivery",
    description: "How much you need, where it should arrive and by when.",
  },
  commercial: {
    title: "Commercial preferences",
    description: "Optional price and payment expectations.",
  },
  quality: {
    title: "Quality & compliance",
    description: "Documents, inspection and packaging you expect from the supplier.",
  },
  supplier: {
    title: "Supplier preferences",
    description: "Who you'd like to buy from, plus any notes.",
  },
  review: {
    title: "Review your requirement",
    description: "Check everything before publishing. You can edit any section.",
  },
};

const STEP_BODY: Partial<Record<StepId, (props: StepProps) => React.ReactNode>> = {
  product: ProductStep,
  delivery: DeliveryStep,
  commercial: CommercialStep,
  quality: QualityStep,
  supplier: SupplierStep,
};

export function RequirementForm() {
  const store = useImportRequirements();
  const [values, setValues] = useState<RequirementFormValues>(EMPTY_FORM);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  /** Steps whose errors are visible: the user has tried to leave them. */
  const [checked, setChecked] = useState<ReadonlySet<StepId>>(new Set());
  const [saved, setSaved] = useState<ImportRequirement | null>(null);
  const [published, setPublished] = useState<ImportRequirement | null>(null);
  const [notice, setNotice] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const step = FORM_STEPS[stepIndex];
  const allErrors = validate(values);
  const visibleErrors = Object.fromEntries(
    Object.entries(allErrors).filter(([field]) =>
      FORM_STEPS.some((s) => checked.has(s.id) && (s.fields as readonly string[]).includes(field)),
    ),
  );

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land at the top of the step.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [stepIndex, published]);

  const set: StepProps["set"] = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setNotice("");
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    setFurthest((f) => Math.max(f, index));
  };

  const markChecked = (...ids: StepId[]) => setChecked((c) => new Set([...c, ...ids]));

  const focusField = (field: string) => {
    // Wait for the step (and its error messages) to render.
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const tryLeave = (target: number) => {
    const forward = target > stepIndex;
    const reviewIndex = FORM_STEPS.length - 1;

    if (forward) {
      const errs = stepErrors(step.id, allErrors);
      if (Object.keys(errs).length) {
        markChecked(step.id);
        focusField(Object.keys(errs)[0]);
        return;
      }
    }
    if (target === reviewIndex) {
      const invalid = firstInvalidStep(allErrors);
      if (invalid) {
        const idx = FORM_STEPS.findIndex((s) => s.id === invalid);
        markChecked(...FORM_STEPS.slice(0, reviewIndex).map((s) => s.id));
        setNotice("Some required information is missing. Complete the highlighted fields to review.");
        goTo(idx);
        focusField(Object.keys(stepErrors(invalid, allErrors))[0]);
        return;
      }
    }
    if (forward) markChecked(step.id);
    goTo(target);
  };

  const persist = (status: "draft" | "ready") => {
    const now = new Date().toISOString();
    const requirement = toRequirement(values, {
      id: saved?.id ?? store.nextId(),
      status,
      createdAt: saved?.createdAt ?? now,
      now,
      previous: saved ?? undefined,
    });
    store.save(requirement);
    setSaved(requirement);
    return requirement;
  };

  const saveDraft = () => {
    if (!values.productName.trim()) {
      markChecked("product");
      setNotice("Add a product name to save a draft.");
      goTo(0);
      focusField("productName");
      return;
    }
    const draft = persist("draft");
    setNotice(`Draft saved as ${draft.id}. Drafts are kept in this browser tab only until saving is connected.`);
  };

  const publish = () => {
    if (firstInvalidStep(allErrors)) return tryLeave(FORM_STEPS.length - 1);
    setPublished(persist("ready"));
  };

  if (published) return <PublishedState requirement={published} headingRef={headingRef} />;

  const Body = STEP_BODY[step.id];
  const isReview = step.id === "review";
  const isLastFormStep = stepIndex === FORM_STEPS.length - 2;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={importerHref("rfqs")}
          className={`inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted hover:text-teal ${focusRing}`}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Import Requirements
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          New Import Requirement
        </h1>
        <p className="mt-2 max-w-2xl text-base text-ink-muted">
          Tell us what you need to import. XimVerse structures it into a requirement suppliers can quote on.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Stepper
            current={stepIndex}
            furthest={furthest}
            completed={(id) => checked.has(id) && Object.keys(stepErrors(id, allErrors)).length === 0}
            onSelect={tryLeave}
          />
          <SumitHelpCard className="hidden lg:block" />
        </aside>

        <div className="min-w-0 space-y-6">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (isReview) publish();
              else tryLeave(stepIndex + 1);
            }}
            className="rounded-2xl border border-line bg-surface"
            aria-labelledby="step-heading"
          >
            <div className="border-b border-line px-5 py-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange">
                Step {stepIndex + 1} of {FORM_STEPS.length}
              </p>
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="mt-1 scroll-mt-28 text-xl font-semibold tracking-tight text-ink focus:outline-none"
              >
                {STEP_COPY[step.id].title}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{STEP_COPY[step.id].description}</p>
            </div>

            <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
              {Body ? (
                <Body values={values} set={set} errors={visibleErrors} />
              ) : (
                <ReviewStep values={values} onEdit={(id) => goTo(FORM_STEPS.findIndex((s) => s.id === id))} />
              )}
            </div>

            <div className="border-t border-line px-5 py-4 sm:px-8">
              <p role="status" className={`text-sm ${notice ? "mb-3" : ""} ${notice.startsWith("Draft") ? "text-teal" : "text-orange"}`}>
                {notice}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                {stepIndex > 0 && (
                  <button type="button" onClick={() => goTo(stepIndex - 1)} className={ghostButton}>
                    <ArrowLeft aria-hidden className="size-4" />
                    Back
                  </button>
                )}
                <div className="flex flex-col-reverse gap-3 sm:ml-auto sm:flex-row">
                  <button type="button" onClick={saveDraft} className={secondaryButton}>
                    {isReview ? "Save as Draft" : "Save Draft"}
                  </button>
                  <button type="submit" className={primaryButton}>
                    {isReview ? "Publish Requirement" : isLastFormStep ? "Review Requirement" : "Continue"}
                    {!isReview && <ArrowRight aria-hidden className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <SumitHelpCard className="lg:hidden" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Stepper({
  current,
  furthest,
  completed,
  onSelect,
}: {
  current: number;
  furthest: number;
  completed: (id: StepId) => boolean;
  onSelect: (index: number) => void;
}) {
  const progress = ((current + 1) / FORM_STEPS.length) * 100;
  return (
    <nav aria-label="Requirement steps" className="rounded-2xl border border-line bg-surface p-4">
      {/* Compact progress on small screens. */}
      <div className="lg:hidden">
        <p className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink">{FORM_STEPS[current].label}</span>
          <span className="text-xs text-ink-muted">
            Step {current + 1} of {FORM_STEPS.length}
          </span>
        </p>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="hidden space-y-1 lg:block">
        {FORM_STEPS.map((s, i) => {
          const active = i === current;
          const done = !active && completed(s.id);
          const reachable = i <= furthest || i === current + 1;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${focusRing} ${
                  active ? "bg-teal-soft font-semibold text-ink" : "text-ink-muted enabled:hover:bg-canvas enabled:hover:text-ink disabled:opacity-60"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-teal text-on-brand"
                      : done
                        ? "bg-teal-soft text-teal"
                        : "border border-line text-ink-faint"
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
                {done && <span className="sr-only">(complete)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------------ */

function ReviewStep({ values, onEdit }: { values: RequirementFormValues; onEdit: (step: StepId) => void }) {
  const r = toRequirement(values, { id: "preview", status: "draft", createdAt: "", now: "" });
  const sections: { title: string; step: StepId; facts?: Fact[]; children?: React.ReactNode }[] = [
    { title: "Product", step: "product", facts: productFacts(r) },
    { title: "Delivery", step: "delivery", facts: deliveryFacts(r) },
    { title: "Commercial", step: "commercial", facts: commercialFacts(r) },
    { title: "Quality & Compliance", step: "quality", facts: qualityFacts(r) },
    { title: "Attachments", step: "product", children: <AttachmentList attachments={r.attachments} /> },
    { title: "Supplier Preferences", step: "supplier", facts: supplierFacts(r) },
    { title: "Notes", step: "supplier", facts: notesFacts(r) },
  ];

  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section key={s.title} aria-labelledby={`review-${s.title}`} className="border-t border-line pt-6 first:border-t-0 first:pt-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id={`review-${s.title}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {s.title}
            </h3>
            <button
              type="button"
              onClick={() => onEdit(s.step)}
              className={`rounded-md text-sm font-semibold text-teal hover:underline ${focusRing}`}
            >
              Edit<span className="sr-only"> {s.title}</span>
            </button>
          </div>
          {s.facts ? <FactList facts={s.facts} /> : s.children}
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function PublishedState({
  requirement,
  headingRef,
}: {
  requirement: ImportRequirement;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center sm:px-10">
        <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-teal-soft text-teal">
          <CircleCheck className="size-6" />
        </span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-5 text-2xl font-bold tracking-tight text-ink focus:outline-none"
        >
          Requirement ready
        </h1>
        <p className="mt-2 text-ink-muted">Your import requirement has been structured successfully.</p>
        <p className="mt-4 text-sm text-ink-muted">
          <ImportId id={requirement.id} className="font-semibold text-ink" /> · {requirement.product.name}
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl bg-canvas px-4 py-3 text-left text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />
          <p>
            Supplier matching and distribution will be connected in a later step. Nothing has been sent to
            suppliers yet, and this requirement is kept in this browser tab only.
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={importerHref(`rfqs/${requirement.id}`)} className={primaryButton}>
            View Requirement
          </Link>
          <Link href={importerHref("rfqs")} className={secondaryButton}>
            Back to Requirements
          </Link>
        </div>
      </div>
    </div>
  );
}
