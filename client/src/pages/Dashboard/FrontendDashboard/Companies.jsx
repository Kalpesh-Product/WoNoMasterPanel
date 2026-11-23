// src/pages/Dashboard/FrontendDashboard/Companies.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import {
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  Layers,
  Pencil,
  Power,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import { setSelectedCompany } from "../../../redux/slices/companySlice";
import { statusPillClass } from "../../../lib/status-pill";
import { CompaniesSkeleton } from "../../../components/ui/Skeleton";
import DataTable, { DataTableButton } from "../../../components/Tables/DataTable";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 700;

const toCompanySlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "company";

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

// Point-of-contact records live in the Nomads API keyed by companyId, so one
// request per row would hammer it. Fetch through a small queue, cache each id,
// and only ask for ids we don't already have (later pages reuse earlier ones).
const POC_CACHE_TTL_MS = 10 * 60 * 1000;
const POC_CONCURRENCY = 4;
const pocCache = new Map();

const fetchPocForCompany = async (companyId) => {
  try {
    const response = await axios.get(`${NOMADS_API_BASE_URL}/poc/poc`, {
      params: { companyId },
    });
    const list = Array.isArray(response.data)
      ? response.data
      : response.data
        ? [response.data]
        : [];
    return list[0] || null;
  } catch (_error) {
    return null;
  }
};

const fetchPocsForCompanyIds = async (companyIds) => {
  const result = {};
  const queue = [];
  const now = Date.now();
  [...new Set(companyIds.filter(Boolean))].forEach((companyId) => {
    const cached = pocCache.get(companyId);
    if (cached && now - cached.fetchedAt < POC_CACHE_TTL_MS) {
      result[companyId] = cached.value;
    } else {
      queue.push(companyId);
    }
  });

  const worker = async () => {
    while (queue.length) {
      const companyId = queue.shift();
      const value = await fetchPocForCompany(companyId);
      pocCache.set(companyId, { value, fetchedAt: Date.now() });
      result[companyId] = value;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(POC_CONCURRENCY, queue.length) }, worker),
  );
  return result;
};

// Same idea as Destinations Data: remember this tab's last search/filters so
// opening a company (or switching Companies tabs) does not wipe the list.
const FILTERS_STORAGE_KEY = "companiesListFilters";

