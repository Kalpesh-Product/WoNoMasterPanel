import { useSelector } from "react-redux";
import TabLayout from "../../../../components/Tabs/TabLayout";
import useAuth from "../../../../hooks/useAuth";

const UploadLayout = () => {
  const { auth } = useAuth();

  const userEmail = auth?.user?.email;

  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
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
    { label: "Bulk Restaurant Images Upload", path: "bulk-restaurant-images-upload", heading: "Bulk Restaurant Images Upload", description: "Upload images in bulk for restaurants." },
    { label: "Restaurant Logo Upload", path: "restaurant-logo-upload", heading: "Restaurant Logo Upload", description: "Upload a logo for a restaurant." },
    { label: "Add Destination Data", path: "destination-add-upload", heading: "Add Destination Data", description: "Upload a new destination's business-listing workbook." },
    { label: "Reupload Destination Data", path: "destination-reupload", heading: "Reupload Destination Data", description: "Replace an already-uploaded destination's listings with a new file." },
    { label: "Listings Data Update", path: "listings-data-update", heading: "Listings Data Update", description: "Refresh ratings, review counts and inactive status for live nomad listings." },
    { label: "World Ranking Weights Upload", path: "world-ranking-weights-upload", heading: "World Ranking Weights Upload", description: "Preview and apply Algo 2.0 weight changes from a CSV — dry run first, then commit." },
    { label: "Visa Rules V2 Upload", path: "visa-rules-v2-upload", heading: "Visa Rules V2 Upload", description: "Import visa rules from a single CSV — dry run first, then confirm." },
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
