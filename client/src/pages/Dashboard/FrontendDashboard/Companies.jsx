// src/pages/Dashboard/FrontendDashboard/Companies.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { Eye, Search, X } from "lucide-react";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import { setSelectedCompany } from "../../../redux/slices/companySlice";
import CompaniesRequests from "./CompaniesRequests";
import { statusPillClass } from "../../../lib/status-pill";

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

const Companies = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const axiosPrivate = useAxiosPrivate();
  const dispatch = useDispatch();
  const { auth } = useAuth();
  const [viewMode, setViewMode] = useState("companies");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompanyDetail] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    const nextView = location.state?.viewMode === "requests" ? "requests" : "companies";
    setViewMode(nextView);
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
  }, [shouldRedirectFromCompanies, navigate]);

  const { mutate: toggleCompanyStatus } = useMutation({
    mutationFn: async ({ companyId, status }) => {
      const response = await axiosPrivate.patch(`/api/admin/registration/${companyId}`, {
        status,
      });
      return response.data;
    },
    onMutate: async ({ companyId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["companiesList"] });
      const previousCompanies = queryClient.getQueryData(["companiesList"]);

      queryClient.setQueryData(["companiesList"], (oldCompanies = []) =>
        oldCompanies.map((company) =>
          company.companyId === companyId ? { ...company, isRegistered: status } : company,
        ),
      );

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
      toast.error(error?.response?.data?.message || "Failed to update company status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
    },
  });

  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesList"],
    enabled: !shouldRedirectFromCompanies && viewMode === "companies",
    queryFn: async () => {
      try {
        const response = await axiosPrivate.get("/api/hosts/companies");
        return response.data;
      } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch companies");
      }
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["companiesListingRequestsCount"],
    enabled: !shouldRedirectFromCompanies,
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/companies-requests");
      return response.data || [];
    },
  });

  const sortedCompanies = useMemo(
    () =>
      [...companies].sort((a, b) => {
        if (a.isRegistered === b.isRegistered) return 0;
        return a.isRegistered ? -1 : 1;
      }),
    [companies],
  );

  const visibleCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortedCompanies.filter((company) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? company.isRegistered : !company.isRegistered);
      const matchesQuery =
        !query ||
        [
          company.companyName,
          company.industry,
          company.companyCountry,
          company.companyState,
          company.companyCity,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [sortedCompanies, searchQuery, statusFilter]);

  const activeCount = useMemo(
    () => sortedCompanies.filter((company) => company.isRegistered).length,
    [sortedCompanies],
  );
  const inactiveCount = useMemo(
    () => sortedCompanies.filter((company) => !company.isRegistered).length,
    [sortedCompanies],
  );
  const requestCount = requests.length;

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

  if (viewMode === "requests") {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-pmedium uppercase tracking-[0.24em] text-gray-500">
                  Company Registry
                </p>
                <h1 className="mt-2 text-4xl font-pmedium uppercase tracking-tight text-primary">
                  Companies
                </h1>
                <p className="mt-3 max-w-3xl text-content text-gray-600">
                  Review the company registry, update registration status, and open related views
                  from the same panel.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-white/80 p-1.5 shadow-sm w-fit">
              <button
                type="button"
                onClick={() => setViewMode("companies")}
                className="px-4 py-2 rounded-[1.15rem] bg-white text-slate-500 hover:text-slate-700 font-pmedium text-[10px] uppercase tracking-wider transition-all"
              >
                Companies
              </button>
              <button
                type="button"
                onClick={() => setViewMode("requests")}
                className="px-4 py-2 rounded-[1.15rem] bg-[#2563EB] text-white shadow-sm font-pmedium text-[10px] uppercase tracking-wider"
              >
                Requests ({requestCount})
              </button>
            </div>

            <CompaniesRequests embedded />
          </div>
        </PageFrame>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-slate-400 font-pmedium">Loading companies...</div>;
  }

  if (isError) {
    return <div className="p-6 text-red-500">Failed to load companies.</div>;
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-pmedium uppercase tracking-[0.24em] text-gray-500">
                Company Registry
              </p>
              <h1 className="mt-2 text-4xl font-pmedium uppercase tracking-tight text-primary">
                Companies
              </h1>
              <p className="mt-3 max-w-3xl text-content text-gray-600">
                Review the company registry, update registration status, and open related views
                from the same panel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-100 bg-white/80 p-1.5 shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setViewMode("companies")}
              className={`px-4 py-2 rounded-[1.15rem] font-pmedium text-[10px] uppercase tracking-wider transition-all ${
                viewMode === "companies"
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              Companies ({sortedCompanies.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("requests")}
              className={`px-4 py-2 rounded-[1.15rem] font-pmedium text-[10px] uppercase tracking-wider transition-all ${
                viewMode === "requests"
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "bg-white text-slate-500 hover:text-slate-700"
              }`}
            >
              Requests ({requestCount})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1 shrink-0">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">
                  Total Companies
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{sortedCompanies.length}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">
                  Active
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{activeCount}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-rose-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">
                  Inactive
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{inactiveCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
              <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {["all", "active", "inactive"].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
                        statusFilter === filter
                          ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
                          : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, type, city..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate("add-company")}
                  className="px-4 py-2.5 rounded-2xl bg-[#2563EB] text-white font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
                >
                  Add Company
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      Logo
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      Company Name
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      Vertical
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      Country
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      State
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                      City
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">
                      Registration
                    </th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-slate-400 font-pmedium">
                        No companies found.
                      </td>
                    </tr>
                  ) : (
                    visibleCompanies.map((company) => {
                      const logoUrl =
                        typeof company.logo === "string" ? company.logo : company.logo?.url;

                      return (
                        <tr key={company.companyId || company._id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-5 py-4 align-top">
                            {logoUrl ? (
                              <img src={logoUrl} alt="logo" className="h-10 w-10 rounded object-contain" />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span
                              className="text-blue-600 hover:underline cursor-pointer font-pmedium text-[13px]"
                              onClick={() => openCompany(company)}
                            >
                              {company.companyName || "-"}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                            {company.industry || "-"}
                          </td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                            {company.companyCountry || "-"}
                          </td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                            {company.companyState || "-"}
                          </td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                            {company.companyCity || "-"}
                          </td>
                          <td className="px-5 py-4 align-top text-center">
                            <span className={statusPillClass(company.isRegistered ? "Active" : "Inactive")}>
                              {company.isRegistered ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCompanyDetail(company);
                                  setIsViewModalOpen(true);
                                }}
                                title="View details"
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                              >
                                <Eye size={15} strokeWidth={2.5} />
                              </button>
                              <ThreeDotMenu
                                rowId={company.companyId || company._id || company.companyName}
                                menuItems={[
                                  {
                                    label: "View Details",
                                    onClick: () => {
                                      setSelectedCompanyDetail(company);
                                      setIsViewModalOpen(true);
                                    },
                                  },
                                  {
                                    label: "Edit",
                                    onClick: () => openEditCompany(company),
                                  },
                                  company.isRegistered
                                    ? {
                                        label: "Mark As Inactive",
                                        onClick: () =>
                                          toggleCompanyStatus({
                                            companyId: company.companyId,
                                            status: false,
                                          }),
                                      }
                                    : {
                                        label: "Mark As Active",
                                        onClick: () =>
                                          toggleCompanyStatus({
                                            companyId: company.companyId,
                                            status: true,
                                          }),
                                      },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageFrame>

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
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Vertical</p>
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
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Companies;