const readStoredFilters = () => {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const FILTER_CLASS = (active) =>
  `min-w-[118px] shrink-0 rounded-lg border bg-white px-2 py-1.5 text-[11px] font-pmedium outline-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 ${
    active
      ? "border-[#2563EB]/40 text-[#2563EB]"
      : "border-slate-200/60 text-slate-600"
  }`;

const Companies = () => {
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();
  const dispatch = useDispatch();
  const { auth } = useAuth();
  // Search and filters live in the URL so they survive opening a company and
  // coming back (same approach as the Destinations Data module).
  const [searchParams, setSearchParams] = useSearchParams();
  // URL first, then whatever this tab last used — a return through a tab link
  // (which drops the query string) then keeps the previous search/filters.
  const [initialFilters] = useState(() => {
    const stored = readStoredFilters();
    return {
      status: searchParams.get("status") || stored.status || "all",
      search: searchParams.get("q") ?? stored.search ?? "",
      continent: searchParams.get("continent") || stored.continent || "",
      country: searchParams.get("country") || stored.country || "",
      state: searchParams.get("state") || stored.state || "",
      city: searchParams.get("city") || stored.city || "",
    };
  });
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [continentFilter, setContinentFilter] = useState(initialFilters.continent);
  const [countryFilter, setCountryFilter] = useState(initialFilters.country);
  const [stateFilter, setStateFilter] = useState(initialFilters.state);
  const [cityFilter, setCityFilter] = useState(initialFilters.city);
  const [selectedCompany, setSelectedCompanyDetail] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Mirror the current search/filters back into the URL (replace, so it
  // doesn't stack up history entries) — returning from a company restores
  // exactly the list the user left.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set("q", searchQuery.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    if (continentFilter) next.set("continent", continentFilter);
    if (countryFilter) next.set("country", countryFilter);
    if (stateFilter) next.set("state", stateFilter);
    if (cityFilter) next.set("city", cityFilter);
    setSearchParams(next, { replace: true });
    try {
      sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          status: statusFilter,
          search: searchQuery.trim(),
          continent: continentFilter,
          country: countryFilter,
          state: stateFilter,
          city: cityFilter,
        }),
      );
    } catch (_error) {
      /* storage can be unavailable; the URL still carries the state */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    statusFilter,
    continentFilter,
    countryFilter,
    stateFilter,
    cityFilter,
  ]);

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

  const { data: locationOptions } = useQuery({
    queryKey: ["companyLocations", continentFilter, countryFilter, stateFilter],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/companies/locations", {
        params: {
          continent: continentFilter,
          country: countryFilter,
          state: stateFilter,
        },
      });
      return response.data;
    },
  });

  const continentOptions = locationOptions?.continents ?? [];
  const countryOptions = locationOptions?.countries ?? [];
  const stateOptions = locationOptions?.states ?? [];
  const cityOptions = locationOptions?.cities ?? [];

  const handleContinentFilterChange = (value) => {
    setContinentFilter(value);
    setCountryFilter("");
    setStateFilter("");
    setCityFilter("");
  };

  const handleCountryFilterChange = (value) => {
    setCountryFilter(value);
    setStateFilter("");
    setCityFilter("");
  };

  const handleStateFilterChange = (value) => {
    setStateFilter(value);
    setCityFilter("");
  };

  const hasLocationFilters = Boolean(
    continentFilter || countryFilter || stateFilter || cityFilter,
  );

  const { mutate: toggleCompanyStatus } = useMutation({
    mutationFn: async ({ companyId, status }) => {
      const response = await axiosPrivate.patch(`/api/admin/registration/${companyId}`, {
        status,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "COMPANY STATUS UPDATED");
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update company status");
    },
  });

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "companiesList",
      statusFilter,
      debouncedSearch,
      continentFilter,
      countryFilter,
      stateFilter,
      cityFilter,
    ],
    enabled: !shouldRedirectFromCompanies,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        const response = await axiosPrivate.get("/api/hosts/companies", {
          params: {
            page: pageParam,
            limit: PAGE_SIZE,
            status: statusFilter,
            search: debouncedSearch,
            continent: continentFilter,
            country: countryFilter,
            state: stateFilter,
            city: cityFilter,
          },
        });
        return response.data;
      } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch companies");
      }
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    // Keep the current rows on screen while a new search/filter loads, instead
    // of tearing the whole page down to a skeleton and back.
    placeholderData: (previousData) => previousData,
  });

  const companies = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  // Point-of-contact records live in their own collection on the Nomads side,
  // linked by companyId — fetched separately and cached, so the table can show
  // the real POC rather than blank columns.
  const pocCompanyIds = useMemo(
    () => companies.map((company) => company.companyId).filter(Boolean),
    [companies],
  );
  const { data: pocByCompanyId = {} } = useQuery({
    queryKey: ["companiesPoc", pocCompanyIds],
    enabled: pocCompanyIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    queryFn: () => fetchPocsForCompanyIds(pocCompanyIds),
  });
  const counts = data?.pages?.[0]?.counts;
  const totalCount = counts?.total ?? 0;
  const activeCount = counts?.active ?? 0;
  const inactiveCount = counts?.inactive ?? 0;

  // Pages are fetched 25 at a time; this sentinel (rendered under the shared
  // table) keeps the same scroll-to-load behaviour as before.
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, companies.length]);

  const openCompany = (company) => {
    dispatch(setSelectedCompany(company));
    sessionStorage.setItem("companyId", company.companyId);
    sessionStorage.setItem("companyName", company.companyName);
    sessionStorage.setItem("workspaceId", company.workspaceId || "");
    navigate(`/dashboard/companies/${toCompanySlug(company.companyName)}`, {
      state: {
        companyId: company.companyId,
        companyName: company.companyName,
      },
    });
  };

  const openEditCompany = (company) => {
    dispatch(setSelectedCompany(company));
    sessionStorage.setItem("companyId", company.companyId);
    sessionStorage.setItem("companyName", company.companyName);
    sessionStorage.setItem("workspaceId", company.workspaceId || "");
    navigate(`/dashboard/companies/edit-company/${company.companyId}`, {
      state: {
        companyId: company.companyId,
        companyName: company.companyName,
      },
    });
  };

  if (isLoading) {
    return <CompaniesSkeleton />;
  }

  if (isError) {
    return <div className="p-6 text-red-500">Failed to load companies.</div>;
  }

  const statCards = [
    {
      label: "Total Companies",
      value: totalCount,
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
      label: "Showing",
      value: companies.length,
      icon: Layers,
      accent: "border-l-blue-500",
      labelClass: "text-blue-600",
      iconClass: "bg-blue-50 text-blue-600",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <div
          data-tour="companies-list-stats"
          className="mb-1 grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4"
        >
          {statCards.map(({ label, value, icon: Icon, accent, labelClass, iconClass }) => (
            <div
              key={label}
              className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm transition-all hover:shadow-md ${accent}`}
            >
              <div className="min-w-0">
                <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${labelClass}`}>
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
          rows={companies}
          rowKey={(company) => company.companyId || company._id}
          minWidth={1200}
          loading={isFetchingNextPage && companies.length === 0}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by name, type, city, POC..."
          filters={
            <div
              data-tour="companies-list-location-filters"
              className="flex items-center justify-end gap-2"
            >
              <div data-tour="companies-list-status-filter">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter by registration status"
                  className={FILTER_CLASS(statusFilter !== "all")}
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <select
                value={continentFilter}
                onChange={(event) =>
                  handleContinentFilterChange(event.target.value)
                }
                aria-label="Filter by continent"
                className={FILTER_CLASS(Boolean(continentFilter))}
              >
                <option value="">All Continents</option>
                {continentOptions.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
              </select>
              <select
                value={countryFilter}
                onChange={(event) => handleCountryFilterChange(event.target.value)}
                aria-label="Filter by country"
                className={FILTER_CLASS(Boolean(countryFilter))}
              >
                <option value="">All Countries</option>
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={(event) => handleStateFilterChange(event.target.value)}
                aria-label="Filter by state"
                className={FILTER_CLASS(Boolean(stateFilter))}
              >
                <option value="">All States</option>
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                aria-label="Filter by city"
                className={FILTER_CLASS(Boolean(cityFilter))}
              >
                <option value="">All Cities</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          }
          toolbarActions={
            <span data-tour="companies-list-add">
              <DataTableButton
                type="button"
                icon={Building2}
                onClick={() => navigate("/dashboard/companies/add-company")}
              >
                Add Company
              </DataTableButton>
            </span>
          }
          emptyText={
            debouncedSearch || hasLocationFilters || statusFilter !== "all"
              ? "No companies match these filters."
              : "No companies found."
          }
          emptyIcon={Building2}
          tableProps={{ "data-tour": "companies-list-table" }}
          columns={[
            {
              key: "company",
              header: "Company",
              minWidth: 250,
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
                        data-tour={index === 0 ? "companies-list-name-link" : undefined}
                        title={company.companyName || "-"}
                        onClick={() => openCompany(company)}
                        className="block max-w-[210px] truncate text-left text-[12px] font-pmedium text-blue-600 hover:underline"
                      >
                        {company.companyName || "-"}
                      </button>
                      {company.registeredEntityName ? (
                        <p className="max-w-[210px] truncate text-[10px] text-slate-400">
                          {company.registeredEntityName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              },
            },
            {
              key: "continent",
              header: "Continent",
              minWidth: 120,
              render: (company) => (
                <span className="text-slate-700">
                  {company.companyContinent || "-"}
                </span>
              ),
            },
            {
              key: "location",
              header: "Location",
              minWidth: 190,
              render: (company) => (
                <div className="min-w-0">
                  <p className="max-w-[230px] truncate text-slate-700">
                    {[company.companyCity, company.companyState].filter(Boolean).join(", ") || "-"}
                  </p>
                  <p className="max-w-[230px] truncate text-[10px] text-slate-400">
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
                  data-tour={index === 0 ? "companies-list-registration-column" : undefined}
                  className={statusPillClass(company.isRegistered ? "Active" : "Inactive")}
                >
                  {company.isRegistered ? "Active" : "Inactive"}
                </span>
              ),
            },
            {
              key: "poc",
              header: "Point of Contact",
              minWidth: 190,
              render: (company) => {
                const poc = pocByCompanyId[company.companyId] || null;
                const name = poc?.name || company.pocName || "-";
                const email = poc?.email || company.pocEmail || "";
                const designation = poc?.designation || company.pocDesignation || "";
                return (
                  <div className="min-w-0">
                    <p className="max-w-[210px] truncate text-slate-700">{name}</p>
                    <p className="max-w-[210px] truncate text-[10px] text-slate-400">
                      {email || designation || "No email on file"}
                    </p>
                  </div>
                );
              },
            },
          ]}
          actions={(company, index) => (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedCompanyDetail(company);
                  setIsViewModalOpen(true);
                }}
                title="View details"
                aria-label={`View details for ${company.companyName || "company"}`}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <Eye size={14} />
              </button>
              <button
                type="button"
                onClick={() => openEditCompany(company)}
                title="Edit company"
                aria-label={`Edit ${company.companyName || "company"}`}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-amber-100 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                data-tour={index === 0 ? "companies-list-toggle-status" : undefined}
                onClick={() =>
                  toggleCompanyStatus({
                    companyId: company.companyId,
                    status: !company.isRegistered,
                  })
                }
                title={company.isRegistered ? "Mark as Inactive" : "Mark as Active"}
                aria-label={
                  company.isRegistered
                    ? `Mark ${company.companyName || "company"} as inactive`
                    : `Mark ${company.companyName || "company"} as active`
                }
                className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                  company.isRegistered
                    ? "bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700"
                    : "bg-rose-100 text-rose-700 hover:bg-emerald-100 hover:text-emerald-700"
                }`}
              >
                <Power size={14} />
              </button>
            </>
          )}
        />

        {hasNextPage ? (
          <div
            ref={loadMoreRef}
            className="flex items-center justify-center py-3 text-[11px] font-pmedium uppercase tracking-widest text-slate-400"
          >
            {isFetchingNextPage ? `Loading more companies...` : "Scroll to load more"}
          </div>
        ) : (
          <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
            Showing {companies.length} of {totalCount} companies
          </p>
        )}
      </div>

      {isViewModalOpen && selectedCompany ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => {
            setIsViewModalOpen(false);
            setSelectedCompanyDetail(null);
          }}
        >
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Eye size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                    {selectedCompany.companyName || "Company Details"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={statusPillClass(selectedCompany.isRegistered ? "Active" : "Inactive")}>
                      {selectedCompany.isRegistered ? "Registered" : "Not Registered"}
                    </span>
                    {selectedCompany.industry ? (
                      <span className="text-[11px] font-pmedium text-slate-500">
                        {selectedCompany.industry}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedCompanyDetail(null);
                }}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Company Details
                </h3>
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
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Registration</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.isRegistered ? "Active" : "Inactive"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Account Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Plan</p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      <span className={statusPillClass(formatLabel(selectedCompany?.plan || "not assigned"))}>
                        {formatLabel(selectedCompany?.plan || "not assigned")}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Status</p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      <span className={statusPillClass(formatLabel(selectedCompany?.status || "unknown"))}>
                        {formatLabel(selectedCompany?.status || "unknown")}
                      </span>
                    </p>
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
                  {selectedCompany?.comment ? (
                    <div className="sm:col-span-2">
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Comment</p>
                      <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.comment}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedCompanyDetail(null);
                }}
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
                  openEditCompany(company);
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
    </>
  );
};

export default Companies;
