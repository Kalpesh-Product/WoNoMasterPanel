import { useSelector } from "react-redux";
import TabLayout from "../../../../components/Tabs/TabLayout";
import useAuth from "../../../../hooks/useAuth";

const UploadLayout = () => {
  const { auth } = useAuth(); // ✅ uncommented and used

  const userEmail = auth?.user?.email;

  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
    "er@gmail.com",
  ];

  const tabs = [
    { label: "Company Upload", path: "company-upload" },
    { label: "Products Upload", path: "product-upload" },
    { label: "Bulk Upload Images", path: "bulk-upload-images" },
    { label: "Bulk Reupload Images", path: "bulk-reupload-images" },
    { label: "Upload Single Image", path: "upload-single-image" },
    { label: "News Upload", path: "news-upload" },
    { label: "Blogs Upload", path: "blogs-upload" },
  ];

  // ✅ Filtered tabs for restricted users
  const filteredTabs = restrictedEmails.includes(userEmail)
    ? tabs.filter(
        (tab) =>
          tab.label === "Bulk Upload Images" ||
          tab.label === "Bulk Reupload Images" ||
          tab.label === "Upload Single Image"
      )
    : tabs;

  return (
    <TabLayout
      basePath={"/dashboard/data-upload"}
      tabs={filteredTabs}
      defaultTabPath={
        restrictedEmails.includes(userEmail)
          ? "bulk-upload-images"
          : "company-upload"
      }
    />
  );
};

export default UploadLayout;
