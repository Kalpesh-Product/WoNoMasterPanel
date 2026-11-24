import React, { useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const cards = [
    { title: "Upgrade Plan", path: "upgrade-plan" },
    { title: "Plan & Payment History", path: "plan-history" },
    { title: "Module Access", path: "module-access" },
    { title: "Units", path: "units" },
    { title: "Wono Nomads", path: "wono-nomads" },
    { title: "Website Builder", path: "website-builder" },
    // { title: "Website Credit Requests", path: "website-credit-requests" },
];

// "edit" / "edit-company" / "add" are route segments, not company slugs. When
// one of them reached this page (e.g. an old "…/host-companies/edit" link) the
// hub rendered with no company behind it and every module card then navigated
// to "…/host-companies/edit/<module>", which matched the edit form route and
// loaded no data.
const RESERVED_COMPANY_SEGMENTS = new Set([
    "edit",
    "edit-company",
    "add",
    "add-company",
]);

const toCompanySlug = (value = "") =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const HostCompanyOverview = () => {
    const { companyId: companySlug } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const axiosPrivate = useAxiosPrivate();
    const { companyId, companyName, selectedPlan, requestedPlan } = location?.state || {};
    const isReservedSegment = RESERVED_COMPANY_SEGMENTS.has(
        String(companySlug || "").toLowerCase(),
    );

    // Deep links and breadcrumb navigations arrive with only the slug — no
    // companyId in location.state. Resolve it from the same list the Host
    // Companies table uses so the module cards always carry a real company id
    // (the module pages read it from location.state/sessionStorage).
    const { data: hostCompanies = [] } = useQuery({
        queryKey: ["hostCompaniesList"],
        enabled: !isReservedSegment && !companyId,
        queryFn: async () => {
            const response = await axiosPrivate.get("/api/hosts/host-companies");
            return Array.isArray(response.data) ? response.data : [];
        },
    });

    const matchedCompany = useMemo(() => {
        if (companyId || isReservedSegment) return null;
        const targetSlug = toCompanySlug(companyName || companySlug);
        if (!targetSlug) return null;
        return (
            hostCompanies.find(
                (company) => toCompanySlug(company.companyName) === targetSlug,
            ) || null
        );
    }, [companyId, companyName, companySlug, hostCompanies, isReservedSegment]);

    const resolvedCompanyId = companyId || matchedCompany?.companyId || "";
    const resolvedCompanyName =
        companyName ||
        matchedCompany?.companyName ||
        String(companySlug || "").replace(/-/g, " ").trim();

    useEffect(() => {
        if (isReservedSegment) {
            navigate("/dashboard/host-companies", { replace: true });
        }
    }, [isReservedSegment, navigate]);

    // Keeps the module pages (which fall back to sessionStorage) pointed at
    // this hub's company instead of whichever company was opened last.
    useEffect(() => {
        if (!resolvedCompanyId) return;
        sessionStorage.setItem("companyId", String(resolvedCompanyId));
        if (resolvedCompanyName) {
            sessionStorage.setItem("companyName", resolvedCompanyName);
        }
        if (matchedCompany?.workspaceId) {
            sessionStorage.setItem("workspaceId", matchedCompany.workspaceId);
        }
    }, [matchedCompany, resolvedCompanyId, resolvedCompanyName]);

    if (isReservedSegment) return null;

    const finalPageTitle = String(resolvedCompanyName || "Host Company").trim();

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">
                    <div className="mb-1 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs font-pmedium uppercase tracking-[0.24em] text-gray-500">
                                Host Company Hub
                            </p>
                            <h1 className="mt-2 text-4xl font-pmedium uppercase tracking-tight text-primary">
                                {finalPageTitle} Overview
                            </h1>
                            <p className="mt-3 max-w-3xl text-content text-gray-600">
                                Open the host company's nested modules from one place.
                            </p>
                        </div>
                        <span className={statusPillClass(resolvedCompanyId ? "Active" : "Pending")}>
                            {resolvedCompanyId ? "Company Selected" : "Selection Missing"}
                        </span>
                    </div>

                    <div
                        data-tour="host-company-overview-cards"
                        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {cards.map((card) => (
                            <div
                                key={card.title}
                                data-tour={`host-company-overview-card-${card.path}`}
                                className="cursor-pointer rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                onClick={() =>
                                    navigate(`/dashboard/host-companies/${companySlug}/${card.path}`, {
                                        state: {
                                            companyId: resolvedCompanyId,
                                            companyName: resolvedCompanyName,
                                            selectedPlan,
                                            requestedPlan,
                                        },
                                    })
                                }
                            >
                                <p className="text-[10px] font-pmedium uppercase tracking-[0.24em] text-slate-400">
                                    Module
                                </p>
                                <h2 className="mt-3 text-subtitle font-pmedium text-slate-900">
                                    {card.title}
                                </h2>
                                <p className="mt-2 text-sm font-pregular text-slate-500">
                                    Go to {card.title} section
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </PageFrame>
        </div>
    );
};

export default HostCompanyOverview;
