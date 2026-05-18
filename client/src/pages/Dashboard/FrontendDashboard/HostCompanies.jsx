import React, { useEffect, useMemo, useState } from "react";
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
import { MdOutlineRemoveRedEye } from "react-icons/md";
import MuiModal from "../../../components/MuiModal";

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
    const [selectedCompany, setSelectedCompanyDetail] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const handleViewHostCompany = (company) => {
        setSelectedCompanyDetail(company);
        setIsViewModalOpen(true);
    };

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
                                        selectedPlan:
                                            params.data.selectedPlan ||
                                            params.data.plan ||
                                            params.data.subscriptionPlan ||
                                            "",
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
                    <div className="flex items-center gap-2">
                        <div
                            role="button"
                            onClick={() => handleViewHostCompany(params.data)}
                            className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
                        >
                            <MdOutlineRemoveRedEye />
                        </div>
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
                                }
                            ]}
                        />
                    </div>
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

            <MuiModal
                open={isViewModalOpen}
                onClose={() => {
                    setIsViewModalOpen(false);
                    setSelectedCompanyDetail(null);
                }}
                title="Host Company Details"
            >
                <div className="flex flex-col gap-4">
                    <h2 className="text-subtitle font-pmedium text-gray-800">
                        Company Details
                    </h2>
                    <DetailRow label="Company Name" value={selectedCompany?.companyName} />
                    <DetailRow label="Industry" value={selectedCompany?.industry} />
                    <DetailRow label="Country" value={selectedCompany?.companyCountry} />
                    <DetailRow label="State" value={selectedCompany?.companyState} />
                    <DetailRow label="City" value={selectedCompany?.companyCity} />

                    <hr className="border-borderGray my-1" />

                    <h2 className="text-subtitle font-pmedium text-gray-800">
                        Account Details
                    </h2>
                    <div className="grid grid-cols-[120px_16px_1fr] gap-2 items-center text-content">
                        <span className="font-pmedium text-gray-700">Plan</span>
                        <span className="text-gray-400">:</span>
                        <div>
                            <Chip
                                label={formatLabel(selectedCompany?.plan || "not assigned")}
                                size="small"
                                sx={{
                                    backgroundColor: "rgba(37, 99, 235, 0.1)",
                                    color: "#2563EB",
                                    fontWeight: 600,
                                }}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-[120px_16px_1fr] gap-2 items-center text-content">
                        <span className="font-pmedium text-gray-700">Status</span>
                        <span className="text-gray-400">:</span>
                        <div className="flex items-center gap-2">
                            <Chip
                                label={formatLabel(selectedCompany?.status || "unknown")}
                                size="small"
                                sx={{
                                    backgroundColor: "rgba(15, 23, 42, 0.08)",
                                    color: "#0F172A",
                                    fontWeight: 600,
                                }}
                            />
                            <Chip
                                label={selectedCompany?.isRegistered ? "Registered" : "Not Registered"}
                                size="small"
                                sx={{
                                    backgroundColor: selectedCompany?.isRegistered ? "#DCFCE7" : "#FEE2E2",
                                    color: selectedCompany?.isRegistered ? "#166534" : "#991B1B",
                                    fontWeight: 600,
                                }}
                            />
                        </div>
                    </div>
                    <DetailRow label="POC Name" value={selectedCompany?.pocName} />
                    <DetailRow label="POC Email" value={selectedCompany?.pocEmail} />
                    <DetailRow label="POC Phone" value={selectedCompany?.pocPhone} />
                    <DetailRow label="Comment" value={selectedCompany?.comment} />
                </div>
            </MuiModal>
        </div>
    );
};

const formatLabel = (value) =>
    String(value || "-")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

const DetailRow = ({ label, value }) => (
    <div className="grid grid-cols-[120px_16px_1fr] gap-2 text-content">
        <span className="font-pmedium text-gray-700">{label}</span>
        <span className="text-gray-400">:</span>
        <span className="text-gray-600 break-words">{value || "-"}</span>
    </div>
);

export default HostCompanies;
