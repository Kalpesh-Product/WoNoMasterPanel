import { useSelector } from "react-redux";
import TabLayout from "../../../../components/Tabs/TabLayout";
import useAuth from "../../../../hooks/useAuth";

const UploadLayout = () => {
  const { auth } = useAuth();

  const userEmail = auth?.user?.email;

  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
    "savita.wono@gmail.com",
    "gourish.wono@gmail.com",
  ];

  const tabs = [
    { label: "Company Upload", path: "company-upload", heading: "Company Upload", description: "Upload and manage company data." },
    { label: "Products Upload", path: "product-upload", heading: "Products Upload", description: "Upload and manage product data." },
    { label: "Bulk Upload Images", path: "bulk-upload-images", heading: "Bulk Upload Images", description: "Upload images in bulk for companies and products." },
    { label: "Bulk Reupload Images", path: "bulk-reupload-images", heading: "Bulk Reupload Images", description: "Re-upload images that failed or need updating." },
    { label: "Upload Single Image", path: "upload-single-image", heading: "Upload Single Image", description: "Upload a single image file." },
    { label: "News Upload", path: "news-upload", heading: "News Upload", description: "Upload and manage news articles." },
    { label: "Blogs Upload", path: "blogs-upload", heading: "Blogs Upload", description: "Upload and manage blog posts." },
    { label: "Events Upload", path: "events-upload", heading: "Events Upload", description: "Upload and manage events." },
    { label: "Places Upload", path: "places-upload", heading: "Places Upload", description: "Upload and manage places." },
    { label: "Restaurants Upload", path: "restaurants-upload", heading: "Restaurants Upload", description: "Upload and manage restaurants." },
  ];

  const filteredTabs = restrictedEmails.includes(userEmail)
    ? tabs.filter(
      (tab) =>
        tab.label === "Bulk Upload Images" ||
        tab.label === "Bulk Reupload Images" ||
        tab.label === "Upload Single Image",
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
