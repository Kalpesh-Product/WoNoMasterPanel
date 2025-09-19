import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useQuery } from "@tanstack/react-query";
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

  // ✅ Table data
  const tableData = !isPending
    ? listings?.map((item, index) => ({
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
              },
            ]}
          />
        );
      },
    },
    // { headerName: "City", field: "city", flex: 1 },
    // { headerName: "State", field: "state", flex: 1 },
    // { headerName: "Country", field: "country", flex: 1 },
    // { headerName: "Ratings", field: "ratings", flex: 1 },
    // { headerName: "Total Reviews", field: "totalReviews", flex: 1 },
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
