import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  Search,
  Target,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

// Tracks partners once they've actually joined Partners Panel (via the
// invite -> register flow in Value Adds Partner Leads) — separate from that
// leads module, and separate from the older Nomads visa-agent directory
// that already lives at /dashboard/value-adds-partners.

const VERTICALS = [
  { service: "visaPartner", label: "Visa Support" },
  { service: "companySetupPartner", label: "Company Setup" },
  { service: "activationSupportPartner", label: "Activation Support" },
  { service: "consultationSupportPartner", label: "Consultation Support" },
  { service: "workationPartner", label: "Workation Support" },
];

const TOP_TABS = [
  { key: "all", label: "All Partners" },
  ...VERTICALS.map((vertical) => ({ key: vertical.service, label: vertical.label })),
  { key: "follow-ups", label: "Follow-ups" },
  { key: "commission", label: "Commission" },
];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const formatDateLabel = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const getInitials = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "P";

const getPartnerServices = (partner) => (partner.services || []).map((entry) => entry.service);
const getCompanyNames = (partner) =>
  (partner.services || []).map((entry) => entry.companyName).filter(Boolean).join(", ");

const formatRating = (value) => (value === 0 || value ? `${Number(value).toFixed(1)} ★` : "--");
const formatResponseTime = (value) => (value === 0 || value ? `${value} min` : "--");
const formatPlan = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Free");

const StatTile = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    slate: { border: "border-l-slate-400", label: "text-slate-500", icon: "bg-slate-50 text-slate-600" },
    amber: { border: "border-l-amber-500", label: "text-amber-600", icon: "bg-amber-50 text-amber-600" },
    emerald: { border: "border-l-emerald-500", label: "text-emerald-600", icon: "bg-emerald-50 text-emerald-600" },
    rose: { border: "border-l-rose-500", label: "text-rose-600", icon: "bg-rose-50 text-rose-600" },
  }[tone];

  return (
    <div className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${tones.border}`}>
      <div className="min-w-0">
        <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${tones.label}`}>{label}</p>
        <p className="truncate text-[15px] font-pmedium text-slate-900">{value}</p>
      </div>
      <div className={`shrink-0 rounded-2xl p-2 ${tones.icon}`}>
        <Icon size={16} />
      </div>
    </div>
  );
};

const Modal = ({ title, onClose, children, onSubmit, submitLabel = "Save", isSubmitting }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm" onClick={onClose}>
    <form
      onClick={(event) => event.stopPropagation()}
      onSubmit={onSubmit}
      className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-blue-50/30 p-5">
        <h2 className="text-base font-pmedium tracking-tight text-slate-800">{title}</h2>
        <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-3.5 overflow-y-auto p-5">{children}</div>
      <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50 p-4">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[12px] font-pmedium text-slate-600 shadow-sm hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-[#2563EB] py-2.5 text-[12px] font-pmedium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
);

const fieldClass =
  "w-full rounded-lg border border-slate-200/60 bg-white px-3.5 py-2.5 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";
const labelClass = "mb-1 block text-[9px] font-pmedium uppercase tracking-widest text-slate-500";

