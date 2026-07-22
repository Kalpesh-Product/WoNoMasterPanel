import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import PageFrame from "../../../components/Pages/PageFrame";
import { toast } from "sonner";
import { queryClient } from "../../../main";
import { ArrowLeft, Search, Eye, X } from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";

const emptyForm = {
  companyName: "",
  companyCity: "",
  companyState: "",
  companyCountry: "",
  companyContinent: "",
};

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const CompaniesRequests = ({ embedded = false }) => {
  const axiosPrivate = useAxiosPrivate();
  const navigate = useNavigate();
  const [reviewTarget, setReviewTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: requests = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesListingRequests"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/companies-requests");
      return response.data || [];
    },
  });

  const openReview = (request) => {
    setReviewTarget(request);
    setForm({
      companyName: request.companyName || "",
      companyCity: request.companyCity || "",
      companyState: request.companyState || "",
      companyCountry: request.companyCountry || "",
      companyContinent: request.companyContinent || "",
    });
  };

  const closeReview = () => {
    setReviewTarget(null);
    setForm(emptyForm);
  };

  const goBackToCompanies = () => {
    navigate("/dashboard/companies", { state: { viewMode: "companies" } });
  };

  const { mutate: approveRequest, isPending: isApproving } = useMutation({
    mutationFn: async () => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${reviewTarget.companyId}/approve`,
        form,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Company created");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
      closeReview();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create company");
    },
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async (companyId) => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${companyId}/reject`,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Request dismissed");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to dismiss request");
    },
  });

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.trim().toLowerCase();
    return requests.filter(
      (r) =>
        r.companyName?.toLowerCase().includes(q) ||
        r.companyCountry?.toLowerCase().includes(q) ||
        r.companyState?.toLowerCase().includes(q) ||
        r.companyCity?.toLowerCase().includes(q),
    );
  }, [requests, searchQuery]);

  if (isLoading) {
    if (embedded) {
      return (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
            Loading requests...
          </div>
        </div>
      );
    }
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
            Loading requests...
          </div>
        </PageFrame>
      </div>
    );
  }
  if (isError) {
    return <div className="p-6 text-red-500">Failed to load requests.</div>;
  }

  if (embedded) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
          <div className="w-full xl:max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search requests..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
              <tr>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Logo</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company Name</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Continent</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Country</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">State</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">City</th>
                <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">No requests found.</td>
                </tr>
              ) : (
                filteredRequests.map((request) => {
                  const logoUrl = typeof request.logo === "string" ? request.logo : request.logo?.url;
                  return (
                    <tr key={request.companyId} className="hover:bg-slate-50/50 transition-colors group">
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
                          onClick={() =>
                            navigate(`requests/${slugify(request.companyName)}`, {
                              state: {
                                companyId: request.companyId,
                                companyName: request.companyName,
                                companyCity: request.companyCity,
                                companyState: request.companyState,
                                companyCountry: request.companyCountry,
                                companyContinent: request.companyContinent,
                              },
                            })
                          }
                        >
                          {request.companyName || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyContinent || "-"}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyCountry || "-"}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyState || "-"}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyCity || "-"}</td>
                      <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openReview(request)}
                            title="Review request"
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                          >
                            <Eye size={15} strokeWidth={2.5} />
                          </button>
                          <ThreeDotMenu
                            rowId={request.companyId}
                            menuItems={[
                              { label: "Review", onClick: () => openReview(request) },
                              { label: "Reject", onClick: () => rejectRequest(request.companyId) },
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
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">

          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <button
                type="button"
                onClick={goBackToCompanies}
                className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-wider text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-all"
              >
                <ArrowLeft size={13} />
                Back to Companies
              </button>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                Companies Requests
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Review and approve company listing requests from hosts.
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
              <div className="w-full xl:max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search requests..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Logo</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company Name</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Continent</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Country</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">State</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">City</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">No requests found.</td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => {
                      const logoUrl = typeof request.logo === "string" ? request.logo : request.logo?.url;
                      return (
                        <tr key={request.companyId} className="hover:bg-slate-50/50 transition-colors group">
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
                              onClick={() =>
                                navigate(`requests/${slugify(request.companyName)}`, {
                                  state: {
                                    companyId: request.companyId,
                                    companyName: request.companyName,
                                    companyCity: request.companyCity,
                                    companyState: request.companyState,
                                    companyCountry: request.companyCountry,
                                    companyContinent: request.companyContinent,
                                  },
                                })
                              }
                            >
                              {request.companyName || "-"}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyContinent || "-"}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyCountry || "-"}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyState || "-"}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{request.companyCity || "-"}</td>
                          <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openReview(request)}
                                title="Review & Create"
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                              >
                                <Eye size={15} strokeWidth={2.5} />
                              </button>
                              <ThreeDotMenu
                                rowId={request.companyId}
                                menuItems={[
                                  {
                                    label: "Review & Create",
                                    onClick: () => openReview(request),
                                  },
                                  {
                                    label: "Reject",
                                    onClick: () => rejectRequest(request.companyId),
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

      {reviewTarget ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={closeReview}>
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
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">Review & Create Company</h2>
                  <p className="text-[10px] font-pmedium text-slate-500 mt-1">This creates a new entry in Companies, linked back to this host's already-existing Nomads listing(s).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto bg-white">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Company Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">City</label>
                <input
                  type="text"
                  value={form.companyCity}
                  onChange={(e) => setForm((f) => ({ ...f, companyCity: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">State</label>
                <input
                  type="text"
                  value={form.companyState}
                  onChange={(e) => setForm((f) => ({ ...f, companyState: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Country</label>
                <input
                  type="text"
                  value={form.companyCountry}
                  onChange={(e) => setForm((f) => ({ ...f, companyCountry: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Continent</label>
                <input
                  type="text"
                  value={form.companyContinent}
                  onChange={(e) => setForm((f) => ({ ...f, companyContinent: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
                <p className="text-[10px] font-medium text-slate-400">Leave blank to auto-derive from country</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReview}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.companyName.trim() || isApproving}
                onClick={() => approveRequest()}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isApproving ? "Creating..." : "Create Company"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CompaniesRequests;
