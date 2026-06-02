import TabLayout from "../../../components/Tabs/TabLayout";

const ValueAddsLeads = () => {
  const tabItems = [
    { label: "VISA Support", path: "visa-support" },
    {
      label: "Overall Activation Support",
      path: "overall-activation-support",
    },
    { label: "New Company Setup", path: "new-company-setup" },
    { label: "Consultation", path: "consultation" },
    { label: "Workation", path: "workation" },
    { label: "Become A Contributor", path: "become-a-contributor" },
  ];

  return (
    <TabLayout
      basePath="/dashboard/value-adds-leads"
      tabs={tabItems}
      defaultTabPath="visa-support"
      tabUiVariant="glass"
    />
  );
};

export default ValueAddsLeads;
