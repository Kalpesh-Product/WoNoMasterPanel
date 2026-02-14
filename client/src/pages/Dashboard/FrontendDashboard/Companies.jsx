// src/pages/Dashboard/FrontendDashboard/Companies.jsx
import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import { Chip } from "@mui/material";
import { useDispatch } from "react-redux";
import { setSelectedCompany } from "../../../redux/slices/companySlice";
import useAuth from "../../../hooks/useAuth";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import { toast } from "sonner";
import { queryClient } from "../../../main";

// ✅ helper to make slugs URL-safe
const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const Companies = () => {
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();
  const dispatch = useDispatch();

  const { auth } = useAuth();

  const { mutate: toggleCompanyStatus } = useMutation({
    mutationFn: async ({ companyId, status }) => {
      const response = await axiosPrivate.patch(
        `/api/admin/registration/${companyId}`,
        {
          status,
        },
      );
      return response.data;
    },
    onMutate: async ({ companyId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["companiesList"] });

      const previousCompanies = queryClient.getQueryData(["companiesList"]);

      queryClient.setQueryData(["companiesList"], (oldCompanies = []) => {
        return oldCompanies.map((company) =>
          company.companyId === companyId
            ? { ...company, isRegistered: status }
            : company,
        );
      });

      return { previousCompanies };
    },
    onSuccess: (data) => {
      toast.success(data?.message || "COMPANY STATUS UPDATED");
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
    },
    onError: (error, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(["companiesList"], context.previousCompanies);
      }

      toast.error(
        error?.response?.data?.message || "Failed to update company status",
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
    },
  });

  const userEmail = auth?.user?.email;
  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
    "savita.wono@gmail.com",
    "gourish.wono@gmail.com",
    "vishal.wono@gmail.com",
  ];
  const isRestrictedUser = restrictedEmails.includes(userEmail);

  useEffect(() => {
    if (isRestrictedUser) {
      navigate("/dashboard/data-upload/bulk-upload-images", { replace: true });
    }
  }, [isRestrictedUser, navigate]);

  // ✅ fetch companies from API
  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesList"],
    enabled: !isRestrictedUser,
    queryFn: async () => {
      try {
        const response = await axiosPrivate.get("/api/hosts/companies");
        return response.data; // backend should return an array of companies
      } catch (error) {
        throw new Error(
          error.response?.data?.message || "Failed to fetch companies",
        );
      }
    },
  });

  // ✅ define columns with logo, name, type, location
  const columns = useMemo(
    () => [
      {
        field: "logo",
        headerName: "Logo",
        width: 80,
        cellRenderer: (params) => {
          const logoUrl =
            typeof params.value === "string" ? params.value : params.value?.url;
          return logoUrl ? (
            <img
              src={logoUrl}
              alt="logo"
              className="h-10 w-10 object-contain rounded"
            />
          ) : (
            "-"
          );
        },
      },
      {
        field: "companyName",
        headerName: "Company Name",
        flex: 1,
        cellRenderer: (params) => {
          return (
            <span
              onClick={() => {
                dispatch(setSelectedCompany(params.data));

                // for backward navigating
                sessionStorage.setItem("companyId", params.data.companyId);
                sessionStorage.setItem("companyName", params.data.companyName);

                navigate(
                  `/dashboard/companies/${slugify(params.data.companyName)}`,

                  // for backward navigation
                  {
                    state: {
                      companyId: params.data.companyId,
                      companyName: params.data.companyName,
                    },
                  },
                );
              }}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              {params.value}
            </span>
          );
        },
      },
      // { field: "companyType", headerName: "Type", flex: 1 },
      {
        field: "companyContinent",
        headerName: "Continent",
        flex: 1,
        cellRenderer: (params) => params.value || "-",
      },
      {
        field: "companyCountry",
        headerName: "Country",
        flex: 1,
        cellRenderer: (params) => params.value || "-",
      },
      {
        field: "companyState",
        headerName: "State",
        flex: 1,
        cellRenderer: (params) => params.value || "-",
      },
      {
        field: "companyCity",
        headerName: "City",
        flex: 1,
        cellRenderer: (params) => params.value || "-",
      },
      {
        field: "isRegistered",
        headerName: "Registration",
        flex: 1,
        valueGetter: (params) => {
          return params.data.isRegistered ? "Active" : "Inactive";
        },
        cellRenderer: (params) => {
          const value = params.value; // "Active" | "Inactive"

          const statusColorMap = {
            Active: { backgroundColor: "#90EE90", color: "#006400" },
            Inactive: { backgroundColor: "#FFC5C5", color: "#8B0000" },
          };

          const { backgroundColor, color } = statusColorMap[value] || {
            backgroundColor: "gray",
            color: "white",
          };

          return (
            <Chip
              label={value}
              style={{ backgroundColor, color }}
              size="small"
            />
          );
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={
              params?.data?.companyId ||
              params?.data?._id ||
              params?.data?.companyName
            }
            menuItems={[
              params?.data?.isRegistered
                ? {
                    label: "Mark As Inactive",
                    onClick: () =>
                      toggleCompanyStatus({
                        companyId: params?.data?.companyId,
                        status: false,
                      }),
                  }
                : {
                    label: "Mark As Active",
                    onClick: () =>
                      toggleCompanyStatus({
                        companyId: params?.data?.companyId,
                        status: true,
                      }),
                  },
              {
                label: "Edit",
                onClick: () => {
                  dispatch(setSelectedCompany(params.data));
                  sessionStorage.setItem("companyId", params.data.companyId);
                  sessionStorage.setItem(
                    "companyName",
                    params.data.companyName,
                  );
                  navigate(
                    `/dashboard/companies/edit-company/${params.data.companyId}`,
                    {
                      state: {
                        companyId: params.data.companyId,
                        companyName: params.data.companyName,
                      },
                    },
                  );
                },
              },
            ]}
          />
        ),
      },
    ],
    [dispatch, navigate, toggleCompanyStatus],
  );

  // ✅ sort companies: Active first, then Inactive
  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      if (a.isRegistered === b.isRegistered) return 0;
      return a.isRegistered ? -1 : 1; // Active first
    });
  }, [companies]);

  if (isLoading) return <div className="p-6">Loading companies…</div>;
  if (isError)
    return <div className="p-6 text-red-500">Failed to load companies.</div>;

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={sortedCompanies}
          columns={columns}
          search={true}
          tableTitle={"Companies"}
          tableHeight={500}
          buttonTitle={"Add Company"}
          handleClick={() => navigate("add-company")}
          filterExcludeColumns={["logo", "isRegistered"]}
          loading={isLoading}
        />
      </PageFrame>
    </div>
  );
};

export default Companies;
