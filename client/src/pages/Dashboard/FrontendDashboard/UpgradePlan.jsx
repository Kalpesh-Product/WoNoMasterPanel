import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip, MenuItem, TextField } from "@mui/material";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import { setSelectedCompany } from "../../../redux/slices/companySlice";
import { Button } from "@mui/material";
import { useLocation } from "react-router-dom";

const UpgradePlan = () => {
    const navigate = useNavigate();
    const axiosPrivate = useAxiosPrivate();
    const location = useLocation();
    const dispatch = useDispatch();
    const { auth } = useAuth();

    const handleSendUpgradeRequest = (params) => {
        sendUpgradeInvite(params);
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

    const { mutate: updatePaymentStatus } = useMutation({
        mutationFn: async ({ companyId, paymentStatus }) => {
            const response = await axiosPrivate.patch(
                "/api/hosts/update-upgrade-payment-status",
                { companyId, paymentStatus },
            );
            return response.data;
        },
        onMutate: async ({ companyId, paymentStatus }) => {
            await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });

            const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);

            queryClient.setQueryData(["hostCompaniesList"], (oldCompanies = []) =>
                oldCompanies.map((company) =>
                    company.companyId === companyId
                        ? { ...company, paymentStatus }
                        : company,
                ),
            );

            return { previousCompanies };
        },
        onSuccess: (data) => {
            toast.success(data?.message || "Payment status updated");
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
        onError: (error, _variables, context) => {
            if (context?.previousCompanies) {
                queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
            }

            toast.error(
                error?.response?.data?.message || "Failed to update payment status",
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
    });

    const { mutate: sendUpgradeInvite, isPending: isSendingUpgradeInvite } = useMutation({
        mutationFn: async (company) => {
            const response = await axiosPrivate.post("/api/host-user/send-invite", {
                leadId: company?.leadId || company?.companyId,
                email: company?.pocEmail,
                name: company?.pocName,
                mobile: company?.pocPhone,
                companyName: company?.companyName,
                verticalType: company?.industry,
                country: company?.companyCountry,
                state: company?.companyState,
                city: company?.companyCity,
                source: company?.source,
                fullName: company?.pocName,
                selectedPlan: company?.requestedPlan || company?.plan,
                status: company?.status || "closed",
                goals: company?.requestedPlan || company?.plan,
                comment: company?.comment,
                isUpgradeRequest: true,
            });
            return { response: response.data, company };
        },
        onMutate: async (company) => {
            await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });

            const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
            const nextPlan = String(company?.requestedPlan || company?.plan || "")
                .trim()
                .toLowerCase();
            const upgradeInviteSentAt = new Date().toISOString();

            queryClient.setQueryData(["hostCompaniesList"], (oldCompanies = []) =>
                oldCompanies.map((row) =>
                    row.companyId === company.companyId
                        ? {
                            ...row,
                            upgradeInviteSentAt,
                            plan: nextPlan || row.plan,
                            isRegistered: true,
                        }
                        : row,
                ),
            );

            return { previousCompanies };
        },
        onSuccess: ({ response }) => {
            toast.success(response?.message || "Invite sent successfully");
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
        onError: (error, _variables, context) => {
            if (context?.previousCompanies) {
                queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
            }

            toast.error(error?.response?.data?.message || "Failed to send upgrade invite");
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
                cellRenderer: (params) => params.value || "-"
            },
            {
                field: "industry",
                headerName: "Vertical",
                flex: 1,
                cellRenderer: (params) => params.value || "-",
            },
            {
                field: "currentPlan",
                headerName: "Current Plan",
                flex: 1,
                cellRenderer: (params) => formatPlan(params.data.plan),
            },
            {
                field: "requestedUpgradePlan",
                headerName: "Requested Upgrade Plan",
                flex: 1,
                cellRenderer: (params) => formatPlan(params.data.requestedPlan),
            },
            {
                field: "paymentStatus",
                headerName: "Payment Status",
                flex: 1,
                cellRenderer: (params) => {
                    const paymentValue = params.data.paymentStatus === true ? "paid" : "unpaid";
                    const paymentStyles = {
                        paid: { bg: "#D1FAE5", color: "#10B981" },
                        unpaid: { bg: "#FEE2E2", color: "#EF4444" },
                    };

                    return (
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <TextField
                                select
                                size="small"
                                value={paymentValue}
                                onChange={(e) =>
                                    updatePaymentStatus({
                                        companyId: params.data.companyId,
                                        paymentStatus: e.target.value === "paid",
                                    })
                                }
                                sx={{
                                    minWidth: 140,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "9999px",
                                        px: 1.5,
                                        fontWeight: 600,
                                        fontSize: "0.85rem",
                                        backgroundColor: paymentStyles[paymentValue]?.bg,
                                        color: paymentStyles[paymentValue]?.color,
                                        "& fieldset": { border: "none" },
                                    },
                                }}
                            >
                                {["paid", "unpaid"].map((option) => (
                                    <MenuItem
                                        key={option}
                                        value={option}
                                        sx={{
                                            justifyContent: "center",
                                            fontWeight: 600,
                                            fontSize: "0.85rem",
                                            borderRadius: "9999px",
                                            backgroundColor: paymentStyles[option]?.bg,
                                            color: paymentStyles[option]?.color,
                                            my: 0.5,
                                        }}
                                    >
                                        {option.charAt(0).toUpperCase() + option.slice(1)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </div>
                    );
                },
            },
            {
                field: "inviteStatus",
                headerName: "Invite Status",
                flex: 1,
                cellRenderer: (params) => {
                    const isInviteSent = Boolean(params.data.upgradeInviteSentAt);
                    return (
                        <Chip
                            label={isInviteSent ? "Invite Sent" : "Not Sent"}
                            size="small"
                            sx={{
                                backgroundColor: isInviteSent ? "#DBEAFE" : "#F3F4F6",
                                color: isInviteSent ? "#1D4ED8" : "#4B5563",
                                fontWeight: 600,
                            }}
                        />
                    );
                },
            },
            {
                field: "sendUpgradeRequest",
                headerName: "Send Upgrade Request",
                width: 120,
                cellRenderer: (params) => {
                    const isInviteSent = Boolean(params.data.upgradeInviteSentAt);
                    const isPaymentPending = params.data.paymentStatus !== true;
                    const hasRequestedPlan = Boolean(String(params.data.requestedPlan || "").trim());

                    return (
                        <Button
                            variant="contained"
                            size="small"
                            disabled={
                                isInviteSent ||
                                isPaymentPending ||
                                !hasRequestedPlan ||
                                isSendingUpgradeInvite
                            }
                            onClick={() => handleSendUpgradeRequest(params.data)}
                        >
                            {isInviteSent ? "Sent" : "Send"}
                        </Button>
                    );
                },
            },
        ],
        [isSendingUpgradeInvite, sendUpgradeInvite, toggleCompanyStatus, updatePaymentStatus],
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

export default UpgradePlan;

const formatPlan = (value) => {
    const rawPlan = String(value || "").trim();
    if (!rawPlan) return "Not Assigned";
    return rawPlan
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
};
