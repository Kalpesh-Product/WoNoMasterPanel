import TabLayout from "../../../components/Tabs/TabLayout";

const CompaniesLayout = () => {
  const tabs = [
    {
      label: "Companies",
      path: "list",
      heading: "Companies",
      description:
        "Review the company registry, update registration status, and open related views from the same panel.",
    },
    {
      label: "Requests",
      path: "requests",
      heading: "Companies Requests",
      description: "Review and approve company listing requests from hosts.",
    },
    {
      label: "Verify Listings Claims",
      path: "claims",
      heading: "Verify Listings Claims",
      description:
        "Hosts who say their listings already exist on wono.co. Check their documents, open the listings, then approve to transfer or reject with a reason.",
    },
  ];

  return (
    <TabLayout tabs={tabs} basePath="/dashboard/companies" defaultTabPath="list" />
  );
};

export default CompaniesLayout;
