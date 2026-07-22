import React, { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Search,
  Sparkles,
  Star,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const REVIEW_TABS = {
  nomadListings: 0,
  eventReviews: 1,
  placeReviews: 2,
};

const STATUSES = ["pending", "approved", "rejected"];

const formatDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  return isValid(d) ? format(d, "dd MMM yyyy") : "—";
};

const formatDateTime = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitials = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "RV";

const formatNomadsType = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const labels = {
    coworking: "Coworking",
    meetingroom: "Meeting Room",
    cafe: "Cafe",
    workation: "Workation",
    coliving: "Co-living",
    hostel: "Hostel",
  };
  return labels[normalized] || (value ? String(value) : "—");
};

const StarRating = ({ count }) => {
  const n = Number(count);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 5)
    return <span className="text-slate-400 text-[12px] font-semibold">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} className={i < n ? "text-amber-400 fill-amber-400" : "text-slate-300"} />
      ))}
    </div>
  );
};

const getReviewerActionByName = (review) => {
  const extractName = (user) => {
    if (!user) return "";
    if (typeof user === "string") return user;
    const firstName = user?.firstName || "";
    const lastName = user?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || user?.fullName || user?.name || user?.username || user?.email || "";
  };

  const extractActionUserName = (actionBy) => {
    if (!actionBy) return "";
    if (typeof actionBy === "string") return actionBy;
    const userType = String(actionBy?.userType || "").toUpperCase();
    const nestedUser = actionBy?.user;
    if (userType === "MASTER") {
      const masterName = `${nestedUser?.firstName || ""} ${nestedUser?.lastName || ""}`.trim();
      return masterName || extractName(nestedUser) || extractName(actionBy);
    }
    if (userType === "HOST") {
      return nestedUser?.name || extractName(nestedUser) || extractName(actionBy);
    }
    return extractName(nestedUser) || extractName(actionBy);
  };

  const status = String(review?.status || "").toLowerCase().trim();
  if (status === "approved") {
    return extractName(review?.approvedByName) || extractActionUserName(review?.approvedBy) || "—";
  }
  if (status === "rejected") {
    return extractName(review?.rejectedByName) || extractActionUserName(review?.rejectedBy) || "—";
  }
  return "—";
};

