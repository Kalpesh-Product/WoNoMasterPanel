import React from "react";
import { Pencil, X } from "lucide-react";

const number = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const priorityStyle = {
  "High Opportunity": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Medium Opportunity": "bg-amber-50 text-amber-700 border-amber-200",
  "Lower Opportunity": "bg-slate-100 text-slate-600 border-slate-200",
};

const WonoListingDetailModal = ({ listing, onClose, onEdit }) => {
  if (!listing) return null;
  const s = listing.scoring || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[s.priority]}`}>{s.priority}</span>
            <h2 className="mt-2 text-lg font-pmedium text-slate-900">{listing.businessName}</h2>
            <p className="mt-1 text-xs font-pmedium text-slate-500">{listing.category}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"><X size={16} /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-blue-50 px-4 py-3">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">WoNo Need</p>
              <p className="mt-1 text-lg font-pmedium text-blue-950">{number.format(s.needScore)}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-violet-600">Category Fit</p>
              <p className="mt-1 text-lg font-pmedium text-violet-950">{number.format(s.categoryFitScore)}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-amber-600">Business Activity</p>
              <p className="mt-1 text-lg font-pmedium text-amber-950">{number.format(s.businessActivityScore)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-pmedium uppercase tracking-widest text-emerald-600">Final score</p>
              <p className="mt-1 text-lg font-pmedium text-emerald-950">{number.format(s.finalScore)}</p>
            </div>
          </div>

          <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-pmedium leading-6 text-slate-600">
            How it's calculated: Final Opportunity Score = WoNo Need × 40% + Category Fit × 35% + Business Activity × 25%. Need comes from the website/social gap and keyword evidence; Category Fit is the 6 category-weighted factors; Business Activity is the rating and review-volume percentile within this category.
          </p>

          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-pmedium leading-6 text-slate-700">{s.recommendedPitch}</p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Business details</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-xs font-pmedium text-slate-600">
              <p>Rating: <span className="text-slate-900">{listing.rating} ({listing.totalReviews} reviews)</span></p>
              <p>Digital gaps: <span className="text-slate-900">{s.digitalGaps} / 3</span></p>
              {listing.googleMapUrl && (
                <p className="truncate">
                  Google map: <a href={listing.googleMapUrl} target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">View on map</a>
                </p>
              )}
              <p>Website: <span className="text-slate-900">{listing.hasWebsite ? "Yes" : "No"}</span></p>
              <p>Near airport: <span className="text-slate-900">{listing.nearAirport ? "Yes" : "No"}</span></p>
              {listing.airportName && <p>Airport: <span className="text-slate-900">{listing.airportName}</span></p>}
              {listing.airportMapUrl && (
                <p className="truncate">
                  Airport map: <a href={listing.airportMapUrl} target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline">View on map</a>
                </p>
              )}
              {listing.address && <p className="col-span-2 truncate">Address: <span className="text-slate-900">{listing.address}</span></p>}
              {listing.inclusion && <p className="col-span-2">Inclusion: <span className="text-slate-900">{listing.inclusion}</span></p>}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Contact</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-xs font-pmedium text-slate-600">
              {listing.website && <p className="col-span-2 truncate">Website: <span className="text-slate-900">{listing.website}</span></p>}
              {listing.email && <p className="truncate">Email: <span className="text-slate-900">{listing.email}</span></p>}
              {listing.contact && <p className="truncate">Contact: <span className="text-slate-900">{listing.contact}</span></p>}
              {listing.linkedin && <p className="col-span-2 truncate">LinkedIn: <span className="text-slate-900">{listing.linkedin}</span></p>}
              {!listing.website && !listing.email && !listing.contact && !listing.linkedin && <p className="col-span-2 text-slate-400">No contact details on file.</p>}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Sales tracking</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-xs font-pmedium text-slate-600">
              <p>Business status: <span className="text-slate-900">{listing.businessStatus || "Active"}</span></p>
              <p>Status: <span className="text-slate-900">{listing.status || "New"}</span></p>
              <p>Owner: <span className="text-slate-900">{listing.owner || "—"}</span></p>
              <p>Next action: <span className="text-slate-900">{listing.nextAction || "—"}</span></p>
              <p>Plan: <span className="text-slate-900">{listing.plan || "—"}</span></p>
              <p>Activation date: <span className="text-slate-900">{listing.dateOfActivation ? new Date(listing.dateOfActivation).toLocaleDateString() : "—"}</span></p>
              {listing.notes && <p className="col-span-2">Notes: <span className="text-slate-900">{listing.notes}</span></p>}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => onEdit(listing)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-pmedium text-slate-600 transition hover:border-blue-200 hover:text-[#2563EB]"><Pencil size={13} /> Edit info</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WonoListingDetailModal;
