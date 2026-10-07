"use client";

/*
 * Labelled form controls with hint and inline error wiring, so every field in
 * the requirement form gets the same accessible structure.
 */

const controlBase =
  "w-full min-w-0 rounded-xl border bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:outline-none focus:ring-2";

function controlClass(error?: string) {
  return `${controlBase} ${
    error
      ? "border-orange focus:border-orange focus:ring-orange/25"
      : "border-line hover:border-teal/40 focus:border-teal focus:ring-teal/20"
  }`;
}

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  /** Set false for fields that always hold a value, so no "Optional" tag shows. */
  showOptional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  /** Rendered beside the label, e.g. a help toggle. */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function describedBy(id: string, hint?: React.ReactNode, error?: string) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function FieldShell({
  id,
  label,
  required,
  showOptional = true,
  hint,
  error,
  aside,
  className = "",
  children,
}: FieldShellProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required ? (
            <span className="ml-0.5 text-orange" aria-hidden>
              *
            </span>
          ) : (
            showOptional && <span className="ml-1.5 text-xs font-normal text-ink-faint">Optional</span>
          )}
        </label>
        {aside}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-orange">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = Omit<FieldShellProps, "children"> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function TextField({
  type = "text",
  inputMode,
  list,
  min,
  ...props
}: Common & {
  type?: "text" | "number" | "date";
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  list?: string;
  min?: string;
}) {
  const { id, value, onChange, placeholder, required, hint, error } = props;
  return (
    <FieldShell {...props}>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        list={list}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClass(error)} h-11`}
      />
    </FieldShell>
  );
}

export function TextArea({ rows = 4, ...props }: Common & { rows?: number }) {
  const { id, value, onChange, placeholder, required, hint, error } = props;
  return (
    <FieldShell {...props}>
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClass(error)} resize-y py-2.5 leading-relaxed`}
      />
    </FieldShell>
  );
}

export function SelectField({
  options,
  emptyLabel = "Select…",
  ...props
}: Common & { options: readonly { value: string; label: string }[]; emptyLabel?: string | null }) {
  const { id, value, onChange, required, hint, error } = props;
  return (
    <FieldShell {...props}>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${controlClass(error)} h-11 ${value ? "" : "text-ink-faint"}`}
      >
        {emptyLabel !== null && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-teal/40 has-checked:border-teal/50 has-checked:bg-teal-soft/50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** A titled group of fields within a step. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <legend className="float-left w-full text-base font-semibold tracking-tight text-ink">{title}</legend>
      {description && <p className="clear-left pt-1 text-sm text-ink-muted">{description}</p>}
      <div className="clear-left grid grid-cols-1 gap-5 pt-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
