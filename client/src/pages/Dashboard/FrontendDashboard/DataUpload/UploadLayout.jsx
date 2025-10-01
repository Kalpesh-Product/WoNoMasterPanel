import { useSelector } from "react-redux";
import TabLayout from "../../../../components/Tabs/TabLayout";

const UploadLayout = () => {
  const tabs = [
    { label: "Company Upload", path: "company-upload" },
    { label: "Products Upload", path: "product-upload" },
    { label: "Bulk Upload Images", path: "bulk-upload-images" },
    { label: "Upload Single Image", path: "upload-single-image" },
    { label: "News Upload", path: "news-upload" },
    { label: "Blogs Upload", path: "blogs-upload" },
  ];

  return (
    <TabLayout
      basePath={"/dashboard/data-upload"}
      tabs={tabs}
      defaultTabPath="company-upload"
    />
  );
};

export default UploadLayout;
