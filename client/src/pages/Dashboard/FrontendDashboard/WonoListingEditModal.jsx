import React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

// Exact dropdown lists from the data team's workbook (Lead Priority Results sheet,
// Excel data validation on columns X, Y, AB, AC).
const STATUS_OPTIONS = ["New", "Contacted", "Follow-up", "Qualified", "Proposal", "Won", "Lost"];
const BUSINESS_STATUS_OPTIONS = ["Active", "Permanently Closed", "Temporarily Closed"];
const NEXT_ACTION_OPTIONS = ["PENDING", "ONBOARD"];
const PLAN_OPTIONS = ["Select", "Basic", "Proffesional", "Custom"];

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const buildInitialForm = (listing) => ({
  website: listing?.website || "",
  email: listing?.email || "",
  contact: listing?.contact || "",
  linkedin: listing?.linkedin || "",
  airportName: listing?.airportName || "",
  airportMapUrl: listing?.airportMapUrl || "",
  businessStatus: listing?.businessStatus || "Active",
  status: listing?.status || "New",
  owner: listing?.owner || "",
  notes: listing?.notes || "",
  nextAction: listing?.nextAction || "PENDING",
  plan: listing?.plan || "Select",
  dateOfActivation: toDateInputValue(listing?.dateOfActivation),
});

const Field = ({ label, children }) => (
  <div>
    <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const WonoListingEditModal = ({ listing, onClose }) => {
  const axios = useAxiosPrivate();
  const [form, setForm] = React.useState(() => buildInitialForm(listing));

  React.useEffect(() => {
    setForm(buildInitialForm(listing));
  }, [listing]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const response = await axios.patch(`/api/hosts/destination-listings/${listing._id}`, form);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Listing info updated");
      queryClient.invalidateQueries({ queryKey: ["wono-destination-listings"] });
      queryClient.invalidateQueries({ queryKey: ["wono-destination-listings-summary"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update listing");
    },
  });

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  if (!listing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Edit info — scores and factors are not editable here</p>
            <h2 className="mt-1 text-lg font-pmedium text-slate-900">{listing.businessName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Contact</div>
            <div className="grid gap-3 px-5 py-4">
              <Field label="Website"><input className={inputCls} value={form.website} onChange={set("website")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email"><input className={inputCls} value={form.email} onChange={set("email")} /></Field>
                <Field label="Contact"><input className={inputCls} value={form.contact} onChange={set("contact")} /></Field>
              </div>
              <Field label="LinkedIn"><input className={inputCls} value={form.linkedin} onChange={set("linkedin")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Airport name"><input className={inputCls} value={form.airportName} onChange={set("airportName")} /></Field>
                <Field label="Airport map link"><input className={inputCls} value={form.airportMapUrl} onChange={set("airportMapUrl")} /></Field>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Sales tracking</div>
            <div className="grid gap-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Business status">
                  <select className={inputCls} value={form.businessStatus} onChange={set("businessStatus")}>
                    {BUSINESS_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputCls} value={form.status} onChange={set("status")}>
                    {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner"><input className={inputCls} value={form.owner} onChange={set("owner")} placeholder="Assigned to" /></Field>
                <Field label="Next action">
                  <select className={inputCls} value={form.nextAction} onChange={set("nextAction")}>
                    {NEXT_ACTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan">
                  <select className={inputCls} value={form.plan} onChange={set("plan")}>
                    {PLAN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Activation date"><input type="date" className={inputCls} value={form.dateOfActivation} onChange={set("dateOfActivation")} /></Field>
              </div>
              <Field label="Notes"><textarea className={inputCls} rows={3} value={form.notes} onChange={set("notes")} /></Field>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-pmedium text-slate-600 transition hover:border-slate-300">Cancel</button>
            <button type="button" disabled={isSaving} onClick={() => save()} className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50">{isSaving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WonoListingEditModal;
