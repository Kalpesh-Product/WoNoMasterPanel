import axios from "axios";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NOMADS_BACKEND_URL } from "../../../constants/api";
import ValueAddsPartnersTable from "./ValueAddsPartnersTable";

const commonColumns = [
  { field: "partnerName", headerName: "Partner Name" },
  { field: "companyName", headerName: "Company" },
  { field: "region", headerName: "Region" },
  { field: "contactPerson", headerName: "Contact Person" },
  { field: "email", headerName: "Email" },
  { field: "phone", headerName: "Phone" },
  { field: "status", headerName: "Status" },
  { field: "lastUpdated", headerName: "Last Updated" },
];

const partnerRows = {
  "activation-support": [
    {
      id: "activation-1",
      partnerName: "LaunchBridge",
      companyName: "BridgeOps",
      region: "India",
      contactPerson: "Riya Kapoor",
      email: "launch@example.com",
      phone: "+91 98765 43210",
      status: "Active",
      lastUpdated: "2026-08-04",
      notes: "Supports partner onboarding and activation checklists.",
    },
    {
      id: "activation-2",
      partnerName: "GoLive Partners",
      companyName: "GoLive Services",
      region: "Singapore",
      contactPerson: "Daniel Tan",
      email: "golive@example.com",
      phone: "+65 8000 1020",
      status: "Inactive",
      lastUpdated: "2026-07-20",
      notes: "Commercial terms require renewal before activation.",
    },
  ],
  "company-setup": [
    {
      id: "setup-1",
      partnerName: "Entity Works",
      companyName: "Entity Works Advisory",
      region: "United Kingdom",
      contactPerson: "Meera Shah",
      email: "setup@example.com",
      phone: "+44 20 0000 0912",
      status: "Active",
      lastUpdated: "2026-08-01",
      notes: "Covers company setup, tax registration, and local documentation.",
    },
  ],
  consultation: [
    {
      id: "consultation-1",
      partnerName: "Borderless Advisory",
      companyName: "Borderless Group",
      region: "Global",
      contactPerson: "Omar Haddad",
      email: "advisory@example.com",
      phone: "+1 415 000 0191",
      status: "Active",
      lastUpdated: "2026-08-05",
      notes: "General consultation partner for expansion and mobility planning.",
    },
  ],
  workation: [
    {
      id: "workation-1",
      partnerName: "Remote Retreats",
      companyName: "Remote Retreats Co.",
      region: "Bali",
      contactPerson: "Nisha Rao",
      email: "retreats@example.com",
      phone: "+62 812 0000 9821",
      status: "Pending",
      lastUpdated: "2026-07-30",
      notes: "Workation stay packages and local experience coordination.",
    },
  ],
  "become-a-contributor": [
    {
      id: "contributor-1",
      partnerName: "Creator Circle",
      companyName: "Creator Circle",
      region: "Remote",
      contactPerson: "Elena Morris",
      email: "contributors@example.com",
      phone: "+1 646 000 1172",
      status: "Active",
      lastUpdated: "2026-08-06",
      notes: "Contributor network for destination guides and service content.",
    },
  ],
};

const visaSupportColumns = [
  { field: "partnerName", headerName: "Partner Name" },
  { field: "country", headerName: "Country" },
  { field: "city", headerName: "City" },
  { field: "website", headerName: "Website" },
  { field: "email", headerName: "Email" },
  { field: "phone", headerName: "Phone" },
  { field: "agentNumber", headerName: "Agent No." },
  { field: "lastUpdated", headerName: "Last Updated" },
];

const flattenVisaSupportPartners = (records = []) =>
  records.flatMap((record) =>
    (record.partners || []).map((partner, index) => ({
      id: `${record._id || `${record.country}-${record.city}`}-${partner.agentNumber || index}`,
      partnerName: partner.name || `Agent ${partner.agentNumber || index + 1}`,
      companyName: partner.website || "--",
      region: [record.city, record.country].filter(Boolean).join(", "),
      contactPerson: `Agent ${partner.agentNumber || index + 1}`,
      country: record.country || "--",
      city: record.city || "--",
      website: partner.website || "",
      email: partner.email || "",
      phone: partner.contact || "",
      agentNumber: partner.agentNumber || index + 1,
      status: "Active",
      lastUpdated: record.updatedAt || record.createdAt,
      notes: `Visa support partner for ${[record.city, record.country].filter(Boolean).join(", ") || "this location"}.`,
    })),
  );

export const VisaSupportPartnersTable = () => {
  const { data = [], isPending, isError, error } = useQuery({
    queryKey: ["valueAddsPartners", "visa-support"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_BACKEND_URL}/api/visa-support/partners`);
      return response?.data?.data || [];
    },
  });

  const rows = useMemo(() => flattenVisaSupportPartners(data), [data]);

  return (
    <ValueAddsPartnersTable
      title="Visa Support"
      rows={rows}
      columns={visaSupportColumns}
      isLoading={isPending}
      isError={isError}
      errorMessage={error?.response?.data?.message || error?.message}
      emptyMessage="No visa support partners found."
      tableLabels={{ company: "Website" }}
      locationColumns={[
        { field: "country", headerName: "Country" },
        { field: "city", headerName: "City" },
      ]}
      splitContact
      companyAfterContact
    />
  );
};

export const ActivationSupportPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Activation Support"
    rows={partnerRows["activation-support"]}
    columns={commonColumns}
  />
);

export const CompanySetupPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Company Setup"
    rows={partnerRows["company-setup"]}
    columns={commonColumns}
  />
);

export const ConsultationPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Consultation"
    rows={partnerRows.consultation}
    columns={commonColumns}
  />
);

export const WorkationPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Workation"
    rows={partnerRows.workation}
    columns={commonColumns}
  />
);

export const BecomeAContributorPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Become a Contributor"
    rows={partnerRows["become-a-contributor"]}
    columns={commonColumns}
  />
);
