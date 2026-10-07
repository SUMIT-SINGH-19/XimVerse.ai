import type { Metadata } from "next";
import { PageHeader } from "@/components/workspace/page-header";
import { ProfileSummary } from "@/components/exporter/company/profile-summary";
import { ProfileReadiness, SumitInsight } from "@/components/exporter/company/profile-readiness";
import {
  BuyerMatchingSection,
  CapabilitiesSection,
  CertificationsSection,
  CompanyInformationSection,
  MarketsSection,
  RegistrationSection,
  TradePreferencesSection,
} from "@/components/exporter/company/profile-sections";
import { EXPORTER_WORKSPACE } from "@/lib/exporter-nav";
import {
  BUYER_MATCHING_PROFILE,
  CERTIFICATIONS,
  COMPANY_INFORMATION,
  EXPORT_CAPABILITIES,
  MARKETS_PROFILE,
  PROFILE_SUMMARY,
  READINESS_ITEMS,
  REGISTRATIONS,
  SUMIT_PROFILE_INSIGHT,
  TRADE_PREFERENCES,
} from "@/lib/exporter-company";

export const metadata: Metadata = { title: "Company Profile" };

export default function ExporterCompanyPage() {
  const { identity, assistant } = EXPORTER_WORKSPACE;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Company Profile"
        description="Manage your business identity, export capabilities, certifications and trade preferences."
      />

      <ProfileSummary identity={identity} summary={PROFILE_SUMMARY} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Readiness leads on small screens and sits beside the profile on wide ones. */}
        <div className="min-w-0 space-y-6 xl:order-last">
          <div className="space-y-6 xl:sticky xl:top-24">
            <ProfileReadiness completion={PROFILE_SUMMARY.completion} items={READINESS_ITEMS} />
            {assistant && <SumitInsight title="SUMIT insight" insight={SUMIT_PROFILE_INSIGHT} />}
          </div>
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-2">
          <CompanyInformationSection info={COMPANY_INFORMATION} />
          <RegistrationSection records={REGISTRATIONS} />
          <CapabilitiesSection capabilities={EXPORT_CAPABILITIES} />
          <MarketsSection markets={MARKETS_PROFILE} />
          <CertificationsSection certifications={CERTIFICATIONS} />
          <TradePreferencesSection preferences={TRADE_PREFERENCES} incoterms={MARKETS_PROFILE.preferredIncoterms} />
          <BuyerMatchingSection profile={BUYER_MATCHING_PROFILE} />
        </div>
      </div>
    </div>
  );
}
