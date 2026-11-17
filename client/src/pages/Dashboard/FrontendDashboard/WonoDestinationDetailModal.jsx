import React from "react";
import { X } from "lucide-react";

const priorityStyle = {
  P1: "bg-emerald-50 text-emerald-700 border-emerald-200",
  P2: "bg-blue-50 text-blue-700 border-blue-200",
  P3: "bg-amber-50 text-amber-700 border-amber-200",
  P4: "bg-slate-100 text-slate-600 border-slate-200",
};

const factorFields = [
  ["Target Business Supply", "targetBusinessSupply", "Input to Client Opportunity"],
  ["Tourism / Accommodation Base", "tourismAccommodationBase", "Input to Client Opportunity"],
  ["Market Scale", "marketScale", "Input to Client Opportunity"],
  ["Nomad Demand & Community", "nomadDemandCommunity", "20% final-score weight"],
  ["Remote Work Infrastructure", "remoteWorkInfrastructure", "15% final-score weight"],
  ["Business & Jobs Ecosystem", "businessJobsEcosystem", "10% final-score weight"],
  ["Flight Connectivity", "flightConnectivity", "7% final-score weight"],
  ["Affordability", "affordability", "5% final-score weight"],
  ["Visa Entry Accessibility", "visaEntryAccessibility", "5% final-score weight"],
  ["Safety / Healthcare", "safetyHealthcare", "3% final-score weight"],
];

const number = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WonoDestinationDetailModal = ({ destination, onClose }) => {
  if (!destination) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[destination.priority]}`}>{destination.priority} · {destination.priorityLabel}</span>
              <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Rank {destination.rank}</span>
            </div>
            <h2 className="mt-2 text-lg font-pmedium text-slate-900">{destination.destination}</h2>
            <p className="mt-1 text-xs font-pmedium text-slate-500">{destination.country} · {destination.continent}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 px-5 py-4">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">Client Opportunity</p>
              <p className="mt-2 text-2xl font-pmedium text-blue-950">{number.format(destination.clientOpportunity)}</p>
              <p className="mt-1 text-[10px] font-pmedium text-blue-700">Business supply 60% + tourism 25% + market scale 15%</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-5 py-4">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-emerald-600">Final WoNo Priority Score</p>
              <p className="mt-2 text-2xl font-pmedium text-emerald-950">{number.format(destination.score)}</p>
              <p className="mt-1 text-[10px] font-pmedium text-emerald-700">Weighted strategic onboarding score out of 100</p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
            <div className="grid grid-cols-[1.4fr_0.9fr_1fr] border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
              <span>Score factor</span><span className="text-right">Value</span><span className="pl-5">Role in model</span>
            </div>
            {factorFields.map(([label, key, role]) => (
              <div key={key} className="grid grid-cols-[1.4fr_0.9fr_1fr] items-center border-b border-slate-100 px-5 py-3 last:border-0">
                <span className="text-xs font-pmedium text-slate-800">{label}</span>
                <span className="text-right text-xs font-pmedium text-slate-900">{number.format(destination.factors[key])}</span>
                <span className="pl-5 text-[10px] font-pmedium text-slate-500">{role}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">How the final score is calculated</p>
            <p className="mt-2 text-xs font-pmedium leading-6 text-slate-700">Client Opportunity × 35% + Nomad Demand × 20% + Remote Work Infrastructure × 15% + Business & Jobs × 10% + Flight Connectivity × 7% + Affordability × 5% + Visa Entry Accessibility × 5% + Safety / Healthcare × 3%.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WonoDestinationDetailModal;
