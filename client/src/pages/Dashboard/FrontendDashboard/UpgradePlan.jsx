import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip } from "@mui/material";
import { MdOutlineRemoveRedEye } from "react-icons/md";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import MuiModal from "../../../components/MuiModal";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";

const DEFAULT_TEST_PAYMENT_LINK = "https://example.com/test-payment-link";

const UpgradePlan = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const axiosPrivate = useAxiosPrivate();
  const { auth } = useAuth();
  const [paymentLinks, setPaymentLinks] = useState({});
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const resolvedCompanyId = useMemo(() => {
    const stateCompanyId = String(location.state?.companyId || "").trim();
    if (stateCompanyId) return stateCompanyId;

    const storedCompanyId = String(sessionStorage.getItem("companyId") || "").trim();
    if (storedCompanyId) return storedCompanyId;

    return "";
  }, [location.state]);

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
  }, [navigate, shouldRedirectFromCompanies]);

  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["hostCompaniesList"],
    enabled: !shouldRedirectFromCompanies,
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/host-companies");
      return response.data;
    },
  });

  useEffect(() => {
    setPaymentLinks((prev) => {
      const next = { ...prev };
      companies.forEach((company) => {
        if (!next[company.companyId]) {
          next[company.companyId] =
            company.paymentLinkUrl || DEFAULT_TEST_PAYMENT_LINK;
        }
      });
      return next;
    });
  }, [companies]);

  const updateCompaniesCache = (updater) => {
    queryClient.setQueryData(["hostCompaniesList"], (oldCompanies = []) =>
      oldCompanies.map((company) => updater(company)),
    );
  };

  const { mutate: sendPaymentLink, isPending: isSendingPaymentLink } =
    useMutation({
      mutationFn: async (company) => {
        const paymentLinkUrl =
          paymentLinks[company.companyId] || DEFAULT_TEST_PAYMENT_LINK;

        await axiosPrivate.patch("/api/hosts/send-upgrade-payment-link", {
          companyId: company.companyId,
          paymentLinkUrl,
        });

        const response = await axiosPrivate.post(
          "/api/host-user/send-upgrade-payment-link-email",
          {
            email: company?.pocEmail,
            name: company?.pocName,
            companyName: company?.companyName,
            selectedPlan: company?.requestedPlan || company?.plan,
            paymentLinkUrl,
          },
        );

        return { response: response.data, company, paymentLinkUrl };
      },
      onMutate: async (company) => {
        await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });
        const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
        const paymentLinkUrl =
          paymentLinks[company.companyId] || DEFAULT_TEST_PAYMENT_LINK;
        const paymentLinkSentAt = new Date().toISOString();

        updateCompaniesCache((row) =>
          row.companyId === company.companyId
            ? {
              ...row,
              paymentLinkUrl,
              paymentLinkSentAt,
              upgradeStatus: "payment_link_sent",
            }
            : row,
        );

        return { previousCompanies };
      },
      onSuccess: ({ response }) => {
        toast.success(response?.message || "Payment link email sent successfully");
      },
      onError: (error, _variables, context) => {
        if (context?.previousCompanies) {
          queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
        }
        toast.error(
          error?.response?.data?.message || "Failed to send payment link email",
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
      const paymentConfirmedAt = paymentStatus ? new Date().toISOString() : null;

      updateCompaniesCache((company) =>
        company.companyId === companyId
          ? {
            ...company,
            paymentStatus,
            paymentConfirmedAt,
            plan: paymentStatus
              ? String(company.requestedPlan || company.plan || "")
                .trim()
                .toLowerCase() || company.plan
              : company.plan,
            upgradeStatus: paymentStatus
              ? "paid"
              : company.paymentLinkSentAt
                ? "payment_link_sent"
                : "requested",
          }
          : company,
      );

      return { previousCompanies };
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Payment status updated");
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

  const { mutate: sendUpgradeSuccess, isPending: isSendingUpgradeSuccess } =
    useMutation({
      mutationFn: async (company) => {
        await axiosPrivate.post("/api/host-user/send-upgrade-success-email", {
          email: company?.pocEmail,
          name: company?.pocName,
          companyName: company?.companyName,
          selectedPlan: company?.requestedPlan || company?.plan,
        });

        const response = await axiosPrivate.patch(
          "/api/hosts/mark-upgrade-success-email-sent",
          {
            companyId: company.companyId,
          },
        );

        return { response: response.data, company };
      },
      onMutate: async (company) => {
        await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });
        const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
        const upgradeSuccessSentAt = new Date().toISOString();

        updateCompaniesCache((row) =>
          row.companyId === company.companyId
            ? {
              ...row,
              upgradeSuccessSentAt,
              upgradeStatus: "upgraded",
            }
            : row,
        );

        return { previousCompanies };
      },
      onSuccess: ({ response }) => {
        toast.success(response?.message || "Upgrade success email sent successfully");
      },
      onError: (error, _variables, context) => {
        if (context?.previousCompanies) {
          queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
        }

        toast.error(
          error?.response?.data?.message ||
          "Failed to send upgrade success email",
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
      },
    });

  const handlePaymentLinkChange = (companyId, value) => {
    setPaymentLinks((prev) => ({ ...prev, [companyId]: value }));
  };

  const handleViewCompany = (company) => {
    setSelectedCompany(company);
    setIsViewModalOpen(true);
  };

  const columns = useMemo(
    () => [
      {
        field: "companyName",
        headerName: "Company Name",
        flex: 1,
        cellRenderer: (params) => params.value || "-",
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
        field: "paymentLinkStatus",
        headerName: "Payment Link Status",
        flex: 1,
        cellRenderer: (params) => {
          const isSent = Boolean(params.data.paymentLinkSentAt);
          return (
            <Chip
              label={isSent ? "Sent" : "Not Sent"}
              size="small"
              sx={{
                backgroundColor: isSent ? "#DBEAFE" : "#F3F4F6",
                color: isSent ? "#1D4ED8" : "#4B5563",
                fontWeight: 600,
              }}
            />
          );
        },
      },
      {
        field: "paymentStatus",
        headerName: "Payment Status",
        flex: 1,
        cellRenderer: (params) => {
          const paymentValue =
            params.data.paymentStatus === true ? "Paid" : "Unpaid";
          const paymentStyles = {
            Paid: { bg: "#D1FAE5", color: "#10B981" },
            Unpaid: { bg: "#FEE2E2", color: "#EF4444" },
          };

          return (
            <Chip
              label={paymentValue}
              size="small"
              sx={{
                backgroundColor: paymentStyles[paymentValue]?.bg,
                color: paymentStyles[paymentValue]?.color,
                fontWeight: 600,
              }}
            />
          );
        },
      },
      {
        field: "upgradeStatus",
        headerName: "Upgrade Status",
        flex: 1,
        cellRenderer: (params) => {
          const value = String(params.data.upgradeStatus || "requested")
            .trim()
            .toLowerCase();
          const styles = {
            requested: { bg: "#FEF3C7", color: "#B45309" },
            payment_link_sent: { bg: "#DBEAFE", color: "#1D4ED8" },
            paid: { bg: "#D1FAE5", color: "#047857" },
            upgraded: { bg: "#E9D5FF", color: "#7C3AED" },
          };

          return (
            <Chip
              label={formatPlan(value)}
              size="small"
              sx={{
                backgroundColor: styles[value]?.bg || "#F3F4F6",
                color: styles[value]?.color || "#4B5563",
                fontWeight: 600,
              }}
            />
          );
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        cellRenderer: (params) => {
          const hasRequestedPlan = Boolean(
            String(params.data.requestedPlan || "").trim(),
          );
          const isAlreadySent = Boolean(params.data.paymentLinkSentAt);
          const canSend = params.data.paymentStatus === true;
          const isSuccessSent = Boolean(params.data.upgradeSuccessSentAt);
          const canUpdatePayment =
            Boolean(params.data.paymentLinkSentAt) &&
            params.data.paymentStatus !== true;

          const actionMenuItems = [];

          if (!isAlreadySent && hasRequestedPlan) {
            actionMenuItems.push({
              label: "Send Payment Link",
              disabled: isSendingPaymentLink,
              onClick: () => sendPaymentLink(params.data),
            });
          } else if (canUpdatePayment) {
            actionMenuItems.push({
              label: "Mark As Paid",
              disabled: false,
              onClick: () =>
                updatePaymentStatus({
                  companyId: params.data.companyId,
                  paymentStatus: true,
                }),
            });
          } else if (canSend && !isSuccessSent) {
            actionMenuItems.push({
              label: "Send Success Email",
              disabled: isSendingUpgradeSuccess,
              onClick: () => sendUpgradeSuccess(params.data),
            });
          }

          return (
            <div className="flex items-center gap-2">
              <div
                role="button"
                onClick={() => handleViewCompany(params.data)}
                className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
              >
                <MdOutlineRemoveRedEye />
              </div>
              <ThreeDotMenu
                rowId={params.data.companyId}
                disabled={!actionMenuItems.length}
                menuItems={actionMenuItems}
              />
            </div>
          );
        },
      },
    ],
    [
      isSendingPaymentLink,
      isSendingUpgradeSuccess,
      sendPaymentLink,
      sendUpgradeSuccess,
      updatePaymentStatus,
    ],
  );

  const normalizePlan = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const sortedCompanies = useMemo(
    () =>
      companies
        .filter((company) =>
          String(company?.companyId || "").trim() === resolvedCompanyId,
        )
        .filter((company) => {
          const currentPlan = normalizePlan(company?.plan);
          const requestedPlan = normalizePlan(company?.requestedPlan);
          return (
            Boolean(requestedPlan) &&
            (requestedPlan !== currentPlan || !company?.upgradeSuccessSentAt)
          );
        })
        .sort((a, b) => {
          if (a.paymentStatus === b.paymentStatus) return 0;
          return a.paymentStatus ? -1 : 1;
        }),
    [companies, resolvedCompanyId],
  );

  if (isLoading) return <div className="p-6">Loading host companies...</div>;
  if (isError) {
    return <div className="p-6 text-red-500">Failed to load companies.</div>;
  }

  return (
    <div className="p-4">
      <>
        <AgTable
          data={sortedCompanies}
          columns={columns}
          search
          tableTitle="Upgrade Plan"
          tableHeight={500}
          filterExcludeColumns={["actions"]}
          loading={isLoading}
        />
      </>

      <MuiModal
        open={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedCompany(null);
        }}
        title="Upgrade Plan Details"
      >
        <div className="flex flex-col gap-4">
          <h2 className="text-subtitle font-pmedium text-gray-800">
            Company Details
          </h2>
          <DetailRow label="Company Name" value={selectedCompany?.companyName} />
          <DetailRow label="Vertical" value={selectedCompany?.industry} />
          <DetailRow label="POC Name" value={selectedCompany?.pocName} />
          <DetailRow label="POC Email" value={selectedCompany?.pocEmail} />
          <DetailRow label="POC Phone" value={selectedCompany?.pocPhone} />

          <hr className="border-borderGray my-1" />

          <h2 className="text-subtitle font-pmedium text-gray-800">
            Upgrade Details
          </h2>
          <DetailRow label="Current Plan" value={formatPlan(selectedCompany?.plan)} />
          <DetailRow
            label="Requested Plan"
            value={formatPlan(selectedCompany?.requestedPlan)}
          />
          <DetailRow
            label="Payment Status"
            value={selectedCompany?.paymentStatus ? "Paid" : "Unpaid"}
          />
          <DetailRow
            label="Upgrade Status"
            value={formatPlan(selectedCompany?.upgradeStatus)}
          />
          {/* <DetailRow
            label="7 Day Trial"
            value={getTrialStatusLabel(selectedCompany)}
          /> */}
          <DetailRow
            label="Trial Start"
            value={formatDateTime(selectedCompany?.trialStartAt)}
          />
          <DetailRow
            label="Trial End"
            value={formatDateTime(selectedCompany?.trialEndAt)}
          />
          <DetailRow
            label="Subscription Status"
            value={formatPlan(selectedCompany?.subscriptionStatus)}
          />
          <DetailRow
            label="Payment Link"
            value={selectedCompany?.paymentLinkUrl || paymentLinks[selectedCompany?.companyId]}
          />
          <DetailRow
            label="Payment Link Sent"
            value={formatDateTime(selectedCompany?.paymentLinkSentAt)}
          />
          <DetailRow
            label="Payment Confirmed"
            value={formatDateTime(selectedCompany?.paymentConfirmedAt)}
          />
          <DetailRow
            label="Success Email Sent"
            value={formatDateTime(selectedCompany?.upgradeSuccessSentAt)}
          />
          <DetailRow label="Comment" value={selectedCompany?.comment} />
        </div>
      </MuiModal>
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

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getTrialStatusLabel = (company) => {
  if (company?.isTrialActive) return "Active";
  if (company?.hasUsedTrial) return "Used";
  return "Not Started";
};

const DetailRow = ({ label, value }) => (
  <div className="grid grid-cols-[140px_16px_1fr] gap-2 text-content">
    <span className="font-pmedium text-gray-700">{label}</span>
    <span className="text-gray-400">:</span>
    <span className="break-words text-gray-900">{value || "-"}</span>
  </div>
);
