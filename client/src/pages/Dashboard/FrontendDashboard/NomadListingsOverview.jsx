import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useMutation, useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ThreeDotMenu from "../../../components/ThreeDotMenu";

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
      console.log("success", data);
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
      headerName: "Actions",
      field: "actions",
      flex: 1,
      cellRenderer: (params) => {
        return (
          <ThreeDotMenu
            rowId={params.data.id}
            menuItems={[
              // {
              //   label: "Mark As Active",
              //   // onClick: () => {
              //   //   markAsActive(params.data.searchKey);
              //   // },
              // },
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

              {
                label: "Activate Listing",
                onClick: () => {
                  toggleStatus({
                    businessId: params?.data?.businessId,
                    status: params?.data?.status || true,
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
