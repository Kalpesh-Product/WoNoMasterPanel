import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import {
    Ban,
    Building2,
    CalendarDays,
    CheckCircle2,
    Eye,
    FileText,
    Layers,
    Pencil,
    X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import DataTable from "../../../components/Tables/DataTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import { setSelectedCompany } from "../../../redux/slices/companySlice";
import { statusPillClass } from "../../../lib/status-pill";

const toCompanySlug = (value = "") =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "host-company";

const formatLabel = (value) =>
    String(value || "-")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const PLAN_LABELS = { basic: "Basic Plan", professional: "Professional Plan", custom: "Custom Plan" };

const FILTER_CLASS = (active) =>
    `shrink-0 rounded-lg border bg-white px-2 py-1.5 text-[11px] font-pmedium outline-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 ${
        active
            ? "border-[#2563EB]/40 text-[#2563EB]"
            : "border-slate-200/60 text-slate-600"
    }`;

// Reads the real, staff-configurable trial length from the dates actually
// stored on this company rather than a hardcoded day count, so it stays
// correct even after Plan Pricing settings' trial duration changes.
const trialDayCountLabel = (company) => {
    const start = new Date(company?.trialStartAt);
    const end = new Date(company?.trialEndAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Free Trial";
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return days > 0 ? `${days} Day Trial` : "Free Trial";
};

const getCurrentSubscriptionLabel = (company) => {
    if (company?.isTrialActive) return trialDayCountLabel(company);
    if (String(company?.subscriptionStatus || "").trim()) {
        return formatLabel(company.subscriptionStatus);
    }
    if (String(company?.plan || "").trim()) {
        return formatLabel(company.plan);
    }
    return "Not Assigned";
};

const getCompanyInitials = (value) =>
    String(value || "Company")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

const getLogoUrl = (company) => {
    const logo = company?.logo;
    if (typeof logo === "string") return logo;
    return logo?.url || null;
};

// A company can operate several verticals; the API merges them into
// `verticals` (workspace business types + industry).
const getVerticals = (company) => {
    const list = Array.isArray(company?.verticals) && company.verticals.length
        ? company.verticals
        : [company?.industry, ...(company?.businessTypes || [])];
    const seen = new Set();
    // `industry` is stored as one free-text string ("Co-Working, Cafe,
    // Meeting Rooms"), so split it into one chip per vertical.
    return list
        .flatMap((value) => String(value || "").split(/[,;|]/))
        .map((value) => value.trim())
        .filter((value) => {
            if (!value) return false;
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

// Compact chips, wrapping two or three per line inside a narrow column.
const VerticalChips = ({ values }) => {
    if (!values.length) return <span className="text-slate-400">-</span>;
    return (
        <div className="flex max-w-[170px] flex-wrap gap-1">
            {values.map((value) => (
                <span
                    key={value}
                    className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-pmedium capitalize text-slate-600"
                    title={value}
                >
                    {formatLabel(value)}
                </span>
            ))}
        </div>
    );
};

const HostCompanies = () => {
    const navigate = useNavigate();
    const axiosPrivate = useAxiosPrivate();
    const dispatch = useDispatch();
    const { auth } = useAuth();
    const [selectedCompany, setSelectedCompanyDetail] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    // Same behaviour as the Companies tab: remember this tab's last search and
    // filters, so opening a host company and coming back does not reset them.
    const [initialFilters] = useState(() => {
        try {
            const parsed = JSON.parse(
                sessionStorage.getItem("hostCompaniesListFilters") || "{}",
            );
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_error) {
            return {};
        }
    });
    const [searchQuery, setSearchQuery] = useState(initialFilters.search || "");
    const [statusFilter, setStatusFilter] = useState(initialFilters.status || "All");
    const [planFilter, setPlanFilter] = useState(initialFilters.plan || "All");
    const [sortBy, setSortBy] = useState(initialFilters.sort || "registered");

    useEffect(() => {
        try {
            sessionStorage.setItem(
                "hostCompaniesListFilters",
                JSON.stringify({
                    search: searchQuery,
                    status: statusFilter,
                    plan: planFilter,
                    sort: sortBy,
                }),
            );
        } catch (_error) {
            /* storage unavailable — filters just won't persist */
        }
    }, [searchQuery, statusFilter, planFilter, sortBy]);

    const handleViewHostCompany = (company) => {
        setSelectedCompanyDetail(company);
        setIsViewModalOpen(true);
    };

    const openCompanyHub = (company) => {
        dispatch(setSelectedCompany(company));
        sessionStorage.setItem("companyId", company.companyId);
        sessionStorage.setItem("companyName", company.companyName);
        sessionStorage.setItem("workspaceId", company.workspaceId || "");
        const companySlug = toCompanySlug(company.companyName);
        navigate(`/dashboard/host-companies/${companySlug}`, {
            state: {
                companyId: company.companyId,
                companyName: company.companyName,
                selectedPlan: company.selectedPlan || company.plan || company.subscriptionPlan || "",
                requestedPlan: company.requestedPlan || "",
            },
        });
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
                queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
            }
            toast.error(error?.response?.data?.message || "Failed to update company status");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
        },
    });

    const userEmail = auth?.user?.email;
    const restrictedEmails = [
        "shawnsilveira.wono@gmail.com",
        "mehak.wono@gmail.com",
        "gourish.wono@gmail.com",
    ];
    const companiesAccessAllowedEmails = [
        "gourish.wono@gmail.com",
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
        // Keeps plan/upgrade-request status fresh without a manual reload —
        // this data changes from a host's own session, which nothing else
        // here would ever invalidate.
        refetchInterval: 15000,
    });

    // Registered companies stay on top by default; the sort select lets staff
    // switch to alphabetical when they are looking for one company by name.
    const sortedCompanies = useMemo(() => {
        const list = [...companies];
        if (sortBy === "name") {
            return list.sort((a, b) =>
                String(a.companyName || "").localeCompare(String(b.companyName || ""), "en", {
                    sensitivity: "base",
                }),
            );
        }
        return list.sort((a, b) => {
            if (a.isRegistered === b.isRegistered) return 0;
            return a.isRegistered ? -1 : 1;
        });
    }, [companies, sortBy]);

    const planOptions = useMemo(() => {
        const labels = new Set(companies.map((company) => getCurrentSubscriptionLabel(company)));
        return [...labels].sort((a, b) => a.localeCompare(b));
    }, [companies]);

    const filteredCompanies = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return sortedCompanies.filter((company) => {
            const matchesStatus =
                statusFilter === "All" ||
                (statusFilter === "Active" ? Boolean(company.isRegistered) : !company.isRegistered);
            const matchesPlan =
                planFilter === "All" || getCurrentSubscriptionLabel(company) === planFilter;
            const matchesQuery =
                !q ||
                [
                    company.companyName,
                    company.industry,
                    company.companyCountry,
                    company.companyState,
                    company.companyCity,
                    company.pocName,
                    company.pocEmail,
                    getCurrentSubscriptionLabel(company),
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(q));
            return matchesStatus && matchesPlan && matchesQuery;
        });
    }, [sortedCompanies, searchQuery, statusFilter, planFilter]);

    const activeCount = useMemo(() => companies.filter((c) => c.isRegistered).length, [companies]);
    const inactiveCount = useMemo(() => companies.filter((c) => !c.isRegistered).length, [companies]);
    const onTrialCount = useMemo(
        () => companies.filter((c) => c.isTrialActive).length,
        [companies],
    );

    if (isLoading) {
        return (
            <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
                <PageFrame>
                    <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
                        Loading host companies...
                    </div>
                </PageFrame>
            </div>
        );
    }
    if (isError) {
        return <div className="p-6 text-red-500">Failed to load companies.</div>;
    }

    const statCards = [
        {
            label: "Total Companies",
            value: companies.length,
            icon: Building2,
            accent: "border-l-slate-400",
            labelClass: "text-slate-500",
            iconClass: "bg-slate-50 text-slate-600",
        },
        {
            label: "Active",
            value: activeCount,
            icon: CheckCircle2,
            accent: "border-l-emerald-500",
            labelClass: "text-emerald-600",
            iconClass: "bg-emerald-50 text-emerald-600",
        },
        {
            label: "Inactive",
            value: inactiveCount,
            icon: Ban,
            accent: "border-l-rose-500",
            labelClass: "text-rose-600",
            iconClass: "bg-rose-50 text-rose-600",
        },
        {
            label: "On Trial",
            value: onTrialCount,
            icon: CalendarDays,
            accent: "border-l-amber-500",
            labelClass: "text-amber-600",
            iconClass: "bg-amber-50 text-amber-600",
        },
    ];

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">

                    <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
                        <div>
                            <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                                Host Companies
                            </h2>
                            <p className="text-xs font-pmedium text-slate-500 mt-1">
                                Manage host company registrations, plans and module access.
                            </p>
                        </div>
                    </div>

                    <div
                        data-tour="host-companies-stats"
                        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 shrink-0"
                    >
                        {statCards.map(({ label, value, icon: Icon, accent, labelClass, iconClass }) => (
                            <div
                                key={label}
                                className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm transition-all hover:shadow-md ${accent}`}
                            >
                                <div className="min-w-0">
                                    <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${labelClass}`}>
                                        {label}
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
                                </div>
                                <div className={`shrink-0 rounded-2xl p-2 ${iconClass}`}>
                                    <Icon size={16} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <DataTable
                        rows={filteredCompanies}
                        rowKey={(company) => company.companyId || company._id}
                        minWidth={1180}
                        searchValue={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Search company, industry, city, POC..."
                        filters={
                            <div className="flex items-center justify-end gap-2">
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    aria-label="Filter by registration status"
                                    className={FILTER_CLASS(statusFilter !== "All")}
                                >
                                    <option value="All">All status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                                <select
                                    value={planFilter}
                                    onChange={(event) => setPlanFilter(event.target.value)}
                                    aria-label="Filter by subscription"
                                    className={FILTER_CLASS(planFilter !== "All")}
                                >
                                    <option value="All">All subscriptions</option>
                                    {planOptions.map((plan) => (
                                        <option key={plan} value={plan}>
                                            {plan}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={sortBy}
                                    onChange={(event) => setSortBy(event.target.value)}
                                    aria-label="Sort companies"
                                    className={FILTER_CLASS(sortBy !== "registered")}
                                >
                                    <option value="registered">Active first</option>
                                    <option value="name">Name A–Z</option>
                                </select>
                            </div>
                        }
                        emptyText={
                            companies.length === 0
                                ? "No host companies registered yet."
                                : "No companies match these filters."
                        }
                        emptyIcon={Building2}
                        tableProps={{ "data-tour": "host-companies-table" }}
                        columns={[
                            {
                                key: "company",
                                header: "Company",
                                minWidth: 240,
                                render: (company, index) => {
                                    const logoUrl = getLogoUrl(company);
                                    return (
                                        <div className="flex items-center gap-3">
                                            {logoUrl ? (
                                                <img
                                                    src={logoUrl}
                                                    alt={`${company.companyName || "Company"} logo`}
                                                    className="h-9 w-9 shrink-0 rounded-xl border border-slate-100 bg-white object-contain"
                                                />
                                            ) : (
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-pmedium text-white">
                                                    {getCompanyInitials(company.companyName)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    data-tour={index === 0 ? "host-companies-name-link" : undefined}
                                                    title={company.companyName || "-"}
                                                    onClick={() => openCompanyHub(company)}
                                                    className="block max-w-[190px] truncate text-left text-[12px] font-pmedium text-blue-600 hover:underline"
                                                >
                                                    {company.companyName || "-"}
                                                </button>
                                                {company.registeredEntityName ? (
                                                    <p className="max-w-[190px] truncate text-[10px] text-slate-400">
                                                        {company.registeredEntityName}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                },
                            },
                            {
                                key: "vertical",
                                header: "Vertical",
                                minWidth: 130,
                                render: (company) => <VerticalChips values={getVerticals(company)} />,
                            },
                            {
                                key: "location",
                                header: "Location",
                                minWidth: 180,
                                render: (company) => (
                                    <div className="min-w-0">
                                        <p className="max-w-[220px] truncate text-slate-700">
                                            {[company.companyCity, company.companyState]
                                                .filter(Boolean)
                                                .join(", ") || "-"}
                                        </p>
                                        <p className="max-w-[220px] truncate text-[10px] text-slate-400">
                                            {company.companyCountry || "Country not set"}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                key: "registration",
                                header: "Registration",
                                align: "center",
                                render: (company, index) => (
                                    <span
                                        data-tour={index === 0 ? "host-companies-registration-column" : undefined}
                                        className={statusPillClass(company.isRegistered ? "Active" : "Inactive")}
                                    >
                                        {company.isRegistered ? "Active" : "Inactive"}
                                    </span>
                                ),
                            },
                            {
                                key: "subscription",
                                header: "Subscription",
                                render: (company, index) => (
                                    <span
                                        data-tour={index === 0 ? "host-companies-subscription-column" : undefined}
                                        className={statusPillClass(getCurrentSubscriptionLabel(company))}
                                    >
                                        {getCurrentSubscriptionLabel(company)}
                                    </span>
                                ),
                            },
                            {
                                key: "planWindow",
                                header: "Plan Period",
                                minWidth: 190,
                                render: (company) => (
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <CalendarDays size={12} className="shrink-0 text-slate-400" />
                                        <span>
                                            {formatDate(company.planStartDate)} — {formatDate(company.planExpiryDate)}
                                        </span>
                                    </div>
                                ),
                            },
                            {
                                key: "poc",
                                header: "Point of Contact",
                                minWidth: 180,
                                render: (company) => (
                                    <div className="min-w-0">
                                        <p className="max-w-[200px] truncate text-slate-700">
                                            {company.pocName || "-"}
                                        </p>
                                        <p className="max-w-[200px] truncate text-[10px] text-slate-400">
                                            {company.pocEmail || "No email on file"}
                                        </p>
                                    </div>
                                ),
                            },
                        ]}
                        actions={(company, index) => (
                            <div data-tour={index === 0 ? "host-companies-row-actions" : undefined} className="flex items-center justify-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleViewHostCompany(company)}
                                    title="View details"
                                    aria-label={`View details for ${company.companyName || "company"}`}
                                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            `/dashboard/host-companies/edit-company/${company.companyId}`,
                                            {
                                                state: {
                                                    companyId: company.companyId,
                                                    companyName: company.companyName,
                                                },
                                            },
                                        )
                                    }
                                    title="Edit company"
                                    aria-label={`Edit ${company.companyName || "company"}`}
                                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-amber-100 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        toggleCompanyStatus({
                                            companyId: company.companyId,
                                            status: !company.isRegistered,
                                        })
                                    }
                                    title={company.isRegistered ? "Mark as inactive" : "Mark as active"}
                                    aria-label={
                                        company.isRegistered
                                            ? `Mark ${company.companyName || "company"} as inactive`
                                            : `Mark ${company.companyName || "company"} as active`
                                    }
                                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                >
                                    {company.isRegistered ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                                </button>
                            </div>
                        )}
                    />

                    {filteredCompanies.length > 0 && (
                        <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                            Showing {filteredCompanies.length} of {companies.length} companies
                        </p>
                    )}
                </div>
            </PageFrame>

            {isViewModalOpen && selectedCompany ? (
                <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => { setIsViewModalOpen(false); setSelectedCompanyDetail(null); }}>
                    <div
                        className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                                    <Eye size={18} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">{selectedCompany.companyName || "Company Details"}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={statusPillClass(selectedCompany.isRegistered ? "Active" : "Inactive")}>
                                            {selectedCompany.isRegistered ? "Registered" : "Not Registered"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsViewModalOpen(false); setSelectedCompanyDetail(null); }}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
                            <div>
                                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Company Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Company Name</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.companyName || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Industry</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.industry || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Country</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.companyCountry || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">State</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.companyState || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">City</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.companyCity || "-"}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Account Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Plan</p>
                                        <p className="text-[12px] font-pmedium text-slate-900"><span className={statusPillClass(getCurrentSubscriptionLabel(selectedCompany))}>{formatLabel(selectedCompany?.plan || "not assigned")}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Status</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">
                                            <span className={statusPillClass(formatLabel(selectedCompany?.status || "unknown"))}>{formatLabel(selectedCompany?.status || "unknown")}</span>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Plan Start</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{formatDate(selectedCompany?.planStartDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Plan End</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{formatDate(selectedCompany?.planExpiryDate)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Name</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.pocName || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Email</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.pocEmail || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Phone</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.pocPhone || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Trial Start</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{formatDateTime(selectedCompany?.trialStartAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Trial End</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{formatDateTime(selectedCompany?.trialEndAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Subscription Status</p>
                                        <p className="text-[12px] font-pmedium text-slate-900">{formatLabel(selectedCompany?.subscriptionStatus || "-")}</p>
                                    </div>
                                    {selectedCompany?.comment && (
                                        <div className="sm:col-span-2">
                                            <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Comment</p>
                                            <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.comment}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <PlanHistorySection companyId={selectedCompany?.companyId} />
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => { setIsViewModalOpen(false); setSelectedCompanyDetail(null); }}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-pmedium text-slate-600 transition hover:bg-slate-100"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const company = selectedCompany;
                                    setIsViewModalOpen(false);
                                    setSelectedCompanyDetail(null);
                                    navigate(
                                        `/dashboard/host-companies/edit-company/${company.companyId}`,
                                        { state: { companyId: company.companyId, companyName: company.companyName } },
                                    );
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[12px] font-pmedium text-white transition hover:bg-blue-700"
                            >
                                <Pencil size={13} />
                                Edit company
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

// Full history of every plan payment attempt for this company (not just the
// latest) — initial purchase, renewals, upgrades/downgrades — each with its
// status, amount, and Stripe invoice link where one exists.
const PlanHistorySection = ({ companyId }) => {
    const axiosPrivate = useAxiosPrivate();
    const { data, isLoading } = useQuery({
        queryKey: ["hostCompanyPlanHistory", companyId],
        enabled: Boolean(companyId),
        queryFn: async () => {
            const response = await axiosPrivate.get(
                `/api/hosts/host-companies/${companyId}/plan-history`,
            );
            return response?.data?.history || [];
        },
    });
    const history = data || [];

    return (
        <div>
            <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                Plan History
            </h3>
            {isLoading ? (
                <p className="text-[11px] text-slate-400">Loading…</p>
            ) : history.length === 0 ? (
                <p className="text-[11px] text-slate-400">No plan payments yet.</p>
            ) : (
                <div className="space-y-1.5">
                    {history.map((entry) => (
                        <div
                            key={entry._id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/60"
                        >
                            <div className="min-w-0">
                                <p className="text-[12px] font-pmedium text-slate-800">
                                    {PLAN_LABELS[entry.plan] || formatLabel(entry.plan)}{" "}
                                    <span className="text-slate-400 font-normal">
                                        ({formatLabel(entry.changeType)})
                                    </span>
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {entry.status === "paid"
                                        ? `Paid ${formatDate(entry.paidAt)}`
                                        : `Requested ${formatDate(entry.createdAt)}`}
                                    {entry.periodStart && entry.periodEnd
                                        ? ` · Covers ${formatDate(entry.periodStart)} – ${formatDate(entry.periodEnd)}`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span
                                    className={statusPillClass(
                                        entry.status === "paid" ? "Paid" : "Pending",
                                    )}
                                >
                                    {entry.status === "paid" ? "Paid" : "Pending"}
                                </span>
                                <span className="text-[12px] font-pmedium text-slate-700">
                                    ${entry.amount}
                                </span>
                                {entry.hostedInvoiceUrl && (
                                    <a
                                        href={entry.hostedInvoiceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:text-blue-700"
                                        title="View invoice"
                                    >
                                        <FileText size={14} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HostCompanies;