const CompanyReviews = () => {
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(REVIEW_TABS.nomadListings);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["companyReviews", "all-nomad-listings"],
    queryFn: async () => {
      const extractReviews = (response) => {
        const payload = response?.data;
        const reviews =
          payload?.reviews ?? payload?.data?.reviews ?? payload?.data ?? payload;
        return Array.isArray(reviews) ? reviews : [];
      };
      const response = await axiosPrivate.get("/api/admin/reviews", {
        params: { reviewScope: "nomads", allCompanies: true },
        headers: { "Cache-Control": "no-cache" },
      });
      const mergedReviews = extractReviews(response);
      const uniqueReviews = new Map();
      mergedReviews.forEach((review, index) => {
        const reviewId = review?._id || review?.id;
        if (!reviewId || !uniqueReviews.has(reviewId)) {
          uniqueReviews.set(reviewId || `review-${index}`, review);
        }
      });
      return Array.from(uniqueReviews.values());
    },
  });

  const {
    data: eventReviews = [],
    isPending: isEventReviewsPending,
    isError: isEventReviewsError,
  } = useQuery({
    queryKey: ["eventReviews"],
    enabled: activeTab === REVIEW_TABS.eventReviews,
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/event-reviews/all`, {
        headers: { "Cache-Control": "no-cache" },
      });
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const {
    data: placeReviews = [],
    isPending: isPlaceReviewsPending,
    isError: isPlaceReviewsError,
  } = useQuery({
    queryKey: ["placeReviews"],
    enabled: activeTab === REVIEW_TABS.placeReviews,
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/place-reviews/all`, {
        headers: { "Cache-Control": "no-cache" },
      });
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const updateReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(`/api/admin/review/${reviewId}`, {
        status,
        ...(selectedCompany?.companyId ? { companyId: selectedCompany.companyId } : {}),
        ...(selectedCompany?.companyName ? { companyName: selectedCompany.companyName } : {}),
      });
      return response?.data;
    },
    onSuccess: (_data, { updates }) => {
      if (Object.prototype.hasOwnProperty.call(updates, "isEnabled")) {
        toast.success(updates.isEnabled ? "Review enabled." : "Review disabled.");
      } else {
        toast.success(updates.status === "approved" ? "Review approved." : "Review rejected.");
      }
      queryClient.invalidateQueries({ queryKey: ["companyReviews"] });
      setConfirmAction(null);
      setSelectedReviewId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update review.");
    },
  });

  const updateEventReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(`${NOMADS_API_BASE_URL}/event-reviews/${reviewId}/status`, { status });
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventReviews"] });
      toast.success("Event review updated.");
      setConfirmAction(null);
      setSelectedReviewId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update event review.");
    },
  });

  const updatePlaceReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(`${NOMADS_API_BASE_URL}/place-reviews/${reviewId}/status`, { status });
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placeReviews"] });
      toast.success("Place review updated.");
      setConfirmAction(null);
      setSelectedReviewId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update place review.");
    },
  });

  const handleStatusChange = (reviewId, newStatus, scope) => {
    setConfirmAction({ reviewId, updates: { status: newStatus }, scope });
  };

  const confirmReviewChange = () => {
    if (!confirmAction) return;
    const { reviewId, updates, scope } = confirmAction;
    if (scope === "nomad") updateReviewStatusMutation.mutate({ reviewId, updates });
    else if (scope === "event") updateEventReviewStatusMutation.mutate({ reviewId, status: updates.status });
    else if (scope === "place") updatePlaceReviewStatusMutation.mutate({ reviewId, status: updates.status });
  };

  const nomadReviews = useMemo(() => {
    const statusOrder = { pending: 0, rejected: 1, approved: 2 };
    return (Array.isArray(data) ? data : [])
      .slice()
      .sort((a, b) => {
        const aStatus = String(a?.status || "pending").toLowerCase();
        const bStatus = String(b?.status || "pending").toLowerCase();
        const aRank = statusOrder[aStatus] ?? 99;
        const bRank = statusOrder[bStatus] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        const aDate = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const bDate = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
      });
  }, [data]);

  const visibleNomadReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return nomadReviews.filter((r) => {
      const matchesStage = stageFilter === "all" || (r.status || "pending") === stageFilter;
      const matchesQuery = !query || [r.name, r.reviewerName, r.reviewSource, r.companyType, r.description, r.review]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
      return matchesStage && matchesQuery;
    });
  }, [nomadReviews, searchQuery, stageFilter]);

  const visibleEventReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return eventReviews.filter((r) => {
      const matchesStage = stageFilter === "all" || (r.status || "pending") === stageFilter;
      const matchesQuery = !query || [r.reviewerName, r.name, r.eventName, r.description, r.review]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
      return matchesStage && matchesQuery;
    });
  }, [eventReviews, searchQuery, stageFilter]);

  const visiblePlaceReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return placeReviews.filter((r) => {
      const matchesStage = stageFilter === "all" || (r.status || "pending") === stageFilter;
      const matchesQuery = !query || [r.reviewerName, r.name, r.placeName, r.description, r.review]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
      return matchesStage && matchesQuery;
    });
  }, [placeReviews, searchQuery, stageFilter]);

  const getActiveReviews = () => {
    if (activeTab === REVIEW_TABS.nomadListings) return visibleNomadReviews;
    if (activeTab === REVIEW_TABS.eventReviews) return visibleEventReviews;
    return visiblePlaceReviews;
  };

  const getActiveStats = () => {
    const reviews = activeTab === REVIEW_TABS.nomadListings ? nomadReviews
      : activeTab === REVIEW_TABS.eventReviews ? eventReviews : placeReviews;
    const total = reviews.length;
    const pending = reviews.filter((r) => (r.status || "pending") === "pending").length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const rejected = reviews.filter((r) => r.status === "rejected").length;
    return [
      { label: "Total Reviews", value: total, icon: Target },
      { label: "Pending", value: pending, icon: Sparkles },
      { label: "Approved", value: approved, icon: BadgeCheck },
      { label: "Rejected", value: rejected, icon: X },
    ];
  };

  const selectedReview = useMemo(() => {
    const allReviews = activeTab === REVIEW_TABS.nomadListings ? nomadReviews
      : activeTab === REVIEW_TABS.eventReviews ? eventReviews : placeReviews;
    return allReviews.find((r) => r._id === selectedReviewId) || null;
  }, [selectedReviewId, nomadReviews, eventReviews, placeReviews, activeTab]);

  const activeStats = getActiveStats();
  const activeReviews = getActiveReviews();
  const activeScope = activeTab === REVIEW_TABS.nomadListings ? "nomad"
    : activeTab === REVIEW_TABS.eventReviews ? "event" : "place";

  const isLoading = activeTab === REVIEW_TABS.nomadListings ? isPending
    : activeTab === REVIEW_TABS.eventReviews ? isEventReviewsPending : isPlaceReviewsPending;
  const hasError = activeTab === REVIEW_TABS.nomadListings ? isError
    : activeTab === REVIEW_TABS.eventReviews ? isEventReviewsError : isPlaceReviewsError;

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4 text-slate-700 font-sans">

          <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">Company Reviews</h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Manage reviews from Nomads, Events, and Places across all companies.
              </p>
            </div>
          </div>

          <div role="tablist" aria-label="Review type"
            className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            {[
              { key: REVIEW_TABS.nomadListings, label: "Nomad Listing Reviews" },
              { key: REVIEW_TABS.eventReviews, label: "Event Reviews" },
              { key: REVIEW_TABS.placeReviews, label: "Places Reviews" },
            ].map(({ key, label }) => (
              <button key={key} type="button" role="tab"
                aria-selected={activeTab === key}
                onClick={() => { setActiveTab(key); setSearchQuery(""); setStageFilter("all"); }}
                className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all text-center ${
                  activeTab === key
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="h-3 w-20 bg-slate-100 rounded-lg mb-2" />
                    <div className="h-5 w-10 bg-slate-100 rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between gap-3">
                  <div className="h-8 w-56 rounded-xl bg-slate-200" />
                  <div className="h-9 w-72 rounded-xl bg-slate-200" />
                </div>
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-slate-100" />
                  ))}
                </div>
              </div>
            </div>
          ) : hasError ? (
            <div className="py-12 text-center text-red-500 text-sm font-semibold">Failed to load reviews. Please try again.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                {activeStats.map(({ label, value, icon: Icon }, idx) => {
                  const tones = [
                    { border: "border-l-4 border-l-slate-400", labelClass: "text-slate-500", iconBg: "bg-slate-50 text-slate-600" },
                    { border: "border-l-4 border-l-amber-500", labelClass: "text-amber-600", iconBg: "bg-amber-50 text-amber-600" },
                    { border: "border-l-4 border-l-emerald-500", labelClass: "text-emerald-600", iconBg: "bg-emerald-50 text-emerald-600" },
                    { border: "border-l-4 border-l-rose-500", labelClass: "text-rose-600", iconBg: "bg-rose-50 text-rose-600" },
                  ][idx];
                  return (
                    <div key={label} className={`bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md ${tones.border}`}>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${tones.labelClass}`}>{label}</p>
                        <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
                      </div>
                      <div className={`p-2 rounded-2xl shrink-0 ${tones.iconBg}`}><Icon size={16} /></div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
                  <div className="w-full overflow-x-auto mb-3 [&::-webkit-scrollbar]:hidden">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button onClick={() => setStageFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${stageFilter === "all" ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"}`}
                      >All</button>
                      {STATUSES.map((status) => (
                        <button key={status} onClick={() => setStageFilter(status)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${stageFilter === status ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"}`}
                        >{status.charAt(0).toUpperCase() + status.slice(1)}</button>
                      ))}
                    </div>
                  </div>
                  <div />
                  <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input type="text" placeholder="Search by name, source, description..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
                    </div>
                  </div>
                </div>

                {activeReviews.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Target size={28} /></div>
                    <p className="text-slate-400 font-semibold">No matching reviews found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left min-w-[920px]">
                      <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                        <tr>
                          {activeTab === REVIEW_TABS.nomadListings ? (
                            <>
                              <th className="px-5 py-4">Reviewer</th>
                              <th className="px-5 py-4">Rating</th>
                              <th className="px-5 py-4">Description</th>
                              <th className="px-5 py-4">Source</th>
                              <th className="px-5 py-4">Reviewed By</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Product Type</th>
                              <th className="px-5 py-4 text-center">Action</th>
                            </>
                          ) : activeTab === REVIEW_TABS.eventReviews ? (
                            <>
                              <th className="px-5 py-4">Reviewer</th>
                              <th className="px-5 py-4">Event</th>
                              <th className="px-5 py-4">Location</th>
                              <th className="px-5 py-4">Rating</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Created</th>
                              <th className="px-5 py-4 text-center">Action</th>
                            </>
                          ) : (
                            <>
                              <th className="px-5 py-4">Reviewer</th>
                              <th className="px-5 py-4">Place</th>
                              <th className="px-5 py-4">Location</th>
                              <th className="px-5 py-4">Rating</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Created</th>
                              <th className="px-5 py-4 text-center">Action</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {activeReviews.map((review) => {
                          const reviewId = review._id || review.id;
                          const status = (review.status || "pending").toLowerCase();
                          return (
                            <tr key={reviewId} className="hover:bg-slate-50/50 transition-colors group">
                              {activeTab === REVIEW_TABS.nomadListings ? (
                                <>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(review.name || review.reviewerName)}</div>
                                      <p className="text-[12px] font-pmedium text-slate-900">{review.name || review.reviewerName || "—"}</p>
                                    </div>
                                  </td>
                                  <td className="px-5 py-4"><StarRating count={review.starCount || review.rating || review.ratingValue} /></td>
                                  <td className="px-5 py-4 max-w-[220px]"><p className="text-[12px] font-pmedium text-slate-600 truncate">{review.description || review.review || "—"}</p></td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-700">{review.reviewSource || "—"}</span></td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-600">{getReviewerActionByName(review)}</span></td>
                                  <td className="px-5 py-4"><span className={statusPillClass(status)}>{status}</span></td>
                                  <td className="px-5 py-4"><span className="inline-flex whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-pmedium text-blue-700">{formatNomadsType(review.companyType)}</span></td>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button type="button" onClick={() => setSelectedReviewId(reviewId)}
                                        className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"><Eye size={15} strokeWidth={2.5} /></button>
                                    </div>
                                  </td>
                                </>
                              ) : activeTab === REVIEW_TABS.eventReviews ? (
                                <>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(review.reviewerName || review.name)}</div>
                                      <p className="text-[12px] font-pmedium text-slate-900">{review.reviewerName || review.name || "—"}</p>
                                    </div>
                                  </td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-700">{review.eventName || "—"}</span></td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-600">{[review.country, review.state].filter(Boolean).join(", ") || "—"}</span></td>
                                  <td className="px-5 py-4"><StarRating count={review.starCount || review.rating || review.ratingValue} /></td>
                                  <td className="px-5 py-4"><span className={statusPillClass(status)}>{status}</span></td>
                                  <td className="px-5 py-4"><p className="text-[12px] font-pmedium text-slate-700">{formatDateTime(review.createdAt)}</p></td>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button type="button" onClick={() => setSelectedReviewId(reviewId)}
                                        className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"><Eye size={15} strokeWidth={2.5} /></button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(review.reviewerName || review.name)}</div>
                                      <p className="text-[12px] font-pmedium text-slate-900">{review.reviewerName || review.name || "—"}</p>
                                    </div>
                                  </td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-700">{review.placeName || "—"}</span></td>
                                  <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-600">{[review.country, review.state].filter(Boolean).join(", ") || "—"}</span></td>
                                  <td className="px-5 py-4"><StarRating count={review.starCount || review.rating || review.ratingValue} /></td>
                                  <td className="px-5 py-4"><span className={statusPillClass(status)}>{status}</span></td>
                                  <td className="px-5 py-4"><p className="text-[12px] font-pmedium text-slate-700">{formatDateTime(review.createdAt)}</p></td>
                                  <td className="px-5 py-4">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button type="button" onClick={() => setSelectedReviewId(reviewId)}
                                        className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"><Eye size={15} strokeWidth={2.5} /></button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PageFrame>

      {selectedReview && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedReviewId(null)}>
          <div className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  {getInitials(selectedReview.name || selectedReview.reviewerName)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">{selectedReview.name || selectedReview.reviewerName || "Anonymous"}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={statusPillClass(selectedReview.status || "pending")}>{selectedReview.status || "pending"}</span>
                    {selectedReview.reviewSource && <span className={statusPillClass(selectedReview.reviewSource)}>{selectedReview.reviewSource}</span>}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedReviewId(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <Star size={14} /> Review Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Rating</p>
                    <StarRating count={selectedReview.starCount || selectedReview.rating || selectedReview.ratingValue} />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Source</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedReview.reviewSource || "—"}</p>
                  </div>
                  {activeScope === "nomad" && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Product Type</p>
                      <p className="text-[12px] font-pmedium text-slate-900 whitespace-nowrap">{formatNomadsType(selectedReview.companyType)}</p>
                    </div>
                  )}
                  {activeScope === "nomad" && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Reviewed By</p>
                      <p className="text-[12px] font-pmedium text-slate-900">{getReviewerActionByName(selectedReview)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Received On</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatDate(selectedReview.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <FileText size={14} /> Description
                </h3>
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[12px] font-pmedium leading-5 text-slate-700">{selectedReview.description || selectedReview.review || "No description provided."}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2.5">
              {(selectedReview.status || "pending") === "pending" ? (
                <>
                  <button type="button" onClick={() => handleStatusChange(selectedReview._id || selectedReview.id, "rejected", activeScope)}
                    className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl font-pmedium text-[12px] hover:bg-red-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  ><XCircle size={14} /> Reject</button>
                  <button type="button" onClick={() => handleStatusChange(selectedReview._id || selectedReview.id, "approved", activeScope)}
                    className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
                  ><CheckCircle2 size={14} /> Approve</button>
                </>
              ) : selectedReview.status === "approved" ? (
                <>
                  <button type="button" onClick={() => setSelectedReviewId(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-slate-100 transition-colors">Close</button>
                  <span className="flex-1 flex items-center justify-center text-[11px] font-pmedium text-slate-500">This review has already been {selectedReview.status}.</span>
                </>
              ) : (
                <>
                  <span className="flex-1 flex items-center justify-center text-[11px] font-pmedium text-slate-500">This review has already been {selectedReview.status}.</span>
                  <button type="button" onClick={() => setSelectedReviewId(null)} className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all">Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#0F172A]/60 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative z-10 flex flex-col w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 mb-4">
              <AlertTriangle size={28} className="text-amber-500" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-2">
              {confirmAction.updates.status === "approved" ? "Approve Review?" : "Reject Review?"}
            </h3>
            <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-6">
              {confirmAction.updates.status === "approved"
                ? "Once approved, this review may be displayed publicly. This action cannot be undone."
                : "Once rejected, this review will never be displayed. This action cannot be undone."}
            </p>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
              >Cancel</button>
              <button type="button" onClick={confirmReviewChange}
                className={`flex-1 rounded-xl px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-widest text-white transition ${
                  confirmAction.updates.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >Yes, {confirmAction.updates.status === "approved" ? "Approve" : "Reject"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyReviews;
