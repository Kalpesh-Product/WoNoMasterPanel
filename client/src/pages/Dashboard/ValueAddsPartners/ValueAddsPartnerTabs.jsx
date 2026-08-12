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
  "visa-support": [
    {
      id: "visa-1",
      partnerName: "Global Visa Desk",
      companyName: "WONO Mobility",
      region: "UAE",
      contactPerson: "Aarav Mehta",
      email: "visa.desk@example.com",
      phone: "+971 50 000 1842",
      status: "Active",
      lastUpdated: "2026-08-02",
      notes: "Handles business visa documentation and application guidance.",
    },
    {
      id: "visa-2",
      partnerName: "Nomad Entry Services",
      companyName: "Nomad Assist",
      region: "Portugal",
      contactPerson: "Sara Collins",
      email: "entry@example.com",
      phone: "+351 21 000 0134",
      status: "Pending",
      lastUpdated: "2026-07-28",
      notes: "Pending compliance document verification.",
    },
  ],
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

export const VisaSupportPartnersTable = () => (
  <ValueAddsPartnersTable
    title="Visa Support"
    rows={partnerRows["visa-support"]}
    columns={commonColumns}
  />
);

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
