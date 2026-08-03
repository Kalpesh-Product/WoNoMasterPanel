import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Globe,
  EyeOff,
  X,
  Eye,
  Search,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import MuiModal from "../../../components/MuiModal";
import { statusPillClass, STATUS_PILL_BASE } from "../../../lib/status-pill";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 700;

const normalizeType = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const TYPE_LABELS = {
  coworking: "Co-working",
  coliving: "Co-living",
  hostel: "Hostel",
  hostels: "Hostel",
  privatestay: "Private Stay",
  meetingroom: "Meeting Room",
  cafe: "Cafe",
  workation: "Workation",
};

const formatTypeLabel = (value) => {
  const key = normalizeType(value);
  if (TYPE_LABELS[key]) return TYPE_LABELS[key];
  const raw = String(value || "").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Unknown";
};

const getInitials = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "N";

const STAT_TONES = {
  slate: {
    border: "border-l-4 border-l-slate-400",
    label: "text-slate-400",
    icon: "bg-slate-50 text-slate-600",
  },
  emerald: {
    border: "border-l-4 border-l-emerald-500",
    label: "text-emerald-600",
    icon: "bg-emerald-50 text-emerald-600",
  },
  rose: {
    border: "border-l-4 border-l-rose-500",
    label: "text-rose-600",
    icon: "bg-rose-50 text-rose-600",
  },
  blue: {
    border: "border-l-4 border-l-blue-500",
    label: "text-blue-600",
    icon: "bg-blue-50 text-blue-600",
  },
};

const StatTile = ({ label, value, icon: Icon, tone = "slate" }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.slate;
  return (
    <div
      className={`bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md ${styles.border}`}
    >
      <div className="min-w-0">
        <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${styles.label}`}>
          {label}
        </p>
        <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
      </div>
      {Icon ? (
        <div className={`p-2 rounded-2xl shrink-0 ${styles.icon}`}>
          <Icon size={16} />
        </div>
      ) : null}
    </div>
  );
};

const DetailField = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div>
      <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium mb-0.5">
        {label}
      </span>
      <span className="text-[12px] font-pmedium text-slate-800 break-words">{value}</span>
    </div>
  );
};

const selectClassName =
  "w-full px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400";

const tabButtonClass = (isActive) =>
  `px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
    isActive
      ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
      : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
  }`;

// Copy shown in the confirmation dialog for every publish/active action —
// bulk (by location) and per-row alike, since all four now require an
// explicit confirmation before firing.
const ACTION_COPY = {
  active: {
    title: "Make listing(s) active?",
    describeSingle: (item) =>
      `This makes "${item?.companyName || "this listing"}" active — visible internally to Wono team members with access, but not yet visible to the public. Use this to review and test before publishing.`,
    describeBulk: (label, count) =>
      `This makes ${count} inactive listing(s) in ${label} active — visible internally to Wono team members with access, but not yet visible to the public. Use this to review and test before publishing.`,
  },
  inactive: {
    title: "Make listing(s) inactive?",
    describeSingle: (item) =>
      `This makes "${item?.companyName || "this listing"}" inactive — hidden from everyone, including the Wono team, until reactivated. It will also stop being publicly visible if it was public.`,
    describeBulk: (label, count) =>
      `This makes ${count} active listing(s) in ${label} inactive — hidden from everyone, including the Wono team, until reactivated. Any of them that were public will also stop being visible.`,
  },
  public: {
    title: "Make listing(s) public?",
    describeSingle: (item) =>
      `This makes "${item?.companyName || "this listing"}" visible to everyone on the public Wono Nomads site. Make sure the Wono team's internal testing and review on this listing is complete before continuing.`,
    describeBulk: (label, count) =>
      `This makes ${count} active listing(s) in ${label} visible to everyone on the public Wono Nomads site. Make sure the Wono team's internal testing and review is complete before continuing.`,
  },
  private: {
    title: "Make listing(s) private?",
    describeSingle: (item) =>
      `This removes "${item?.companyName || "this listing"}" from the public site. It stays active and visible internally to the Wono team.`,
    describeBulk: (label, count) =>
      `This removes ${count} public listing(s) in ${label} from the public site. They stay active and visible internally to the Wono team.`,
  },
};

