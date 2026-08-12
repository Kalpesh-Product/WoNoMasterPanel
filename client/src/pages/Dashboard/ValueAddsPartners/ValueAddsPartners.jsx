import TabLayout from "../../../components/Tabs/TabLayout";

const ValueAddsPartners = () => {
  const tabs = [
    {
      label: "Visa Support",
      path: "visa-support",
      heading: "Visa Support Partners",
      description: "Review partner records for visa assistance and travel documentation support.",
    },
    {
      label: "Activation Support",
      path: "activation-support",
      heading: "Activation Support Partners",
      description: "Review partners supporting onboarding, activation, and market enablement.",
    },
    {
      label: "Company Setup",
      path: "company-setup",
      heading: "Company Setup Partners",
      description: "Review partners who assist with entity formation and company setup services.",
    },
    {
      label: "Consultation",
      path: "consultation",
      heading: "Consultation Partners",
      description: "Review advisors and consultants available for partner support workflows.",
    },
    {
      label: "Workation",
      path: "workation",
      heading: "Workation Partners",
      description: "Review partners supporting workation packages, stays, and travel experiences.",
    },
    {
      label: "Become a Contributor",
      path: "become-a-contributor",
      heading: "Become a Contributor",
      description: "Review contributor partner profiles and collaboration readiness.",
    },
  ];

  return (
    <TabLayout
      tabs={tabs}
      basePath="/dashboard/value-adds-partners"
      defaultTabPath="visa-support"
    />
  );
};

export default ValueAddsPartners;
