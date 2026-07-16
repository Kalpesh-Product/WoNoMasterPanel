import { useMemo, useState } from "react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useMutation, useQuery } from "@tanstack/react-query";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { queryClient } from "../../../main";
import MuiModal from "../../../components/MuiModal";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import {
  ArrowRightLeft,
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Search,
  Tags,
  Target,
  XCircle,
} from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";

const CONTINENT_OPTIONS = [
  "Asia",
  "Europe",
  "Africa",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

const formatDate = (raw) => {
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
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

export default function NomadListingsOverview({
  hideTransfer = false,
  companyIdOverride,
  companyNameOverride,
  showTransferToCompanyButton = false,
  transferToCompanyData = {},
} = {}) {
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedHostCompanyId, setSelectedHostCompanyId] = useState("");
  const [isTransferToCompanyModalOpen, setIsTransferToCompanyModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [transferToCompanyContinent, setTransferToCompanyContinent] = useState(
    transferToCompanyData?.companyContinent || "",
  );
  const navigate = useNavigate();
  // const location = useLocation();
  // const { companyId } = location?.state || "";

  // backward navigation support
  const location = useLocation();
  const navState = location?.state || {};
  const axios = useAxiosPrivate();
  const nativeCompanyId =
    companyIdOverride ||
    navState.companyId ||
    sessionStorage.getItem("companyId") ||
    "";
  const companyName =
    companyNameOverride ||
    navState.companyName ||
    sessionStorage.getItem("companyName") ||
    "";

  // A Companies-page entry created via the "Companies Requests" flow has no
  // Nomads company of its own — the real data lives under the Host
  // Company's own companyId (`linkedHostCompanyId`). Only resolve this when
  // no override was passed in (Host-Companies reuse already resolved its
  // own correct id via HostCompanyNomadListingOverview).
  const shouldResolveSource = !companyIdOverride;

  const { data: sourceMeta, isPending: isSourcePending } = useQuery({
    queryKey: ["nomad-source", nativeCompanyId],
    enabled: shouldResolveSource && !!nativeCompanyId,
    queryFn: async () => {
      const res = await axios.get(
        `/api/hosts/companies/${nativeCompanyId}/nomad-source`,
      );
      return res.data || {};
    },
  });

  // A disabled query stays "pending" forever, so only treat the source
  // lookup as loading when it actually runs (Companies flow, no override).
  const isSourceResolving = shouldResolveSource && isSourcePending;

  const companyId = shouldResolveSource
    ? sourceMeta?.effectiveNomadsCompanyId || nativeCompanyId
    : nativeCompanyId;

  // ✅ Fetch listings of a company — fires immediately with the native id
  // (in parallel with the nomad-source resolution above) instead of waiting
  // for it. In the common case the resolved id is the same, so the data is
  // already there; if it differs, the key change triggers one refetch.
  const { data: listings = [], isPending } = useQuery({
    queryKey: ["nomad-listings", companyId],
    enabled: !!companyId,
    retry: false,
    queryFn: async () => {
      try {
        const res = await axios.get(
          `${NOMADS_API_BASE_URL}/company/get-listings/${companyId}`,
        );
        return res.data || [];
      } catch (error) {
        if (error?.response?.status === 404) return [];
        throw error;
      }
    },
  });

  // ✅ Fetch all Host Lead Companies for the transfer dropdown
  const { data: hostCompanies = [] } = useQuery({
    queryKey: ["hostCompaniesList"],
    enabled: isTransferModalOpen,
    queryFn: async () => {
      const res = await axios.get("/api/hosts/host-companies");
      return res.data || [];
    },
  });

  const { mutate: transferListing, isPending: isTransferring } = useMutation({
    mutationFn: async (hostCompanyId) => {
      const response = await axios.post("/api/hosts/transfer-nomad-listing", {
        nomadsCompanyId: companyId,
        hostCompanyId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Products linked to Host Company");
      setIsTransferModalOpen(false);
      setSelectedHostCompanyId("");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to link products to Host Company",
      );
    },
  });

  const { mutate: transferToCompany, isPending: isTransferringToCompany } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `/api/hosts/companies-requests/${transferToCompanyData.companyId}/approve`,
        {
          companyName: transferToCompanyData.companyName,
          companyCity: transferToCompanyData.companyCity,
          companyState: transferToCompanyData.companyState,
          companyCountry: transferToCompanyData.companyCountry,
          companyContinent: transferToCompanyContinent,
        },
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Company created");
      setIsTransferToCompanyModalOpen(false);
      navigate("/dashboard/companies");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create company");
    },
  });

  const { mutate: toggleStatus, isPending: isToggle } = useMutation({
    mutationFn: async (data) => {
      const response = await axios.patch("/api/hosts/activate-product", data);
      return response.data;

      // console.log("Data from mutauton",data)
    },
    onSuccess: (data) => {
      toast.success(data.message || "PRODUCT ACTIVATED");
      queryClient.invalidateQueries({ queryKey: ["nomad-listings"] });
    },
    onError: (error) => {
      console.log("error", error);
    },
  });

  // ✅ Table data
  // ✅ Table columns

  // ✅ helper to make slugs URL-safe
  const slugify = (str) =>
    str
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");

  // ✅ Navigate to Add Listing form
  const handleAddClick = () => {
    // navigate(
    //   `/dashboard/companies/${slugify(
    //     listings?.[0]?.companyName
    //   )}/nomad-listings/add`,
    //   {
    //     state: { companyId }, // keep companyId for backend usage
    //   }
    // );

    // backward navigation support
    const nameForUrl = companyName || listings?.[0]?.companyName || "";
    navigate(`/dashboard/companies/${slugify(nameForUrl)}/nomad-listings/add`, {
      state: { companyId },
    });
  };

  const listingItems = useMemo(
    () => (Array.isArray(listings) ? listings : []),
    [listings],
  );
  const activeListings = listingItems.filter((item) => item.isActive).length;
  const inactiveListings = listingItems.length - activeListings;
  const productTypes = new Set(
    listingItems.map((item) => item.companyType).filter(Boolean),
  ).size;

  const filteredListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return listingItems.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.isActive : !item.isActive);
      const matchesQuery =
        !query ||
        [
          item.companyName,
          item.companyTitle,
          item.companyType,
          item.city,
          item.state,
          item.country,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [listingItems, searchQuery, statusFilter]);

  const handleEdit = (item) => {
    sessionStorage.setItem("companyId", companyId || "");
    sessionStorage.setItem("companyName", item?.companyName || "");
    sessionStorage.setItem("businessId", item?.businessId || "");
    navigate(
      `/dashboard/companies/${slugify(item?.companyName || companyName)}/nomad-listings/${slugify(item?.companyName || companyName)}`,
      {
        state: {
          website: item,
          companyId,
          isLoading: isPending,
        },
      },
    );
  };

  const secondaryActionTitle = showTransferToCompanyButton
    ? "Transfer to Company"
    : hideTransfer
      ? ""
      : "Transfer";

  const handleSecondaryAction = () => {
    if (!listingItems.length) return;
    if (showTransferToCompanyButton) {
      setIsTransferToCompanyModalOpen(true);
    } else if (!hideTransfer) {
      setIsTransferModalOpen(true);
    }
  };

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">
                Nomad Listings
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Manage the company&apos;s listings across Wono Nomads.
              </p>
            </div>
          </div>

          {isPending || isSourceResolving ? (
            <NomadListingsSkeleton />
          ) : (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
              <ListingStat label="Total Listings" value={listingItems.length} icon={Layers} />
              <ListingStat label="Active" value={activeListings} icon={CheckCircle2} tone="emerald" />
              <ListingStat label="Inactive" value={inactiveListings} icon={XCircle} tone="rose" />
              <ListingStat label="Product Types" value={productTypes} icon={Tags} tone="blue" />
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-slate-50/50">
                <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
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

                <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap">
                  <div className="text-[11px] font-pmedium text-slate-500 whitespace-nowrap">
                    {listingItems.length} listings
                  </div>
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search by name, type, city..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                  {secondaryActionTitle && (
                    <button
                      type="button"
                      onClick={handleSecondaryAction}
                      disabled={!listingItems.length}
                      className="px-4 py-2.5 rounded-2xl border border-blue-200 bg-white text-blue-700 font-pmedium text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      <ArrowRightLeft size={13} /> {secondaryActionTitle}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddClick}
                    className="px-4 py-2.5 rounded-2xl bg-[#2563EB] text-white font-pmedium text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Plus size={13} strokeWidth={3} /> Add Product
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[820px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">Sr No</th>
                      <th className="px-5 py-4">Company Name</th>
                      <th className="px-5 py-4">Product Type</th>
                      <th className="px-5 py-4">Location</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredListings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center">
                          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mx-auto">
                            <Target size={28} />
                          </div>
                          <p className="text-slate-400 font-pmedium">No listings found.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredListings.map((item, index) => (
                        <tr key={item._id || item.businessId || index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-400">{index + 1}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[9px] font-pmedium text-white shadow-sm">
                                {getInitials(item.companyName)}
                              </div>
                              <p className="text-[12px] font-pmedium text-slate-900">{item.companyName || "—"}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600 capitalize">{item.companyType || "—"}</td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-600">{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-5 py-4"><span className={statusPillClass(item.isActive ? "Active" : "Inactive")}>{item.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{formatDate(item.createdAt)}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button type="button" onClick={() => handleEdit(item)} title="Edit listing" className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all">
                                <Edit3 size={15} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                disabled={isToggle}
                                onClick={() => toggleStatus({ businessId: item.businessId, status: !item.isActive })}
                                title={item.isActive ? "Mark as inactive" : "Mark as active"}
                                className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${item.isActive ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                              >
                                {item.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </div>
      </PageFrame>

      {!hideTransfer && (
      <MuiModal
        open={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setSelectedHostCompanyId("");
        }}
        title="Transfer Products to Host Company"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            This links ALL of this company's Nomads products to the Host
            Company you select below — it does not move or duplicate the
            data, it only connects the two so every product shows up on that
            Host Company's page too.
          </p>

          <select
            className="w-full border border-borderGray rounded-lg p-2 text-sm"
            value={selectedHostCompanyId}
            onChange={(e) => setSelectedHostCompanyId(e.target.value)}
          >
            <option value="">Select a Host Company</option>
            {hostCompanies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyName}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2 pt-2">
            <PrimaryButton
              type="button"
              title={isTransferring ? "Transferring..." : "Confirm Transfer"}
              disabled={!selectedHostCompanyId || isTransferring}
              handleSubmit={() => transferListing(selectedHostCompanyId)}
            />
          </div>
        </div>
      </MuiModal>
      )}

      {showTransferToCompanyButton && (
        <MuiModal
          open={isTransferToCompanyModalOpen}
          onClose={() => setIsTransferToCompanyModalOpen(false)}
          title="Transfer to Company"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              This creates a new entry in Companies for "{transferToCompanyData?.companyName}
              ", linked back to this host's already-existing Nomads listing(s) — nothing gets
              duplicated or moved in Nomads. Staff can add the remaining details (industry,
              logo, etc.) from the Companies page afterward.
            </p>

            <select
              className="w-full border border-borderGray rounded-lg p-2 text-sm"
              value={transferToCompanyContinent}
              onChange={(e) => setTransferToCompanyContinent(e.target.value)}
            >
              <option value="">Select Continent</option>
              {CONTINENT_OPTIONS.map((continent) => (
                <option key={continent} value={continent}>
                  {continent}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <PrimaryButton
                type="button"
                title={isTransferringToCompany ? "Transferring..." : "Confirm Transfer"}
                disabled={!transferToCompanyContinent || isTransferringToCompany}
                handleSubmit={() => transferToCompany()}
              />
            </div>
          </div>
        </MuiModal>
      )}
    </div>
  );
}

export const NomadListingsSkeleton = () => (
  <div className="flex flex-col gap-4 animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center"
        >
          <div className="min-w-0 flex-1">
            <div className="h-2.5 w-20 rounded bg-slate-200 mb-2.5" />
            <div className="h-4 w-10 rounded bg-slate-200" />
          </div>
          <div className="h-9 w-9 rounded-2xl bg-slate-100 shrink-0" />
        </div>
      ))}
    </div>
    <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between gap-3">
        <div className="h-8 w-56 rounded-xl bg-slate-200" />
        <div className="h-9 w-72 rounded-xl bg-slate-200" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  </div>
);

const STAT_TONES = {
  slate: {
    border: "",
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

const ListingStat = ({ label, value, icon: Icon, tone = "slate" }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.slate;
  return (
    <div className={`bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md ${styles.border}`}>
      <div className="min-w-0">
        <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${styles.label}`}>{label}</p>
        <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
      </div>
      <div className={`p-2 rounded-2xl shrink-0 ${styles.icon}`}><Icon size={16} /></div>
    </div>
  );
};
