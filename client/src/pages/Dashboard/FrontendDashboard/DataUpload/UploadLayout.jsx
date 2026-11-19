import TabLayout from "../../../../components/Tabs/TabLayout";
import useAuth from "../../../../hooks/useAuth";

// Tab keys are the same `path` strings below — must stay in sync with
// server/config/masterPanelModules.js's dashboard.data-upload.tabs.
const DATA_UPLOAD_KEY = "dashboard.data-upload";

const UploadLayout = () => {
  const { auth } = useAuth();

  const allowedModules = auth?.user?.allowedModules || [];
  const isSuperAdmin = Boolean(auth?.user?.isSuperAdmin);
  const hasBareKey = allowedModules.includes(DATA_UPLOAD_KEY);

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
    { label: "Restaurant Images Reupload", path: "restaurant-images-reupload", heading: "Restaurant Images Reupload", description: "Replace an existing restaurant gallery with a complete set of photos." },
    { label: "Restaurant Logo Upload", path: "restaurant-logo-upload", heading: "Restaurant Logo Upload", description: "Upload a logo for a restaurant." },
    { label: "Add Destination Data", path: "destination-add-upload", heading: "Add Destination Data", description: "Upload a new destination's business-listing workbook." },
    { label: "Reupload Destination Data", path: "destination-reupload", heading: "Reupload Destination Data", description: "Replace an already-uploaded destination's listings with a new file." },
    { label: "Listings Data Update", path: "listings-data-update", heading: "Listings Data Update", description: "Refresh ratings, review counts and inactive status for live nomad listings." },
  ];

  // The bare key is just the on/off gate — which tabs show comes from the
  // explicit per-tab keys. A grant with the bare key but none of those
  // (either fresh, or from before tabs existed) defaults to every tab.
  const hasAnyExplicitTab = tabs.some((tab) =>
    allowedModules.includes(`${DATA_UPLOAD_KEY}.${tab.path}`),
  );
  const filteredTabs =
    isSuperAdmin || (hasBareKey && !hasAnyExplicitTab)
      ? tabs
      : tabs.filter((tab) =>
          allowedModules.includes(`${DATA_UPLOAD_KEY}.${tab.path}`),
        );

  if (filteredTabs.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        You don't have access to any Data Upload tabs. Ask a superadmin to
        grant them via User Access.
      </div>
    );
  }

  return (
    <TabLayout
      basePath={"/dashboard/data-upload"}
      tabs={filteredTabs}
      defaultTabPath={filteredTabs[0].path}
    />
  );
};

export default UploadLayout;
