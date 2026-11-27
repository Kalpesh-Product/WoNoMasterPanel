import React from "react";
import { useParams } from "react-router-dom";
import RoleLeadsPage from "./RoleLeadsPage";

// Same "become a contributor" submission and lead collection as ContributorLeads —
// these are just the 5 Value Adds Partner options from that same form/dropdown.
const PARTNER_TABS = [
  {
    slug: "visa-support",
    label: "Visa Support",
    singular: "Visa Partner",
    contributionLabel: "Become a Visa & Immigration Partner",
    roleFlag: "isVisaPartner",
    service: "visaPartner",
    matchers: ["become a visa & immigration partner"],
  },
  {
    slug: "company-setup",
    label: "Company Setup",
    singular: "Company Setup Partner",
    contributionLabel: "Become a Company Setup Services Partner",
    roleFlag: "isCompanySetupPartner",
    service: "companySetupPartner",
    matchers: ["become a company setup services partner"],
  },
  {
    slug: "activation-support",
    label: "Activation Support",
    singular: "Activation Support Partner",
    contributionLabel: "Become a Activation Support Partner",
    roleFlag: "isActivationSupportPartner",
    service: "activationSupportPartner",
    matchers: ["become a activation support partner"],
  },
  {
    slug: "consultation-support",
    label: "Consultation Support",
    singular: "Consultation Support Partner",
    contributionLabel: "Become a Consultation Support Partner",
    roleFlag: "isConsultationSupportPartner",
    service: "consultationSupportPartner",
    matchers: ["become a consultation support partner"],
  },
  {
    slug: "workation-support",
    label: "Workation Support",
    singular: "Workation Support Partner",
    contributionLabel: "Become a Workation Support Partner",
    roleFlag: "isWorkationPartner",
    service: "workationPartner",
    matchers: ["become a workation support partner"],
  },
];

const ValueAddsPartnerLeads = () => {
  const { partnerLeadTab } = useParams();

  return (
    <RoleLeadsPage
      tabs={PARTNER_TABS}
      activeSlug={partnerLeadTab}
      basePath="/dashboard/value-adds-partner-leads"
      apiEndpoint="/api/contributor-leads"
      queryKey="contributorLeads"
      modalKindLabel="Become a Partner"
      inviteEndpoint="/api/partner-invites"
      reviewStatuses
    />
  );
};

export default ValueAddsPartnerLeads;
