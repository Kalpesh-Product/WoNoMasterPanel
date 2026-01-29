import TabLayout from "../../../components/Tabs/TabLayout";

const AllLeads = () => {
  const tabItems = [
    { label: "All Enquiry", path: "all-enquiry" },
    { label: "All POC Contact", path: "all-poc-contact" },
    { label: "Connect With Us", path: "connect-with-us" },
    { label: "Job Applications", path: "job-applications" },
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
