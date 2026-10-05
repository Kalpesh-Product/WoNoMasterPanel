import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Gift } from "lucide-react";
import useAxiosPrivate from "../hooks/useAxiosPrivate";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

// Every company that has ever started the Professional free trial — who's
// currently on it, when it ends, and (per company) a staff-granted extra
// trial window on top of the normal one-time trial. Turning that on shows a
// claimable "bonus trial" offer on that company's own HostPanel dashboard;
// it never applies itself.
const TrialCompaniesModal = ({ open, onClose }) => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["trial-companies"],
    queryFn: async () => (await axios.get("/api/hosts/trial-companies")).data || [],
    enabled: open,
  });

  const bonusOfferMutation = useMutation({
    mutationFn: async ({ companyId, active, durationDays }) =>
      (
        await axios.patch(`/api/hosts/trial-companies/${companyId}/bonus-offer`, {
          active,
          durationDays,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-companies"] });
      toast.success("Bonus trial offer updated");
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to update the bonus trial offer"),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-pmedium tracking-tight text-slate-800">Trial Companies</h2>
            <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
              Companies who have claimed the Professional free trial, and when it ends.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-3 overflow-y-auto">
          {isLoading ? (
            <p className="text-[12px] text-slate-400">Loading…</p>
          ) : companies.length ? (
            companies.map((company) => (
              <TrialCompanyRow
                key={company._id || company.companyId}
                company={company}
                onSaveBonusOffer={(payload) =>
                  bonusOfferMutation.mutate({ companyId: company.companyId, ...payload })
                }
                isSaving={bonusOfferMutation.isPending}
              />
            ))
          ) : (
            <p className="text-[12px] text-slate-400">
              No company has claimed the free trial yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TrialCompanyRow = ({ company, onSaveBonusOffer, isSaving }) => {
  const offer = company.bonusTrialOffer || {};
  const [active, setActive] = useState(Boolean(offer.active));
  const [durationDays, setDurationDays] = useState(String(offer.durationDays || 30));

  // Re-sync local edits with the server whenever this company's row data
  // changes (e.g. after a save invalidates the list query) — same pattern
  // PricingRow uses for its own price field.
  useEffect(() => {
    setActive(Boolean(offer.active));
    setDurationDays(String(offer.durationDays || 30));
  }, [offer.active, offer.durationDays, offer.claimedAt]);

  const dirty = active !== Boolean(offer.active) || durationDays !== String(offer.durationDays || 30);

  const now = Date.now();
  const trialEndMs = company.trialEndAt ? new Date(company.trialEndAt).getTime() : null;
  const isCurrentlyUsing = Boolean(company.isTrialActive) && trialEndMs && trialEndMs > now;
  const daysLeft = isCurrentlyUsing ? Math.ceil((trialEndMs - now) / (24 * 60 * 60 * 1000)) : null;

  return (
    <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-pmedium text-slate-900 truncate">
            {company.companyName || company.companyId}
          </p>
          <p className="text-[10px] text-slate-500 truncate">
            {company.pocName ? `${company.pocName} · ` : ""}
            {company.pocEmail || ""}
          </p>
        </div>
        <span
          className={`shrink-0 inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${
            isCurrentlyUsing
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {isCurrentlyUsing ? "Currently Using" : "Trial Ended"}
        </span>
      </div>

      <div className="flex flex-wrap font-pmedium gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span>Started: {formatDate(company.trialStartAt)}</span>
        <span>
          {isCurrentlyUsing ? "Ends" : "Ended"}: {formatDate(company.trialEndAt)}
          {isCurrentlyUsing && daysLeft != null ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
        <Gift size={13} className="text-blue-500 shrink-0" />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-[11px] font-pmedium text-slate-700">Offer active</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-pmedium text-right"
          />
          <span className="text-[10px] font-pmedium text-slate-400">extra days</span>
        </div>
        <button
          type="button"
          disabled={!dirty || isSaving}
          onClick={() => onSaveBonusOffer({ active, durationDays: Number(durationDays) || 30 })}
          className="ml-auto inline-flex items-center rounded-lg px-3 py-1.5 text-[11px] font-pmedium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
      {offer.claimedAt && (
        <p className="text-[10px] text-emerald-600">
          Last bonus offer claimed on {formatDate(offer.claimedAt)}.
        </p>
      )}
    </div>
  );
};

export default TrialCompaniesModal;