const PublishListings = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef(null);

  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [bulkAction, setBulkAction] = useState(null); // "public" | "private" | "active" | "inactive" | null
  const [rowAction, setRowAction] = useState(null); // { item, action } | null
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewListing, setViewListing] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Server paginates + aggregates so the client only ever downloads one
  // small page at a time — the stat/category counts and location dropdown
  // options come back on every page response, so they're ready the moment
  // the first 30 rows land instead of waiting on the full listings set.
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "publish-listings",
      statusFilter,
      visibilityFilter,
      typeFilter,
      debouncedSearch,
      country,
      state,
      city,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await axiosPrivate.get("/api/hosts/get-companies-listings", {
        params: {
          page: pageParam,
          limit: PAGE_SIZE,
          status: statusFilter,
          isPublic: visibilityFilter === "all" ? undefined : visibilityFilter === "public" ? "true" : "false",
          type: typeFilter,
          search: debouncedSearch,
          country,
          state,
          city,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const listings = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const firstPage = data?.pages?.[0];
  const totalMatching = firstPage?.total ?? 0;
  const globalCounts = firstPage?.globalCounts ?? {
    total: 0,
    active: 0,
    inactive: 0,
    public: 0,
    private: 0,
  };
  const categoryCounts = firstPage?.categoryCounts ?? [];
  const locationCounts = firstPage?.locationCounts ?? null;
  const filterOptions = firstPage?.filterOptions ?? { countries: [], states: [], cities: [] };

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, listings.length]);

  const handleCountryChange = (value) => {
    setCountry(value);
    setState("");
    setCity("");
  };

  const handleStateChange = (value) => {
    setState(value);
    setCity("");
  };

  const invalidateListings = () =>
    queryClient.invalidateQueries({ queryKey: ["publish-listings"] });

  const { mutate: bulkSetPublic, isPending: isBulkPublishPending } = useMutation({
    mutationFn: async (isPublic) => {
      const response = await axiosPrivate.patch("/api/hosts/bulk-set-public-status", {
        country,
        state,
        city: city || undefined,
        isPublic,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Listings updated");
      invalidateListings();
      setBulkAction(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update listings");
      setBulkAction(null);
    },
  });

  const { mutate: bulkSetActive, isPending: isBulkActivePending } = useMutation({
    mutationFn: async (isActive) => {
      const response = await axiosPrivate.patch("/api/hosts/bulk-set-active-status", {
        country,
        state,
        city: city || undefined,
        isActive,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Listings updated");
      invalidateListings();
      setBulkAction(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update listings");
      setBulkAction(null);
    },
  });

  const isBulkPending = isBulkPublishPending || isBulkActivePending;

  const { mutate: toggleSinglePublic, isPending: isTogglingPublic } = useMutation({
    mutationFn: async ({ businessId, isPublic }) => {
      const response = await axiosPrivate.patch("/api/hosts/set-public-status", {
        businessId,
        isPublic,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Visibility updated");
      invalidateListings();
      setRowAction(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update visibility");
      setRowAction(null);
    },
  });

  const { mutate: toggleSingleActive, isPending: isTogglingActive } = useMutation({
    mutationFn: async ({ businessId, status }) => {
      const response = await axiosPrivate.patch("/api/hosts/activate-product", {
        businessId,
        status,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Status updated");
      invalidateListings();
      setRowAction(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
      setRowAction(null);
    },
  });

  const isRowPending = isTogglingPublic || isTogglingActive;

  const confirmRowAction = () => {
    if (!rowAction) return;
    const { item, action } = rowAction;
    if (action === "public") toggleSinglePublic({ businessId: item.businessId, isPublic: true });
    else if (action === "private") toggleSinglePublic({ businessId: item.businessId, isPublic: false });
    else if (action === "active") toggleSingleActive({ businessId: item.businessId, status: true });
    else if (action === "inactive") toggleSingleActive({ businessId: item.businessId, status: false });
  };

  const canSubmit = Boolean(country && state) && !isBulkPending;
  const locationLabel = [country, state, city].filter(Boolean).join(" > ");

  return (
    <div className="min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">
              Publish Listings
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Overview of every listing across Wono Nomads — manage visibility
              individually or in bulk by location.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile label="Total Listings" value={globalCounts.total} icon={Layers} />
            <StatTile label="Active" value={globalCounts.active} icon={CheckCircle2} tone="emerald" />
            <StatTile label="Inactive" value={globalCounts.inactive} icon={XCircle} tone="rose" />
            <StatTile label="Public" value={globalCounts.public} icon={Globe} tone="blue" />
            <StatTile label="Private" value={globalCounts.private} icon={EyeOff} />
          </div>

          {categoryCounts.length > 0 && (
            <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-4">
              <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium mb-2.5">
                Listings by Category
              </span>
              <div className="flex flex-wrap gap-2">
                {categoryCounts.map((category) => (
                  <div
                    key={category.key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="text-[11px] font-pmedium text-slate-600">
                      {formatTypeLabel(category.key)}
                    </span>
                    <span className="text-[11px] font-pmedium text-slate-900 bg-white rounded-full px-2 py-0.5 border border-slate-200">
                      {category.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                Country
              </label>
              <select
                className={selectClassName}
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">Select country</option>
                {filterOptions.countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                State
              </label>
              <select
                className={selectClassName}
                value={state}
                disabled={!country}
                onChange={(e) => handleStateChange(e.target.value)}
              >
                <option value="">Select state</option>
                {filterOptions.states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">
                City (optional)
              </label>
              <select
                className={selectClassName}
                value={city}
                disabled={!state}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">All cities</option>
                {filterOptions.cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {country && state && locationCounts && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Total listings</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{locationCounts.total}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Active</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{locationCounts.active}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Inactive</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{locationCounts.inactive}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Public</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{locationCounts.public}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium">Private</span>
                  <span className="text-lg font-pmedium text-[#0F172A]">{locationCounts.private}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canSubmit || !(locationCounts.inactive > 0)}
                  onClick={() => setBulkAction("active")}
                  title={
                    !(locationCounts.inactive > 0)
                      ? "No inactive listings here"
                      : "Make all inactive listings here active"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-pmedium text-[11px] uppercase tracking-wider hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Make Active
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || !(locationCounts.active > 0)}
                  onClick={() => setBulkAction("inactive")}
                  title={
                    !(locationCounts.active > 0)
                      ? "No active listings here"
                      : "Make all active listings here inactive"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-pmedium text-[11px] uppercase tracking-wider hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <XCircle size={14} strokeWidth={2.5} />
                  Make Inactive
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || !(locationCounts.active > 0)}
                  onClick={() => setBulkAction("public")}
                  title={
                    !(locationCounts.active > 0)
                      ? "No active listings here to publish"
                      : "Make all active listings here public"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg font-pmedium text-[11px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Globe size={14} strokeWidth={2.5} />
                  Make Public
                </button>
                <button
                  type="button"
                  disabled={!canSubmit || !(locationCounts.public > 0)}
                  onClick={() => setBulkAction("private")}
                  title={
                    !(locationCounts.public > 0)
                      ? "No public listings here to revert"
                      : "Make all listings here private"
                  }
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-pmedium text-[11px] uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <EyeOff size={14} strokeWidth={2.5} />
                  Make Private
                </button>
              </div>
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col mt-1">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {["all", "active", "inactive"].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={tabButtonClass(statusFilter === filter)}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {["all", "public", "private"].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setVisibilityFilter(filter)}
                      className={tabButtonClass(visibilityFilter === filter)}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full flex-wrap">
                <select
                  className={`${selectClassName} !w-auto min-w-[140px]`}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  {categoryCounts.map((category) => (
                    <option key={category.key} value={category.key}>
                      {formatTypeLabel(category.key)}
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search by name, type, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="text-[11px] font-pmedium text-slate-500 whitespace-nowrap">
                  {listings.length < totalMatching
                    ? `Showing ${listings.length} of ${totalMatching}`
                    : `${totalMatching} listing${totalMatching === 1 ? "" : "s"}`}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-5 py-4">Sr No</th>
                    <th className="px-5 py-4">Company Name</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Country</th>
                    <th className="px-5 py-4">State</th>
                    <th className="px-5 py-4">City</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Visibility</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-slate-400 font-pmedium">
                        Loading listings...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-rose-500 font-pmedium">
                        Failed to load listings.
                      </td>
                    </tr>
                  ) : listings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mx-auto">
                          <Layers size={28} />
                        </div>
                        <p className="text-slate-400 font-pmedium">No listings found.</p>
                      </td>
                    </tr>
                  ) : (
                    listings.map((item, index) => (
                      <tr
                        key={item._id || item.businessId || index}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-400">{index + 1}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[9px] font-pmedium text-white shadow-sm">
                              {getInitials(item.companyName)}
                            </div>
                            <p className="text-[12px] font-pmedium text-slate-900">{item.companyName || "—"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600">
                          {formatTypeLabel(item.companyType)}
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600">{item.country || "—"}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600">{item.state || "—"}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600">{item.city || "—"}</td>
                        <td className="px-5 py-4">
                          <span className={statusPillClass(item.isActive ? "Active" : "Inactive")}>
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`${STATUS_PILL_BASE} ${item.isPublic ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                            {item.isPublic ? "Public" : "Private"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewListing(item)}
                              title="View listing"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                            >
                              <Eye size={15} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              disabled={isRowPending}
                              onClick={() => setRowAction({ item, action: item.isActive ? "inactive" : "active" })}
                              title={item.isActive ? "Mark as inactive" : "Mark as active"}
                              className={`p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${item.isActive ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                            >
                              {item.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            </button>
                            <button
                              type="button"
                              disabled={isRowPending || !item.isActive}
                              onClick={() => setRowAction({ item, action: item.isPublic ? "private" : "public" })}
                              title={
                                !item.isActive
                                  ? "Activate this listing before making it public"
                                  : item.isPublic
                                    ? "Make private"
                                    : "Make public"
                              }
                              className={`p-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${item.isPublic ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
                            >
                              <Globe size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {hasNextPage ? (
                    <tr ref={loadMoreRef}>
                      <td colSpan={9} className="py-4 text-center">
                        {isFetchingNextPage ? (
                          <span className="text-[11px] font-pmedium uppercase tracking-widest text-slate-400">
                            Loading more listings...
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageFrame>

      {bulkAction ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => !isBulkPending && setBulkAction(null)}
        >
          <div
            className="bg-white rounded-[1.5rem] max-w-md w-full shadow-2xl overflow-hidden border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <span className="text-base font-pmedium text-slate-800">
                {ACTION_COPY[bulkAction].title}
              </span>
              <button
                type="button"
                onClick={() => !isBulkPending && setBulkAction(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-[13px] text-slate-600">
              <p>
                {ACTION_COPY[bulkAction].describeBulk(
                  locationLabel,
                  bulkAction === "active"
                    ? locationCounts?.inactive ?? 0
                    : bulkAction === "inactive"
                      ? locationCounts?.active ?? 0
                      : bulkAction === "public"
                        ? locationCounts?.active ?? 0
                        : locationCounts?.public ?? 0,
                )}
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkAction(null)}
                disabled={isBulkPending}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (bulkAction === "active") bulkSetActive(true);
                  else if (bulkAction === "inactive") bulkSetActive(false);
                  else if (bulkAction === "public") bulkSetPublic(true);
                  else bulkSetPublic(false);
                }}
                disabled={isBulkPending}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isBulkPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MuiModal
        open={!!rowAction}
        onClose={() => !isRowPending && setRowAction(null)}
        title={rowAction ? ACTION_COPY[rowAction.action].title : ""}
      >
        {rowAction ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              {ACTION_COPY[rowAction.action].describeSingle(rowAction.item)}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRowAction(null)}
                disabled={isRowPending}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRowAction}
                disabled={isRowPending}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isRowPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : null}
      </MuiModal>

      <MuiModal
        open={!!viewListing}
        onClose={() => setViewListing(null)}
        title={viewListing?.companyName || "Listing Details"}
      >
        {viewListing ? (
          <div className="flex flex-col gap-4 text-[12px]">
            {viewListing.images?.[0]?.url || viewListing.logo?.url ? (
              <img
                src={viewListing.images?.[0]?.url || viewListing.logo?.url}
                alt={viewListing.companyName || "Listing"}
                className="w-full h-40 object-cover rounded-xl border border-slate-100"
              />
            ) : null}

            <div className="flex items-center gap-2 flex-wrap">
              <span className={statusPillClass(viewListing.isActive ? "Active" : "Inactive")}>
                {viewListing.isActive ? "Active" : "Inactive"}
              </span>
              <span
                className={`${STATUS_PILL_BASE} ${viewListing.isPublic ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
              >
                {viewListing.isPublic ? "Public" : "Private"}
              </span>
              <span className={`${STATUS_PILL_BASE} bg-slate-100 text-slate-600`}>
                {formatTypeLabel(viewListing.companyType)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailField label="Business ID" value={viewListing.businessId} />
              <DetailField label="Listing Title" value={viewListing.companyTitle} />
              <DetailField label="Country" value={viewListing.country} />
              <DetailField label="State" value={viewListing.state} />
              <DetailField label="City" value={viewListing.city} />
              <DetailField label="Address" value={viewListing.address} />
              <DetailField label="Cost" value={viewListing.cost} />
              <DetailField
                label="Ratings"
                value={
                  viewListing.ratings
                    ? `${viewListing.ratings} (${viewListing.totalReviews || 0} reviews)`
                    : ""
                }
              />
              <DetailField label="Website" value={viewListing.website} />
            </div>

            {viewListing.about || viewListing.description ? (
              <div>
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium mb-1">
                  About
                </span>
                <p className="text-slate-600 text-[12px] leading-relaxed">
                  {viewListing.about || viewListing.description}
                </p>
              </div>
            ) : null}

            {Array.isArray(viewListing.inclusions) && viewListing.inclusions.length > 0 ? (
              <div>
                <span className="block text-[9px] uppercase tracking-widest text-slate-500 font-pmedium mb-1.5">
                  Inclusions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {viewListing.inclusions.map((inclusion, idx) => (
                    <span
                      key={idx}
                      className={`${STATUS_PILL_BASE} bg-slate-100 text-slate-600 normal-case`}
                    >
                      {inclusion}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </MuiModal>
    </div>
  );
};

export default PublishListings;
