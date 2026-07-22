import TabLayout from "../../../components/Tabs/TabLayout";

const AllLeads = () => {
  const tabItems = [
    {
      label: "All Enquiry",
      path: "all-enquiry",
      heading: "All Enquiry",
      description: "Review website and Nomads leads, complete the Master workflow, then escalate closed leads to HostPanel.",
    },
    {
      label: "All POC Contact",
      path: "all-poc-contact",
      heading: "All POC Contact",
      description: "View all point of contact submissions from partners and businesses.",
    },
    {
      label: "Connect With Us",
      path: "connect-with-us",
      heading: "Connect With Us",
      description: "Manage partnership and collaboration enquiries.",
    },
    {
      label: "Job Applications",
      path: "job-applications",
      heading: "Job Applications",
      description: "Review and manage incoming job applications.",
    },
  ];

  return (
    <TabLayout
      basePath="/dashboard/all-leads"
      tabs={tabItems}
      defaultTabPath="all-enquiry"
    />
  );
};

export default AllLeads;
