import TabLayout from "../../../components/Tabs/TabLayout";

const ValueAddsLeads = () => {
  const tabItems = [
    {
      label: "VISA Support",
      path: "visa-support",
      heading: "VISA Support Leads",
      description: "Enquiries received for visa assistance and travel support.",
    },
    {
      label: "Overall Activation",
      path: "overall-activation-support",
      heading: "Overall Activation Support",
      description: "Requests for activation and onboarding support services.",
    },
    {
      label: "New Company Setup",
      path: "new-company-setup",
      heading: "New Company Setup",
      description: "Enquiries for setting up a new company or entity.",
    },
    {
      label: "Consultation",
      path: "consultation",
      heading: "Consultation Leads",
      description: "Consultation requests from potential and existing clients.",
    },
    {
      label: "Workation",
      path: "workation",
      heading: "Workation Leads",
      description: "Workation booking enquiries and group trip requests.",
    },
    {
      label: "Contributor",
      path: "become-a-contributor",
      heading: "Become A Contributor",
      description: "Applications from individuals looking to contribute content or services.",
    },
  ];

  return (
    <TabLayout
      basePath="/dashboard/value-adds-leads"
      tabs={tabItems}
      defaultTabPath="visa-support"
    />
  );
};

export default ValueAddsLeads;
