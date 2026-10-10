import { Logo } from "@/components/logo";
import { OrbitDots } from "@/components/orbit-dots";
import { RolePicker } from "@/components/role-picker";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";

export default async function Home() {
  const t = await getT();
  // Word order differs by language, so the brand is a placeholder. It keeps
  // punctuation that directly follows it, as in "use Ximverse?".
  const [beforeBrand, afterBrand = ""] = t("How do you use {brand}?").split("{brand}");
  const brandTail = /^\p{P}*$/u.test(afterBrand) ? afterBrand : "";

  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      <OrbitDots className="pointer-events-none absolute -right-40 -top-24 w-[520px] opacity-25 sm:-right-24 sm:w-[640px] sm:opacity-60 lg:-right-10 lg:-top-10 lg:w-[760px] lg:opacity-100" />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="inline-flex rounded-2xl bg-white px-5 py-3 shadow-[0_1px_2px_rgba(11,46,48,0.06),0_8px_24px_rgba(11,46,48,0.06)]">
          <Logo />
        </div>
        <LanguageSwitcher className="shadow-sm" />
      </header>

      <main className="relative z-10 flex-1 px-4 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="mx-auto w-full max-w-6xl">
          <p className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm">
            <span className="size-2 rounded-full bg-orange" aria-hidden />
            {t("Built for Indian cross-border trade")}
          </p>

          <h1 className="mt-6 max-w-3xl text-[2.75rem] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-7xl lg:text-[5.5rem]">
            {beforeBrand}
            <span className="text-orange">Ximverse{brandTail}</span>
            {afterBrand.slice(brandTail.length)}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            {t("Exporters, importers, customs house agents and freight forwarders — one platform, shaped around your role.")}
          </p>

          <div className="mt-12 lg:mt-16">
            <RolePicker />
          </div>
        </div>
      </main>
    </div>
  );
}
