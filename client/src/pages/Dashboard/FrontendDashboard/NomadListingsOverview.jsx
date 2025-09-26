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

export default function NomadListingsOverview() {
  const navigate = useNavigate();
  // const location = useLocation();
  // const { companyId } = location?.state || "";

  // backward navigation support
  const location = useLocation();
  const navState = location?.state || {};
  const axios = useAxiosPrivate();
  const companyId =
    navState.companyId || sessionStorage.getItem("companyId") || "";
  const companyName =
    navState.companyName || sessionStorage.getItem("companyName") || "";

  // ✅ Fetch listings of a company
  const { data: listings = [], isPending } = useQuery({
    queryKey: ["nomad-listings", companyId],
    queryFn: async () => {
      const res = await axios.get(
        `https://wononomadsbe.vercel.app/api/company/get-listings/${companyId}`
      );

      return res.data || [];
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
    { headerName: "SR NO", field: "srNo", width: 100 },
    // { headerName: "Business ID", field: "businessId", flex: 1 },
    { headerName: "Company Name", field: "companyName", flex: 1 },
    { headerName: "Company Type", field: "companyType", flex: 1 },
    {
      headerName: "Status",
      field: "isActive",
      flex: 1,
      cellRenderer: (params) => (
        <StatusChip status={params.value ? "Active" : "Inactive"} />
      ),
    },
    {
      headerName: "Actions",
      field: "actions",
      flex: 1,
      cellRenderer: (params) => {
        return (
          <ThreeDotMenu
            rowId={params.data.id}
            menuItems={[
              {
                label: "Edit",
                onClick: () => {
                  // persist for backward/refresh navigation
                  sessionStorage.setItem("companyId", companyId || "");
                  sessionStorage.setItem(
                    "companyName",
                    params?.data?.companyName || ""
                  );
                  sessionStorage.setItem(
                    "businessId",
                    params?.data?.businessId || ""
                  );
                  navigate(
                    `/dashboard/companies/${slugify(
                      params?.data?.companyName
                    )}/nomad-listings/${slugify(params?.data?.companyName)}`,
                    {
                      state: {
                        website: params.data,
                        companyId, // still pass companyId
                        isLoading: isPending,
                      },
                    }
                  );
                },
              },

              params?.data?.isActive
                ? {
                    label: "Deactivate Listing",
                    onClick: () => {
                      toggleStatus({
                        businessId: params?.data?.businessId,
                        status: false, // deactivate
                      });
                    },
                  }
                : {
                    label: "Activate Listing",
                    onClick: () => {
                      toggleStatus({
                        businessId: params?.data?.businessId,
                        status: true, // activate
                      });
                    },
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
    <div className="p-4 flex flex-col gap-4">
      <PageFrame>
        {/* ✅ PrimaryButton above table */}
        {/* <div className="flex justify-end pb-4">
          <PrimaryButton
            type="button"
            title="Add Listing"
            handleSubmit={handleAddClick}
          />
        </div> */}

        <AgTable
          data={tableData}
          columns={columns}
          search
          tableTitle="Nomad Listings"
          loading={isPending}
          buttonTitle="Add Product"
          handleClick={handleAddClick}
        />
      </PageFrame>
    </div>
  );
}
