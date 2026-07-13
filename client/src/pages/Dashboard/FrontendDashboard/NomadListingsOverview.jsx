import { useState } from "react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useMutation, useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import { toast } from "sonner";
import { queryClient } from "../../../main";
import StatusChip from "../../../components/StatusChip";
import MuiModal from "../../../components/MuiModal";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const CONTINENT_OPTIONS = [
  "Asia",
  "Europe",
  "Africa",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

export default function NomadListingsOverview({
  hideTransfer = false,
  companyIdOverride,
  companyNameOverride,
  showTransferToCompanyButton = false,
  transferToCompanyData = {},
} = {}) {
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedHostCompanyId, setSelectedHostCompanyId] = useState("");
  const [isTransferToCompanyModalOpen, setIsTransferToCompanyModalOpen] = useState(false);
  const [transferToCompanyContinent, setTransferToCompanyContinent] = useState(
    transferToCompanyData?.companyContinent || "",
  );
  const navigate = useNavigate();
  // const location = useLocation();
  // const { companyId } = location?.state || "";

  // backward navigation support
  const location = useLocation();
  const navState = location?.state || {};
  const axios = useAxiosPrivate();
  const nativeCompanyId =
    companyIdOverride ||
    navState.companyId ||
    sessionStorage.getItem("companyId") ||
    "";
  const companyName =
    companyNameOverride ||
    navState.companyName ||
    sessionStorage.getItem("companyName") ||
    "";

  // A Companies-page entry created via the "Companies Requests" flow has no
  // Nomads company of its own — the real data lives under the Host
  // Company's own companyId (`linkedHostCompanyId`). Only resolve this when
  // no override was passed in (Host-Companies reuse already resolved its
  // own correct id via HostCompanyNomadListingOverview).
  const shouldResolveSource = !companyIdOverride;

  const { data: sourceMeta, isPending: isSourceResolving } = useQuery({
    queryKey: ["nomad-source", nativeCompanyId],
    enabled: shouldResolveSource && !!nativeCompanyId,
    queryFn: async () => {
      const res = await axios.get(
        `/api/hosts/companies/${nativeCompanyId}/nomad-source`,
      );
      return res.data || {};
    },
  });

  const companyId = shouldResolveSource
    ? sourceMeta?.effectiveNomadsCompanyId || nativeCompanyId
    : nativeCompanyId;

  // ✅ Fetch listings of a company
  const { data: listings = [], isPending } = useQuery({
    queryKey: ["nomad-listings", companyId],
    enabled: !!companyId && (!shouldResolveSource || !isSourceResolving),
    queryFn: async () => {
      const res = await axios.get(
        `${NOMADS_API_BASE_URL}/company/get-listings/${companyId}`,
      );

      return res.data || [];
    },
  });

  // ✅ Fetch all Host Lead Companies for the transfer dropdown
  const { data: hostCompanies = [] } = useQuery({
    queryKey: ["hostCompaniesList"],
    enabled: isTransferModalOpen,
    queryFn: async () => {
      const res = await axios.get("/api/hosts/host-companies");
      return res.data || [];
    },
  });

  const { mutate: transferListing, isPending: isTransferring } = useMutation({
    mutationFn: async (hostCompanyId) => {
      const response = await axios.post("/api/hosts/transfer-nomad-listing", {
        nomadsCompanyId: companyId,
        hostCompanyId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Products linked to Host Company");
      setIsTransferModalOpen(false);
      setSelectedHostCompanyId("");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to link products to Host Company",
      );
    },
  });

  const { mutate: transferToCompany, isPending: isTransferringToCompany } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `/api/hosts/companies-requests/${transferToCompanyData.companyId}/approve`,
        {
          companyName: transferToCompanyData.companyName,
          companyCity: transferToCompanyData.companyCity,
          companyState: transferToCompanyData.companyState,
          companyCountry: transferToCompanyData.companyCountry,
          companyContinent: transferToCompanyContinent,
        },
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Company created");
      setIsTransferToCompanyModalOpen(false);
      navigate("/dashboard/companies");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create company");
    },
  });

  const { mutate: toggleStatus, isPending: isToggle } = useMutation({
    mutationFn: async (data) => {
      const response = await axios.patch("/api/hosts/activate-product", data);
      return response.data;

      // console.log("Data from mutauton",data)
    },
    onSuccess: (data) => {
      toast.success(data.message || "PRODUCT ACTIVATED");
      queryClient.invalidateQueries({ queryKey: ["nomad-listings"] });
    },
    onError: (error) => {
      console.log("error", error);
    },
  });

  // ✅ Table data
  const tableData = !isPending
    ? listings?.map((item, index) => ({
      ...item,
      srNo: index + 1,
      businessId: item.businessId,
      companyName: item.companyName,
      companyType: item.companyType,
      city: item.city,
      state: item.state,
      country: item.country,
      ratings: item.ratings,
      totalReviews: item.totalReviews,
    }))
    : [];

  // ✅ Table columns
  const columns = [
    {
      headerName: "SR NO",
      field: "srNo",
      width: 100,
      minWidth: 80,
    },
    {
      headerName: "Company Name",
      field: "companyName",
      flex: 1,
      minWidth: 200,
    },
    {
      headerName: "Company Title",
      field: "companyTitle",
      flex: 1,
      minWidth: 200,
    },
    {
      headerName: "Company Type",
      field: "companyType",
      flex: 1,
      minWidth: 160,
    },
    {
      headerName: "Status",
      field: "isActive",
      flex: 1,
      minWidth: 140,
      cellRenderer: (params) => (
        <StatusChip status={params.value ? "Active" : "Inactive"} />
      ),
    },
    {
      headerName: "Actions",
      field: "actions",
      flex: 1,
      minWidth: 140,
      cellRenderer: (params) => {
        return (
          <ThreeDotMenu
            rowId={params.data.id}
            menuItems={[
              {
                label: "Edit",
                onClick: () => {
                  sessionStorage.setItem("companyId", companyId || "");
                  sessionStorage.setItem(
                    "companyName",
                    params?.data?.companyName || "",
                  );
                  sessionStorage.setItem(
                    "businessId",
                    params?.data?.businessId || "",
                  );
                  navigate(
                    `/dashboard/companies/${slugify(
                      params?.data?.companyName,
                    )}/nomad-listings/${slugify(params?.data?.companyName)}`,
                    {
                      state: {
                        website: params.data,
                        companyId,
                        isLoading: isPending,
                      },
                    },
                  );
                },
              },
              params?.data?.isActive
                ? {
                  label: "Mark As Inactive",
                  onClick: () =>
                    toggleStatus({
                      businessId: params?.data?.businessId,
                      status: false,
                    }),
                }
                : {
                  label: "Mark As Active",
                  onClick: () =>
                    toggleStatus({
                      businessId: params?.data?.businessId,
                      status: true,
                    }),
                },
            ]}
          />
        );
      },
    },
  ];

  // ✅ helper to make slugs URL-safe
  const slugify = (str) =>
    str
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");

  // ✅ Navigate to Add Listing form
  const handleAddClick = () => {
    // navigate(
    //   `/dashboard/companies/${slugify(
    //     listings?.[0]?.companyName
    //   )}/nomad-listings/add`,
    //   {
    //     state: { companyId }, // keep companyId for backend usage
    //   }
    // );

    // backward navigation support
    const nameForUrl = companyName || listings?.[0]?.companyName || "";
    navigate(`/dashboard/companies/${slugify(nameForUrl)}/nomad-listings/add`, {
      state: { companyId },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <>
        <AgTable
          data={tableData}
          columns={columns}
          search
          tableTitle="Nomad Listings"
          loading={isPending}
          buttonTitle="Add Product"
          handleClick={handleAddClick}
          secondaryButtonTitle={
            showTransferToCompanyButton
              ? "Transfer to Company"
              : hideTransfer
                ? undefined
                : "Transfer"
          }
          onSecondaryButtonClick={
            showTransferToCompanyButton
              ? () => setIsTransferToCompanyModalOpen(true)
              : hideTransfer
                ? undefined
                : () => setIsTransferModalOpen(true)
          }
          secondaryButtonDisabled={!listings.length}
        />
      </>

      {!hideTransfer && (
      <MuiModal
        open={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setSelectedHostCompanyId("");
        }}
        title="Transfer Products to Host Company"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            This links ALL of this company's Nomads products to the Host
            Company you select below — it does not move or duplicate the
            data, it only connects the two so every product shows up on that
            Host Company's page too.
          </p>

          <select
            className="w-full border border-borderGray rounded-lg p-2 text-sm"
            value={selectedHostCompanyId}
            onChange={(e) => setSelectedHostCompanyId(e.target.value)}
          >
            <option value="">Select a Host Company</option>
            {hostCompanies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyName}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2 pt-2">
            <PrimaryButton
              type="button"
              title={isTransferring ? "Transferring..." : "Confirm Transfer"}
              disabled={!selectedHostCompanyId || isTransferring}
              handleSubmit={() => transferListing(selectedHostCompanyId)}
            />
          </div>
        </div>
      </MuiModal>
      )}

      {showTransferToCompanyButton && (
        <MuiModal
          open={isTransferToCompanyModalOpen}
          onClose={() => setIsTransferToCompanyModalOpen(false)}
          title="Transfer to Company"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              This creates a new entry in Companies for "{transferToCompanyData?.companyName}
              ", linked back to this host's already-existing Nomads listing(s) — nothing gets
              duplicated or moved in Nomads. Staff can add the remaining details (industry,
              logo, etc.) from the Companies page afterward.
            </p>

            <select
              className="w-full border border-borderGray rounded-lg p-2 text-sm"
              value={transferToCompanyContinent}
              onChange={(e) => setTransferToCompanyContinent(e.target.value)}
            >
              <option value="">Select Continent</option>
              {CONTINENT_OPTIONS.map((continent) => (
                <option key={continent} value={continent}>
                  {continent}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <PrimaryButton
                type="button"
                title={isTransferringToCompany ? "Transferring..." : "Confirm Transfer"}
                disabled={!transferToCompanyContinent || isTransferringToCompany}
                handleSubmit={() => transferToCompany()}
              />
            </div>
          </div>
        </MuiModal>
      )}
    </div>
  );
}
