import React from "react";
import ValueAddsLeadsTable from "./ValueAddsLeadsTable";

export const VisaSupportTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/visa-support"
    queryKey="visa-support"
    columns={[
      { field: "visaType", headerName: "VISA Type" },
      { field: "fullName", headerName: "Full Name" },
      { field: "nationality", headerName: "Nationality" },
      { field: "travellingCountry", headerName: "Travelling Country" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "comments", headerName: "Comments" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);

export const OverallActivationSupportTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/overall-activation-support"
    queryKey="overall-activation-support"
    columns={[
      { field: "supportRequired", headerName: "Support Required" },
      { field: "fullName", headerName: "Full Name" },
      { field: "nationalityOnPassport", headerName: "Nationality" },
      { field: "travelCountry", headerName: "Travel Country" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "comments", headerName: "Comments" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);

export const NewCompanySetupTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/new-company-setup"
    queryKey="new-company-setup"
    columns={[
      { field: "supportRequired", headerName: "Support Required" },
      { field: "fullName", headerName: "Full Name" },
      { field: "currentCompanyCountry", headerName: "Current Company Country" },
      { field: "newCompanyCountry", headerName: "New Company Country" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "comments", headerName: "Comments" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);

export const ConsultationTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/consultation"
    queryKey="consultation"
    columns={[
      { field: "supportRequired", headerName: "Support Required" },
      { field: "fullName", headerName: "Full Name" },
      { field: "currentCountry", headerName: "Current Country" },
      { field: "consultationCountry", headerName: "Consultation Country" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "comments", headerName: "Comments" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);

export const WorkationTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/workation"
    queryKey="workation"
    columns={[
      { field: "noOfPeople", headerName: "No. Of People" },
      { field: "fullName", headerName: "Full Name" },
      { field: "companyName", headerName: "Company Name" },
      { field: "companyWebsite", headerName: "Company Website" },
      { field: "currentCountry", headerName: "Current Country" },
      { field: "workationCountry", headerName: "Workation Country" },
      { field: "startDate", headerName: "Start Date" },
      { field: "endDate", headerName: "End Date" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "comments", headerName: "Comments" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);

export const BecomeAContributorTable = () => (
  <ValueAddsLeadsTable
    endpoint="/api/become-contributor"
    queryKey="become-contributor"
    columns={[
      { field: "contributionType", headerName: "Contribution Type" },
      { field: "fullName", headerName: "Full Name" },
      { field: "currentCountry", headerName: "Current Country" },
      { field: "linkedinProfile", headerName: "LinkedIn Profile" },
      { field: "email", headerName: "Email" },
      { field: "contactCode", headerName: "Contact Code" },
      { field: "contactNumber", headerName: "Contact Number" },
      { field: "message", headerName: "Message" },
      { field: "createdAt", headerName: "Submitted At" },
    ]}
  />
);
