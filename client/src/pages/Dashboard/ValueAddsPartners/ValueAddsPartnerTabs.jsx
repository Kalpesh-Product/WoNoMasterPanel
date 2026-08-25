import axios from "axios";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
      notes:
        "General consultation partner for expansion and mobility planning.",
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
  { field: "company", headerName: "Company" },
  { field: "continent", headerName: "Continent" },
  { field: "country", headerName: "Country" },
  { field: "destination", headerName: "State" },
  { field: "visaType", headerName: "Visa Type" },
  { field: "agentName", headerName: "Agent Name" },
  { field: "website", headerName: "Website" },
  { field: "contact", headerName: "Contact" },
  { field: "email", headerName: "Email" },
  { field: "status", headerName: "Status" },
  { field: "address", headerName: "Address" },
  { field: "rating", headerName: "Rating" },
  { field: "googleReviews", headerName: "Google Reviews" },
  { field: "lastUpdated", headerName: "Last Updated" },
];

const visaSupportTableColumns = visaSupportColumns.filter((column) =>
  [
    "company",
    "continent",
    "country",
    "destination",
    "contact",
    "email",
    "status",
  ].includes(column.field),
);

const resolveRating = (value) => (value === 0 || value ? value : "--");

const emptyDash = (value) => (value === "--" ? "" : (value ?? ""));

const nullableNumber = (value) => {
  if (value === "--" || value === "" || value === null || value === undefined)
    return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const buildVisaSupportStatusPayload = (row, status) => ({
  continent: emptyDash(row.continent),
  country: emptyDash(row.country),
  destination: emptyDash(row.destination),
  visaType: emptyDash(row.visaType),
  company: emptyDash(row.company),
  agentName: emptyDash(row.agentName),
  website: emptyDash(row.website),
  contact: emptyDash(row.contact),
  email: String(emptyDash(row.email)).trim().toLowerCase(),
  address: emptyDash(row.address),
  rating: nullableNumber(row.rating),
  googleReviews: nullableNumber(row.googleReviews),
  status,
});

const flattenVisaSupportPartners = (records = []) =>
  records.flatMap((record) => {
    if (Array.isArray(record.partners) && record.partners.length) {
      return record.partners.map((partner, index) => ({
        id: `${record._id || `${record.country}-${record.city}`}-${partner.agentNumber || index}`,
        recordId: record._id || "",
        continent: record.continent || "--",
        country: record.country || "--",
        destination: record.destination || record.city || "--",
        visaType: record.visaType || "--",
        company:
          partner.name ||
          record.company ||
          `Agent ${partner.agentNumber || index + 1}`,
        partnerName:
          partner.name ||
          record.company ||
          `Agent ${partner.agentNumber || index + 1}`,
        agentName: record.agentName || "",
        website: partner.website || record.website || "",
        contact: partner.contact || record.contact || "",
        email: partner.email || record.email || "",
        address: record.address || "--",
        rating: resolveRating(record.rating),
        googleReviews: resolveRating(record.googleReviews),
        status: record.status || "Active",
        lastUpdated: record.updatedAt || record.createdAt,
        notes: `Visa support partner for ${[record.destination || record.city, record.country].filter(Boolean).join(", ") || "this location"}.`,
      }));
    }

    return {
      id:
        record._id ||
        `${record.country}-${record.destination}-${record.company}`,
      recordId: record._id || "",
      continent: record.continent || "--",
      country: record.country || "--",
      destination: record.destination || "--",
      visaType: record.visaType || "--",
      company: record.company || "--",
      partnerName: record.company || record.agentName || "Visa Support Partner",
      agentName: record.agentName || "--",
      website: record.website || "",
      contact: record.contact || "",
      email: record.email || "",
      address: record.address || "--",
      rating: resolveRating(record.rating),
      googleReviews: resolveRating(record.googleReviews),
      status: record.status || "Active",
      lastUpdated: record.updatedAt || record.createdAt,
      notes: `Visa support partner for ${[record.destination, record.country].filter(Boolean).join(", ") || "this location"}.`,
    };
  });

export const VisaSupportPartnersTable = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["valueAddsPartners", "visa-support"],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_BACKEND_URL}/api/visa-support/partners`,
      );
      return response?.data?.data || [];
    },
  });

  const rows = useMemo(() => flattenVisaSupportPartners(data), [data]);

  const {
    mutate: togglePartnerStatus,
    isPending: isTogglingStatus,
    variables,
  } = useMutation({
    mutationFn: async (row) => {
      const partnerId = row.recordId || row.id;
      const nextStatus =
        String(row.status || "Active").toLowerCase() === "active"
          ? "Inactive"
          : "Active";
      const response = await axios.patch(
        `${NOMADS_BACKEND_URL}/api/visa-support/partners/${partnerId}`,
        buildVisaSupportStatusPayload(row, nextStatus),
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Visa support partner status updated");
      queryClient.invalidateQueries({
        queryKey: ["valueAddsPartners", "visa-support"],
      });
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update visa support partner status",
      );
    },
  });

  const openEditPartner = (row) => {
    const partnerId = row.recordId || row.id;
    if (!partnerId) return;

    navigate(`/dashboard/value-adds-partners/visa-support/edit/${partnerId}`, {
      state: { partner: row },
    });
  };

  return (
    <ValueAddsPartnersTable
      title="Visa Support"
      rows={rows}
      columns={visaSupportColumns}
      isLoading={isPending}
      isError={isError}
      errorMessage={error?.response?.data?.message || error?.message}
      emptyMessage="No visa support partners found."
      tableColumns={visaSupportTableColumns}
      filterControls={[
        {
          field: "continent",
          label: "Continent",
          placeholder: "All Continents",
        },
        { field: "country", label: "Country", placeholder: "All Countries" },
        { field: "destination", label: "State", placeholder: "All States" },
        // { field: "status", label: "Status", placeholder: "All Statuses" },
      ]}
      onEditRow={openEditPartner}
      onToggleStatus={(row) => togglePartnerStatus(row)}
      togglingStatusRowId={isTogglingStatus ? variables?.id : null}
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
