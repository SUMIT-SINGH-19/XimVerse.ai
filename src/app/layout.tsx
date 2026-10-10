import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { config } from "@/lib/config";
import { LocaleProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import { MESSAGES } from "@/i18n/messages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "One platform for exporters, importers, customs house agents and freight forwarders.";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "Ximverse",
    template: "%s · Ximverse",
  },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Ximverse",
    title: "Ximverse",
    description,
    url: "/",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider locale={locale} messages={MESSAGES[locale]}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
