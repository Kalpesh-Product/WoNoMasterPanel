import { useSelector } from "react-redux";
import TabLayout from "../../../../components/Tabs/TabLayout";


const UploadLayout = () => {

  const tabs = [
    { label: "Company Upload", path: "company-upload" },
    { label: "Product Upload", path: "assets-sub-categories" },
  ];

  return (
    <TabLayout
      basePath={'/dashboard/data-upload'}
      tabs={tabs}
      defaultTabPath="company-upload"
    />
  );
};

export default UploadLayout;
