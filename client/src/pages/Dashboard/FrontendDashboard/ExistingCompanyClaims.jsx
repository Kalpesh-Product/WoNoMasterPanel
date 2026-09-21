import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { toast } from "sonner";
import { queryClient } from "../../../main";
import { Search, Eye, X, FileText, ExternalLink, AlertTriangle } from "lucide-react";

const CLAIMS_KEY = ["existingCompanyClaims"];

// Public Nomads site - listing links open here in a new tab.
const NOMADS_SITE_URL = String(import.meta.env.VITE_NOMADS_SITE_URL || "https://wono.co").replace(/\/+$/, "");

// Same URL shape the Nomads site itself uses for a listing page (name in the
// path, type as a query param; city/country keep its header on the right city
// when the page is opened cold).
const getLiveListingUrl = (listing) => {
  const name = String(listing?.companyName || "").trim();
  if (!name) return "";
  const params = new URLSearchParams();
  if (listing.companyType) params.set("companyType", listing.companyType);
  if (listing.city) params.set("state", listing.city);
  if (listing.country) params.set("country", listing.country);
  const query = params.toString();
  return `${NOMADS_SITE_URL}/listings/${encodeURIComponent(name)}${query ? `?${query}` : ""}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

// Host-initiated "Verify existing listings" claims (HostPanel > Listings).
// Approving runs the same whole-company Transfer staff can already do from a
// Host Company's Nomad Listing tab. Every approved / rejected claim stays in
// the list as history.
const ExistingCompanyClaims = () => {
  const axiosPrivate = useAxiosPrivate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewTarget, setReviewTarget] = useState(null);
  // null | "approve" | "reject" - the second, confirming step of each action.
  const [confirmAction, setConfirmAction] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const {
    data: claims = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: CLAIMS_KEY,
    queryFn: async () => (await axiosPrivate.get("/api/hosts/existing-company-claims")).data || [],
  });

  const claim = reviewTarget?.existingCompanyClaim;

  const { data: detail, isFetching: isLoadingDetail } = useQuery({
    queryKey: ["existingCompanyClaimDetail", reviewTarget?.companyId, claim?.nomadsCompanyId],
    enabled: Boolean(reviewTarget),
    queryFn: async () =>
      (
        await axiosPrivate.get(`/api/hosts/existing-company-claims/${reviewTarget.companyId}`, {
          params: { nomadsCompanyId: claim?.nomadsCompanyId },
        })
      ).data,
  });

  const closeReview = () => {
    setReviewTarget(null);
    setConfirmAction(null);
    setRejectReason("");
  };

  const { mutate: approveClaim, isPending: isApproving } = useMutation({
    mutationFn: async () =>
      (
        await axiosPrivate.post("/api/hosts/transfer-nomad-listing", {
          nomadsCompanyId: claim.nomadsCompanyId,
          hostCompanyId: reviewTarget.companyId,
        })
      ).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Listings transferred");
      queryClient.invalidateQueries({ queryKey: CLAIMS_KEY });
      closeReview();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to transfer listings");
    },
  });

  const { mutate: rejectClaim, isPending: isRejecting } = useMutation({
    mutationFn: async () =>
      (
        await axiosPrivate.post(`/api/hosts/existing-company-claims/${reviewTarget.companyId}/reject`, {
          reason: rejectReason,
        })
      ).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Claim rejected");
      queryClient.invalidateQueries({ queryKey: CLAIMS_KEY });
      closeReview();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to reject claim");
    },
  });

  const counts = useMemo(() => {
    const result = { pending: 0, approved: 0, rejected: 0, all: claims.length };
    claims.forEach((c) => {
      const status = c.existingCompanyClaim?.status;
      if (result[status] !== undefined) result[status] += 1;
    });
    return result;
  }, [claims]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.existingCompanyClaim?.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.companyName?.toLowerCase().includes(q) ||
        c.existingCompanyClaim?.nomadsCompanyName?.toLowerCase().includes(q) ||
        c.existingCompanyClaim?.email?.toLowerCase().includes(q)
      );
    });
  }, [claims, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center min-h-[300px] text-slate-400 font-pmedium">
        Loading claims...
      </div>
    );
  }
  if (isError) {
    return <div className="p-6 text-red-500">Failed to load claims.</div>;
  }

  const listings = detail?.listings || [];
  const isPendingClaim = claim?.status === "pending";
  const th = "px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left";

  return (
    <>
      <div className="flex flex-col gap-4">
        <div data-tour="companies-claims-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-1 shrink-0">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-slate-400">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">
                  Total Claims
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{counts.all}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">
                  Pending
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{counts.pending}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">
                  Approved
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{counts.approved}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-rose-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">
                  Rejected
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{counts.rejected}</p>
              </div>
            </div>
        </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div data-tour="companies-claims-filters" className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
                  statusFilter === f.key
                    ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
                    : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search claims..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100/60">
              <tr>
                <th className={th}>Host Company</th>
                <th className={th}>Claims Company</th>
                <th className={th}>Listings</th>
                <th className={th}>Contact</th>
                <th className={th}>Requested</th>
                <th className={th}>Status</th>
                <th className={`${th} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">
                    No {statusFilter === "all" ? "" : `${statusFilter} `}claims.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const cl = c.existingCompanyClaim || {};
                  return (
                    <tr key={c._key} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 align-top text-[13px] font-pmedium text-slate-800">{c.companyName || "-"}</td>
                      <td className="px-5 py-4 align-top text-[13px] font-pmedium text-blue-700">
                        {cl.nomadsCompanyName || "-"}
                      </td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{cl.listingCount ?? "-"}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                        {cl.fullName}
                        <span className="block text-slate-400">{cl.email}</span>
                      </td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{formatDate(cl.requestedAt)}</td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-pmedium capitalize ${STATUS_STYLES[cl.status] || "bg-slate-100 text-slate-500"}`}
                        >
                          {cl.status || "-"}
                        </span>
                        {cl.status !== "pending" && cl.reviewedAt ? (
                          <span className="block mt-1 text-[10px] text-slate-400">{formatDate(cl.reviewedAt)}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top text-center">
                        <button
                          type="button"
                          onClick={() => setReviewTarget(c)}
                          title={cl.status === "pending" ? "Review claim" : "View claim"}
                          className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                        >
                          <Eye size={15} strokeWidth={2.5} />
                        </button>
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

      {reviewTarget ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={closeReview}>
          <div
            className="bg-white rounded-[2rem] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                  {reviewTarget.companyName} → {claim.nomadsCompanyName}
                </h2>
                <p className="text-[10px] font-pmedium text-slate-500 mt-1">
                  {isPendingClaim
                    ? `Approving links every listing under ${claim.nomadsCompanyName} to this host and folds in any listings the host added themselves. If that's more than the host's plan allows enabled, the host's own already-enabled listings keep their slots first, then this company's listings fill the rest, and anything beyond the limit is switched off.`
                    : `This claim was ${claim.status}${claim.reviewedAt ? ` on ${formatDate(claim.reviewedAt)}` : ""}${claim.reviewedBy ? ` by ${claim.reviewedBy}` : ""}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              {claim.status === "rejected" && claim.rejectionReason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-pmedium text-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5">Rejection reason</span>
                  {claim.rejectionReason}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 text-[12px] font-pmedium text-slate-700">
                {[
                  ["Contact", claim.fullName],
                  ["Role", claim.role],
                  ["Email", claim.email],
                  ["Mobile", claim.mobile],
                  ["Registered name", claim.registeredCompanyName],
                  ["Requested", formatDate(claim.requestedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
                    {value || "-"}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-2">Documents</p>
                {claim.documents?.length ? (
                  <div className="space-y-1.5">
                    {claim.documents.map((d) => (
                      <a
                        key={d.url}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-[12px] font-pmedium text-blue-700 hover:bg-blue-50"
                      >
                        <FileText size={14} /> {d.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-400">No documents attached.</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-2">
                  Listings under {claim.nomadsCompanyName}
                  {isLoadingDetail ? "" : ` (${listings.length})`}
                </p>
                {isLoadingDetail ? (
                  <p className="text-[12px] text-slate-400">Loading...</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {listings.length === 0 ? (
                      <p className="p-3 text-[12px] text-slate-500">No listings under this company.</p>
                    ) : (
                      listings.map((l) => {
                        const isLive = l.isActive && l.isPublic;
                        const url = getLiveListingUrl(l);
                        return (
                          <div key={l.businessId} className="flex items-center justify-between gap-3 p-3 text-[12px] font-pmedium">
                            {url && isLive ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open this listing on wono.co in a new tab"
                                className="flex items-center gap-1.5 text-blue-700 hover:underline"
                              >
                                {l.companyTitle || "Untitled"} <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-slate-800" title="Not live on wono.co, so there is no public page to open">
                                {l.companyTitle || "Untitled"}
                              </span>
                            )}
                            <span className="text-slate-500 capitalize">
                              {[l.companyType, l.city, isLive ? "live" : l.isActive ? "active, hidden" : "inactive"]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {confirmAction === "reject" && (
                <div>
                  <p className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-2">
                    Reason (shown to the host)
                  </p>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[12px] font-pmedium outline-none focus:ring-2 focus:ring-rose-200"
                    placeholder="e.g. Registration certificate doesn't match the company name"
                  />
                </div>
              )}

              {confirmAction && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-pmedium text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  {confirmAction === "approve" ? (
                    <div>
                      Are you sure? This links <b>{listings.length}</b> listing{listings.length === 1 ? "" : "s"} of{" "}
                      <b>{claim.nomadsCompanyName}</b> to <b>{reviewTarget.companyName}</b> and moves the host's own
                      listings into that company. It can't be undone from this screen.
                    </div>
                  ) : (
                    <div>
                      Are you sure? <b>{reviewTarget.companyName}</b> will see this claim as rejected
                      {rejectReason.trim() ? " with your reason" : " with no reason given"} and can submit it again.
                    </div>
                  )}
                </div>
              )}
            </div>

            {isPendingClaim ? (
              <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                {confirmAction ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50"
                    >
                      Back
                    </button>
                    {confirmAction === "approve" ? (
                      <button
                        type="button"
                        disabled={isApproving}
                        onClick={() => approveClaim()}
                        className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isApproving ? "Transferring..." : "Yes, approve & transfer"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isRejecting}
                        onClick={() => rejectClaim()}
                        className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-rose-700 disabled:opacity-50"
                      >
                        {isRejecting ? "Rejecting..." : "Yes, reject"}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmAction("reject")}
                      className="px-6 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-rose-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={isLoadingDetail || detail?.alreadyLinked}
                      onClick={() => setConfirmAction("approve")}
                      title={detail?.alreadyLinked ? "This host is already linked to a company" : ""}
                      className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={closeReview}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ExistingCompanyClaims;