const PartnerEditModal = ({ partner, onClose, onSave, isSubmitting }) => {
  const [rating, setRating] = useState(partner.rating ?? "");
  const [responseTimeMinutes, setResponseTimeMinutes] = useState(partner.responseTimeMinutes ?? "");
  const [leadsClosed, setLeadsClosed] = useState(partner.leadsClosed ?? 0);
  const [plan, setPlan] = useState(partner.plan || "free");
  const [isActive, setIsActive] = useState(partner.isActive !== false);

  return (
    <Modal
      title={`Edit ${partner.fullName}`}
      onClose={onClose}
      isSubmitting={isSubmitting}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          id: partner._id,
          rating: rating === "" ? null : Number(rating),
          responseTimeMinutes: responseTimeMinutes === "" ? null : Number(responseTimeMinutes),
          leadsClosed: Number(leadsClosed) || 0,
          plan,
          isActive,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Rating (0-5)</label>
          <input type="number" min="0" max="5" step="0.1" value={rating} onChange={(e) => setRating(e.target.value)} className={fieldClass} placeholder="--" />
        </div>
        <div>
          <label className={labelClass}>Avg. Response Time (min)</label>
          <input type="number" min="0" value={responseTimeMinutes} onChange={(e) => setResponseTimeMinutes(e.target.value)} className={fieldClass} placeholder="--" />
        </div>
        <div>
          <label className={labelClass}>Leads Closed</label>
          <input type="number" min="0" value={leadsClosed} onChange={(e) => setLeadsClosed(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={fieldClass}>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[11px] font-pmedium text-slate-600">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active account
      </label>
    </Modal>
  );
};

const FollowUpModal = ({ partners, onClose, onCreate, isSubmitting }) => {
  const [partnerId, setPartnerId] = useState(partners[0]?._id || "");
  const selectedPartner = partners.find((p) => p._id === partnerId);
  const serviceOptions = selectedPartner ? getPartnerServices(selectedPartner) : VERTICALS.map((v) => v.service);
  const [service, setService] = useState(serviceOptions[0] || "");
  const [leadRefCode, setLeadRefCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [waitingOn, setWaitingOn] = useState("client");
  const [reason, setReason] = useState("");
  const [dueAt, setDueAt] = useState("");

  return (
    <Modal
      title="New Follow-up"
      onClose={onClose}
      isSubmitting={isSubmitting}
      submitLabel="Add Follow-up"
      onSubmit={(event) => {
        event.preventDefault();
        if (!partnerId || !clientName || !dueAt) {
          toast.error("Partner, client name and due date are required.");
          return;
        }
        onCreate({ partnerId, service, leadRefCode, clientName, clientEmail, waitingOn, reason, dueAt });
      }}
    >
      <div>
        <label className={labelClass}>Partner</label>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={fieldClass}>
          {partners.map((p) => (
            <option key={p._id} value={p._id}>
              {p.fullName} ({p.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Service</label>
        <select value={service} onChange={(e) => setService(e.target.value)} className={fieldClass}>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {VERTICALS.find((v) => v.service === s)?.label || s}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Lead / Ref Code</label>
          <input value={leadRefCode} onChange={(e) => setLeadRefCode(e.target.value)} className={fieldClass} placeholder="WO-VS-1048" />
        </div>
        <div>
          <label className={labelClass}>Waiting On</label>
          <select value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} className={fieldClass}>
            <option value="client">Client</option>
            <option value="partner">Partner</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Client Name</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Client Email</label>
          <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} placeholder="No reply to revised quote" />
      </div>
    </Modal>
  );
};

const CommissionModal = ({ partners, onClose, onCreate, isSubmitting }) => {
  const [partnerId, setPartnerId] = useState(partners[0]?._id || "");
  const selectedPartner = partners.find((p) => p._id === partnerId);
  const serviceOptions = selectedPartner ? getPartnerServices(selectedPartner) : VERTICALS.map((v) => v.service);
  const [service, setService] = useState(serviceOptions[0] || "");
  const [leadRefCode, setLeadRefCode] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  return (
    <Modal
      title="New Commission"
      onClose={onClose}
      isSubmitting={isSubmitting}
      submitLabel="Add Commission"
      onSubmit={(event) => {
        event.preventDefault();
        if (!partnerId || !amount) {
          toast.error("Partner and amount are required.");
          return;
        }
        onCreate({ partnerId, service, leadRefCode, amount: Number(amount), currency, dueDate, note });
      }}
    >
      <div>
        <label className={labelClass}>Partner</label>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={fieldClass}>
          {partners.map((p) => (
            <option key={p._id} value={p._id}>
              {p.fullName} ({p.email})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Service</label>
        <select value={service} onChange={(e) => setService(e.target.value)} className={fieldClass}>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {VERTICALS.find((v) => v.service === s)?.label || s}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Lead / Ref Code</label>
          <input value={leadRefCode} onChange={(e) => setLeadRefCode(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Amount</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={fieldClass} maxLength={3} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
      </div>
    </Modal>
  );
};

const PartnersTable = ({ partners, onEdit, onToggleActive, showRank = false }) => (
  <div className="flex-1 overflow-x-auto">
    <table className="w-full min-w-[860px] text-left">
      <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
        <tr>
          {showRank ? <th className="px-5 py-4">Rank</th> : null}
          <th className="px-5 py-4">Partner</th>
          <th className="px-5 py-4">Contact</th>
          <th className="px-5 py-4">Leads Closed</th>
          <th className="px-5 py-4">Plan</th>
          <th className="px-5 py-4">Rating</th>
          {showRank ? <th className="px-5 py-4">Response Time</th> : null}
          <th className="px-5 py-4 text-center">Status</th>
          <th className="px-5 py-4 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100/60">
        {partners.length === 0 ? (
          <tr>
            <td colSpan={showRank ? 8 : 7} className="px-5 py-16 text-center text-[12px] font-pmedium text-slate-400">
              No partners found.
            </td>
          </tr>
        ) : (
          partners.map((partner, index) => (
            <tr key={partner._id} className="transition-colors hover:bg-slate-50/50">
              {showRank ? (
                <td className="px-5 py-4 text-[12px] font-pmedium text-slate-500">#{index + 1}</td>
              ) : null}
              <td className="px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                    {getInitials(partner.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="max-w-[170px] truncate text-[12px] font-pmedium text-slate-900">{partner.fullName}</p>
                    <p className="max-w-[170px] truncate text-[10px] font-pmedium text-slate-400">{getCompanyNames(partner) || "--"}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="space-y-0.5 text-[11px] font-pmedium text-slate-600">
                  <p className="flex items-center gap-1">
                    <Phone size={10} className="text-slate-400" />
                    {[partner.contactCode, partner.contactNumber].filter(Boolean).join(" ") || "--"}
                  </p>
                  <p className="flex items-center gap-1">
                    <Mail size={10} className="text-slate-400" />
                    {partner.email}
                  </p>
                </div>
              </td>
              <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{partner.leadsClosed || 0} leads</td>
              <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{formatPlan(partner.plan)}</td>
              <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{formatRating(partner.rating)}</td>
              {showRank ? (
                <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{formatResponseTime(partner.responseTimeMinutes)}</td>
              ) : null}
              <td className="px-5 py-4 text-center">
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-pmedium uppercase tracking-wider ${
                    partner.isActive !== false
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {partner.isActive !== false ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-5 py-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(partner)}
                    title="Edit ranking details"
                    className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"
                  >
                    <Pencil size={15} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleActive(partner)}
                    title={partner.isActive !== false ? "Mark as Inactive" : "Mark as Active"}
                    className={`rounded-lg p-1.5 transition-all ${
                      partner.isActive !== false
                        ? "bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700"
                        : "bg-rose-100 text-rose-700 hover:bg-emerald-100 hover:text-emerald-700"
                    }`}
                  >
                    <Power size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const followUpStatusOf = (followUp) => {
  if (followUp.status === "resolved") return "resolved";
  const due = new Date(followUp.dueAt);
  const now = new Date();
  if (due.getTime() < now.getTime()) return "overdue";
  if (due.toDateString() === now.toDateString()) return "due_today";
  return "open";
};

const followUpTone = {
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  due_today: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  open: "border-slate-200 bg-slate-50 text-slate-600",
};
const followUpLabel = { overdue: "Overdue", due_today: "Due Today", resolved: "Resolved", open: "Open" };

const commissionTone = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const OnboardedPartners = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [activeTopTab, setActiveTopTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPartner, setEditingPartner] = useState(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);

  const { data: partners = [], isPending: partnersPending } = useQuery({
    queryKey: ["onboardedPartners"],
    queryFn: async () => (await axiosPrivate.get("/api/onboarded-partners/partners")).data?.data || [],
  });

  const { data: followUps = [], isPending: followUpsPending } = useQuery({
    queryKey: ["onboardedPartnerFollowUps"],
    queryFn: async () => (await axiosPrivate.get("/api/onboarded-partners/follow-ups")).data?.data || [],
    enabled: activeTopTab === "follow-ups",
  });

  const { data: commissions = [], isPending: commissionsPending } = useQuery({
    queryKey: ["onboardedPartnerCommissions"],
    queryFn: async () => (await axiosPrivate.get("/api/onboarded-partners/commissions")).data?.data || [],
    enabled: activeTopTab === "commission",
  });

  const updatePartner = useMutation({
    mutationFn: async ({ id, ...body }) => (await axiosPrivate.patch(`/api/onboarded-partners/partners/${id}`, body)).data,
    onSuccess: () => {
      toast.success("Partner updated.");
      queryClient.invalidateQueries({ queryKey: ["onboardedPartners"] });
      setEditingPartner(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to update partner."),
  });

  const createFollowUp = useMutation({
    mutationFn: async (body) => (await axiosPrivate.post("/api/onboarded-partners/follow-ups", body)).data,
    onSuccess: () => {
      toast.success("Follow-up added.");
      queryClient.invalidateQueries({ queryKey: ["onboardedPartnerFollowUps"] });
      setShowFollowUpModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to add follow-up."),
  });

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, ...body }) => (await axiosPrivate.patch(`/api/onboarded-partners/follow-ups/${id}`, body)).data,
    onSuccess: () => {
      toast.success("Follow-up updated.");
      queryClient.invalidateQueries({ queryKey: ["onboardedPartnerFollowUps"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to update follow-up."),
  });

  const createCommission = useMutation({
    mutationFn: async (body) => (await axiosPrivate.post("/api/onboarded-partners/commissions", body)).data,
    onSuccess: () => {
      toast.success("Commission logged.");
      queryClient.invalidateQueries({ queryKey: ["onboardedPartnerCommissions"] });
      setShowCommissionModal(false);
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to log commission."),
  });

  const updateCommission = useMutation({
    mutationFn: async ({ id, ...body }) => (await axiosPrivate.patch(`/api/onboarded-partners/commissions/${id}`, body)).data,
    onSuccess: () => {
      toast.success("Commission updated.");
      queryClient.invalidateQueries({ queryKey: ["onboardedPartnerCommissions"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Failed to update commission."),
  });

  const scopedPartners = useMemo(
    () => (VERTICALS.some((vertical) => vertical.service === activeTopTab)
      ? partners.filter((partner) => getPartnerServices(partner).includes(activeTopTab))
      : partners),
    [activeTopTab, partners],
  );

  const rankedPartners = useMemo(() => {
    if (!VERTICALS.some((vertical) => vertical.service === activeTopTab)) return scopedPartners;
    return [...scopedPartners].sort((a, b) => {
      const ratingDiff = (b.rating ?? -1) - (a.rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      const aTime = a.responseTimeMinutes ?? Infinity;
      const bTime = b.responseTimeMinutes ?? Infinity;
      return aTime - bTime;
    });
  }, [activeTopTab, scopedPartners]);

  const visiblePartners = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return rankedPartners;
    return rankedPartners.filter((p) =>
      [p.fullName, p.email, p.contactNumber, getCompanyNames(p)].filter(Boolean).some((v) => normalize(v).includes(query)),
    );
  }, [rankedPartners, searchQuery]);

  const activeCount = scopedPartners.filter((p) => p.isActive !== false).length;
  const freePlanCount = scopedPartners.filter((p) => (p.plan || "free") === "free").length;
  const topRated = scopedPartners.reduce((best, p) => ((p.rating || 0) > (best?.rating || 0) ? p : best), null);

  const followUpCounts = useMemo(
    () =>
      followUps.reduce(
        (counts, fu) => {
          const status = followUpStatusOf(fu);
          if (status === "overdue") counts.overdue += 1;
          else if (status === "due_today") counts.dueToday += 1;
          if (fu.status !== "resolved") counts.open += 1;
          return counts;
        },
        { open: 0, overdue: 0, dueToday: 0 },
      ),
    [followUps],
  );

  const commissionTotals = useMemo(
    () =>
      commissions.reduce(
        (totals, c) => {
          if (c.status === "paid") totals.paid += c.amount;
          else totals.pending += c.amount;
          return totals;
        },
        { pending: 0, paid: 0 },
      ),
    [commissions],
  );

  const isPending =
    (activeTopTab === "follow-ups" && followUpsPending) ||
    (activeTopTab === "commission" && commissionsPending) ||
    ((activeTopTab === "all" || VERTICALS.some((vertical) => vertical.service === activeTopTab)) && partnersPending);

  return (
    <div className="min-h-full p-2 text-[12px] text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4 font-sans text-slate-700">
          <div className="mb-1 flex flex-col gap-1.5">
            <h2 className="text-title font-pmedium uppercase text-primary">Value Adds Partners</h2>
            <p className="text-xs font-pmedium text-slate-500">
              All onboarded Partners Panel accounts, service-wise views, follow-ups and commission.
            </p>
          </div>

          <div role="tablist" aria-label="View" className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTopTab === tab.key}
                onClick={() => setActiveTopTab(tab.key)}
                className={`flex-1 rounded-xl px-4 py-2 text-center text-[10px] font-pmedium uppercase tracking-widest transition-all ${
                  activeTopTab === tab.key ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isPending ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-20 text-center text-sm font-pmedium text-slate-400">Loading...</div>
          ) : (activeTopTab === "all" || VERTICALS.some((vertical) => vertical.service === activeTopTab)) ? (
            <>
              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Active Partners" value={activeCount} icon={Target} tone="slate" />
                <StatTile label="On Free Plan" value={freePlanCount} icon={Clock} tone="amber" />
                <StatTile label="Top Rated Partner" value={topRated?.fullName || "--"} icon={Users} tone="emerald" />
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex flex-col gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search partners..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                  <span className="whitespace-nowrap text-[10px] font-pmedium text-slate-400">{visiblePartners.length} of {scopedPartners.length}</span>
                </div>

                <PartnersTable
                  partners={visiblePartners}
                  showRank={activeTopTab !== "all"}
                  onEdit={setEditingPartner}
                  onToggleActive={(partner) => updatePartner.mutate({ id: partner._id, isActive: !(partner.isActive !== false) })}
                />
              </div>
            </>
          ) : activeTopTab === "follow-ups" ? (
            <>
              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Open Follow-ups" value={followUpCounts.open} icon={Target} tone="slate" />
                <StatTile label="Overdue" value={followUpCounts.overdue} icon={Clock} tone="rose" />
                <StatTile label="Due Today" value={followUpCounts.dueToday} icon={Calendar} tone="amber" />
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-end border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setShowFollowUpModal(true)}
                    disabled={!partners.length}
                    className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-[11px] font-pmedium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} /> New Follow-up
                  </button>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Lead / Client</th>
                        <th className="px-5 py-4">Partner</th>
                        <th className="px-5 py-4">Waiting On</th>
                        <th className="px-5 py-4">Due</th>
                        <th className="px-5 py-4">Reason</th>
                        <th className="px-5 py-4 text-center">Status</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {followUps.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-16 text-center text-[12px] font-pmedium text-slate-400">No follow-ups logged.</td>
                        </tr>
                      ) : (
                        followUps.map((fu) => {
                          const status = followUpStatusOf(fu);
                          return (
                            <tr key={fu._id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-4">
                                <p className="text-[12px] font-pmedium text-slate-900">{fu.leadRefCode || "--"}</p>
                                <p className="text-[10px] font-pmedium text-slate-400">{fu.clientName}</p>
                              </td>
                              <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{fu.partnerId?.fullName || "--"}</td>
                              <td className="px-5 py-4 text-[11px] font-pmedium capitalize text-slate-600">{fu.waitingOn}</td>
                              <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{formatDateLabel(fu.dueAt)}</td>
                              <td className="max-w-[180px] truncate px-5 py-4 text-[11px] font-pmedium text-slate-600" title={fu.reason}>{fu.reason || "--"}</td>
                              <td className="px-5 py-4 text-center">
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-pmedium uppercase tracking-wider ${followUpTone[status]}`}>
                                  {followUpLabel[status]}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {status !== "resolved" ? (
                                    <button
                                      type="button"
                                      onClick={() => updateFollowUp.mutate({ id: fu._id, waitingOn: fu.waitingOn === "client" ? "partner" : "client" })}
                                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-[10px] font-pmedium uppercase tracking-wider text-blue-700 hover:bg-blue-200"
                                    >
                                      Follow Up
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => updateFollowUp.mutate({ id: fu._id, status: status === "resolved" ? "open" : "resolved" })}
                                    title={status === "resolved" ? "Reopen" : "Resolve"}
                                    className={`rounded-lg p-1.5 ${status === "resolved" ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                                  >
                                    <CheckCircle2 size={15} strokeWidth={2.5} />
                                  </button>
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
            </>
          ) : (
            <>
              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Pending Payout" value={`$${commissionTotals.pending.toFixed(2)}`} icon={Clock} tone="amber" />
                <StatTile label="Paid Out" value={`$${commissionTotals.paid.toFixed(2)}`} icon={DollarSign} tone="emerald" />
                <StatTile label="Total Entries" value={commissions.length} icon={Target} tone="slate" />
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-end border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setShowCommissionModal(true)}
                    disabled={!partners.length}
                    className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-[11px] font-pmedium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} /> New Commission
                  </button>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Partner</th>
                        <th className="px-5 py-4">Lead / Ref</th>
                        <th className="px-5 py-4">Amount</th>
                        <th className="px-5 py-4">Due Date</th>
                        <th className="px-5 py-4 text-center">Status</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {commissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-16 text-center text-[12px] font-pmedium text-slate-400">No commission entries yet.</td>
                        </tr>
                      ) : (
                        commissions.map((c) => (
                          <tr key={c._id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-900">{c.partnerId?.fullName || "--"}</td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600">{c.leadRefCode || "--"}</td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{c.currency} {Number(c.amount).toFixed(2)}</td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{formatDateLabel(c.dueDate)}</td>
                            <td className="px-5 py-4 text-center">
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-pmedium uppercase tracking-wider ${commissionTone[c.status]}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => updateCommission.mutate({ id: c._id, status: c.status === "paid" ? "pending" : "paid" })}
                                className={`rounded-lg px-3 py-1.5 text-[10px] font-pmedium uppercase tracking-wider ${
                                  c.status === "paid" ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                }`}
                              >
                                {c.status === "paid" ? "Mark Pending" : "Mark Paid"}
                              </button>
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

      {editingPartner ? (
        <PartnerEditModal
          partner={editingPartner}
          onClose={() => setEditingPartner(null)}
          onSave={(body) => updatePartner.mutate(body)}
          isSubmitting={updatePartner.isPending}
        />
      ) : null}
      {showFollowUpModal ? (
        <FollowUpModal
          partners={partners}
          onClose={() => setShowFollowUpModal(false)}
          onCreate={(body) => createFollowUp.mutate(body)}
          isSubmitting={createFollowUp.isPending}
        />
      ) : null}
      {showCommissionModal ? (
        <CommissionModal
          partners={partners}
          onClose={() => setShowCommissionModal(false)}
          onCreate={(body) => createCommission.mutate(body)}
          isSubmitting={createCommission.isPending}
        />
      ) : null}
    </div>
  );
};

export default OnboardedPartners;
