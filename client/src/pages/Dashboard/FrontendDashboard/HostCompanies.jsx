import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip } from "@mui/material";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import { setSelectedCompany } from "../../../redux/slices/companySlice";

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const HostCompanies = () => {
    const navigate = useNavigate();
    const axiosPrivate = useAxiosPrivate();
    const dispatch = useDispatch();
    const { auth } = useAuth();

    const { mutate: toggleCompanyStatus } = useMutation({
        mutationFn: async ({ companyId, status }) => {
            const response = await axiosPrivate.patch(
                `/api/admin/registration/${companyId}`,
                { status },
            );
            return response.data;
        },
        onMutate: async ({ companyId, status }) => {
            await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });

            const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);

            queryClient.setQueryData(["hostCompaniesList"], (oldCompanies = []) =>
                oldCompanies.map((company) =>
                    company.companyId === companyId
                        ? { ...company, isRegistered: status }
                        : company,
                ),
            );

            return { previousCompanies };
        },
        onSuccess: (data) => {
            toast.success(data?.message || "COMPANY STATUS UPDATED");
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
        onError: (error, _variables, context) => {
            if (context?.previousCompanies) {
                queryClient.setQueryData(
                    ["hostCompaniesList"],
                    context.previousCompanies,
                );
            }

            toast.error(
                error?.response?.data?.message || "Failed to update company status",
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
    });

    const userEmail = auth?.user?.email;
    const restrictedEmails = [
        "shawnsilveira.wono@gmail.com",
        "mehak.wono@gmail.com",
        "savita.wono@gmail.com",
        "gourish.wono@gmail.com",
    ];
    const companiesAccessAllowedEmails = [
        "gourish.wono@gmail.com",
        "savita.wono@gmail.com",
    ];

    const isRestrictedUser = restrictedEmails.includes(userEmail);
    const canAccessCompanies = companiesAccessAllowedEmails.includes(userEmail);
    const shouldRedirectFromCompanies = isRestrictedUser && !canAccessCompanies;

    useEffect(() => {
        if (shouldRedirectFromCompanies) {
            navigate("/dashboard/data-upload/bulk-upload-images", { replace: true });
        }
    }, [shouldRedirectFromCompanies, navigate]);

    const {
        data: companies = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["hostCompaniesList"],
        enabled: !shouldRedirectFromCompanies,
        queryFn: async () => {
            try {
                const response = await axiosPrivate.get("/api/hosts/host-companies");
                return response.data;
            } catch (error) {
                throw new Error(
                    error.response?.data?.message || "Failed to fetch companies",
                );
            }
        },
    });

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
                            className="h-10 w-10 rounded object-contain"
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
                cellRenderer: (params) => (
                    <span
                        className="text-primary hover:underline cursor-pointer"
                        onClick={() => {
                            dispatch(setSelectedCompany(params.data));
                            sessionStorage.setItem("companyId", params.data.companyId);
                            sessionStorage.setItem("companyName", params.data.companyName);

                            navigate(
                                `/dashboard/host-companies/${slugify(params.data.companyName)}`,
                                {
                                state: {
                                    companyId: params.data.companyId,
                                    companyName: params.data.companyName,
                                },
                                },
                            );
                        }}
                    >
                        {params.value || "-"}
                    </span>
                ),
            },
            {
                field: "industry",
                headerName: "Vertical",
                flex: 1,
                cellRenderer: (params) => params.value || "-",
            },
            // {
            //     field: "companyContinent",
            //     headerName: "Continent",
            //     flex: 1,
            //     cellRenderer: (params) => params.value || "-",
            // },
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
                valueGetter: (params) =>
                    params.data.isRegistered ? "Active" : "Inactive",
                cellRenderer: (params) => {
                    const statusColorMap = {
                        Active: { backgroundColor: "#90EE90", color: "#006400" },
                        Inactive: { backgroundColor: "#FFC5C5", color: "#8B0000" },
                    };

                    const { backgroundColor, color } = statusColorMap[params.value] || {
                        backgroundColor: "gray",
                        color: "white",
                    };

                    return (
                        <Chip
                            label={params.value}
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
                                onClick: () =>
                                    navigate(`/dashboard/host-companies/edit/${params?.data?.companyId}`),
                            },
                        ]}
                    />
                ),
            },
        ],
        [dispatch, navigate, toggleCompanyStatus],
    );

    const sortedCompanies = useMemo(
        () =>
            [...companies].sort((a, b) => {
                if (a.isRegistered === b.isRegistered) return 0;
                return a.isRegistered ? -1 : 1;
            }),
        [companies],
    );

    if (isLoading) return <div className="p-6">Loading host companies...</div>;
    if (isError) {
        return <div className="p-6 text-red-500">Failed to load companies.</div>;
    }

    return (
        <div className="p-4">
            <PageFrame>
                <AgTable
                    data={sortedCompanies}
                    columns={columns}
                    search
                    tableTitle="Host Companies"
                    tableHeight={500}
                    filterExcludeColumns={["logo", "isRegistered"]}
                    loading={isLoading}
                />
            </PageFrame>
        </div>
    );
};

export default HostCompanies;
