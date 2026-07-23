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
  ];

  return (
    <TabLayout tabs={tabs} basePath="/dashboard/companies" defaultTabPath="list" />
  );
};

export default CompaniesLayout;
