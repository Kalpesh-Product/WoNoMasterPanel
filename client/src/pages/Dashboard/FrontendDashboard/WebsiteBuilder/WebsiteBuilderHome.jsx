import { useEffect, useRef, useState } from "react";
import { LuHardDriveUpload } from "react-icons/lu";
import { SiGoogleadsense } from "react-icons/si";
import { MdOutlineRateReview } from "react-icons/md";
import { MdOutlineWorkHistory } from "react-icons/md";
import { Loader2 } from "lucide-react";
import Card from "../../../../components/Card";
import PageFrame from "../../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";

// Mirrors HostPanel's WebsiteBuilderTypeActions — templates are sometimes
// stored with a companyId from a different source than the session one, so a
// companyId mismatch must still fall through to workspace/business-name checks.
const isSameCompanyTemplate = ({ website, companyId, workspaceId, businessName }) => {
  const websiteCompanyId = String(website?.companyId || "").trim();
  const websiteWorkspaceId = String(website?.workspaceId || "").trim();
  const websiteCompanyName = String(website?.companyName || "")
    .trim()
    .toLowerCase();
  const normalizedBusinessName = String(businessName || "").trim().toLowerCase();

  if (companyId && websiteCompanyId === String(companyId).trim()) return true;
  if (workspaceId && websiteWorkspaceId === String(workspaceId).trim()) return true;
  if (normalizedBusinessName && websiteCompanyName === normalizedBusinessName)
    return true;
  return false;
};

const WebsiteBuilderHome = () => {
  const axios = useAxiosPrivate();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const [existingWebsite, setExistingWebsite] = useState(null);
  const [isCheckingWebsite, setIsCheckingWebsite] = useState(true);
  const hasCheckedWebsiteRef = useRef(false);

  const companyId = String(
    selectedCompany?.companyId || sessionStorage.getItem("companyId") || "",
  ).trim();
  const workspaceId = String(selectedCompany?.workspaceId || "").trim();
  const businessName = String(
    selectedCompany?.companyName || sessionStorage.getItem("companyName") || "",
  ).trim();
  const selectedTemplate = selectedCompany?.websiteTemplate || null;

  useEffect(() => {
    hasCheckedWebsiteRef.current = false;
    setExistingWebsite(selectedTemplate);
  }, [companyId, workspaceId, businessName, selectedTemplate]);

  useEffect(() => {
    const checkExistingWebsite = async () => {
      if (hasCheckedWebsiteRef.current) return;

      try {
        setIsCheckingWebsite(true);
        if (!companyId && !businessName) {
          setExistingWebsite(null);
          return;
        }

        const response = await axios.get("/api/editor/get-websites", {
          params: {
            ...(workspaceId ? { workspaceId } : {}),
            ...(companyId ? { companyId } : {}),
            ...(businessName ? { businessName } : {}),
          },
        });
        const websites = Array.isArray(response?.data) ? response.data : [];
        const found =
          websites.find((website) =>
            isSameCompanyTemplate({ website, companyId, workspaceId, businessName }),
          ) || selectedTemplate || null;

        hasCheckedWebsiteRef.current = true;
        setExistingWebsite(found);
      } catch (error) {
        hasCheckedWebsiteRef.current = true;
        setExistingWebsite(null);
      } finally {
        setIsCheckingWebsite(false);
      }
    };

    checkExistingWebsite();
  }, [axios, companyId, workspaceId, businessName, selectedTemplate]);

  const hasExistingWebsite = Boolean(existingWebsite);
  const createOrEditLabel = hasExistingWebsite ? "Edit Website" : "Create Website";

  const handleCreateOrEditClick = () => {
    if (hasExistingWebsite) {
      const editSearchKey = String(existingWebsite?.searchKey || "").trim();
      navigate("edit-website", {
        state: {
          searchKey: editSearchKey,
          companyName: existingWebsite?.companyName,
          website: existingWebsite,
        },
      });
      return;
    }
    navigate("create-website");
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <PageFrame>
        <div className="flex flex-col gap-5">
          <h2 className="text-title font-pmedium text-primary uppercase">
            Website Builder
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isCheckingWebsite ? (
              <div className="flex h-full min-h-[140px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-md">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking Website...
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={handleCreateOrEditClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCreateOrEditClick();
                  }
                }}
                className="cursor-pointer"
              >
                <Card
                  icon={<LuHardDriveUpload />}
                  title={createOrEditLabel}
                  route={location.pathname}
                />
              </div>
            )}
            <Card icon={<SiGoogleadsense />} title="Website Leads" route="leads" />
            <Card icon={<MdOutlineRateReview />} title="Website Review" route="reviews" />
            <Card icon={<MdOutlineWorkHistory />} title="Careers" route="careers" />
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default WebsiteBuilderHome;
