import React from "react";
import { X, Mail, ShieldCheck, Users, History as HistoryIcon, FileText } from "lucide-react";
import {
  TIER_LABELS,
  formatDate,
  getInitials,
  getPaymentInfo,
  buildListingUrl,
} from "../constants/verificationTiers";

// Full detail view for one Company Verification Leads / Companies Verified
// row — shared by both pages so "what a lead's full details look like"
// never drifts between them. onViewHistory is optional (Companies Verified
// passes it to add a shortcut into the renewal-history modal; the Leads
// page omits it since that history doesn't apply until a company is paid).
const VerificationLeadDetailModal = ({ lead, onClose, onViewHistory }) => {
  if (!lead) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
              {getInitials(lead.fullName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                {lead.fullName}
              </h2>
              <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                {lead.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
          <div>
            <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
              <Mail size={14} /> Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Mobile
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.mobile || "Not shared"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Email
                </p>
                <p className="text-[12px] font-pmedium text-slate-900 break-all">
                  {lead.email || "Not shared"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Role
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.role || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Country
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.country || "--"}
                </p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
              <ShieldCheck size={14} /> Business Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Business Name
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.businessName || lead.companyName || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Registered Company Name
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.registeredCompanyName || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Industry / Vertical
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {Array.isArray(lead.industry)
                    ? lead.industry.join(", ")
                    : lead.industry || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Continent
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.continent || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Company Country
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.companyCountry || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Company State
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.companyState || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Company City
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {lead.companyCity || "--"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Website
                </p>
                {lead.websiteUrl ? (
                  <a
                    href={lead.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-pmedium text-blue-600 underline break-all"
                  >
                    {lead.websiteUrl}
                  </a>
                ) : (
                  <p className="text-[12px] font-pmedium text-slate-900">--</p>
                )}
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Proof Document
                </p>
                {lead.proofDocument?.url ? (
                  <a
                    href={lead.proofDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-pmedium text-blue-600 underline"
                  >
                    <FileText size={12} /> View Document
                  </a>
                ) : (
                  <p className="text-[12px] font-pmedium text-slate-900">--</p>
                )}
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Plan
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {TIER_LABELS[lead.requestedTier] || lead.requestedTier} · $
                  {lead.requestedAmountUsd}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Status
                </p>
                <p className="text-[12px] font-pmedium text-slate-900 capitalize">
                  {lead.status || "pending"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Payment Status
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {getPaymentInfo(lead).label}
                </p>
              </div>
              {lead.activeTier && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                    Active Plan
                  </p>
                  <p className="text-[12px] font-pmedium text-slate-900">
                    {TIER_LABELS[lead.activeTier] || lead.activeTier} · $
                    {lead.activeAmountUsd}
                  </p>
                </div>
              )}
              {lead.paidAt && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                    Start Date
                  </p>
                  <p className="text-[12px] font-pmedium text-slate-900">
                    {formatDate(lead.paidAt)}
                  </p>
                </div>
              )}
              {lead.verificationExpiresAt && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                    Verification Expires
                  </p>
                  <p className="text-[12px] font-pmedium text-slate-900">
                    {formatDate(lead.verificationExpiresAt)}
                  </p>
                </div>
              )}
              {lead.renewalReminderSentAt && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                    Renewal Reminder Sent
                  </p>
                  <p className="text-[12px] font-pmedium text-slate-900">
                    {formatDate(lead.renewalReminderSentAt)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Submitted
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {formatDate(lead.createdAt)}
                </p>
              </div>
            </div>
          </div>
          {Array.isArray(lead.verticalsSnapshot) &&
            lead.verticalsSnapshot.length > 0 && (
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <Users size={14} /> Listings Covered
                </h3>
                <div className="flex flex-wrap gap-2 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  {lead.verticalsSnapshot.map((v, i) => (
                    <a
                      key={v.businessId || i}
                      href={buildListingUrl({
                        businessId: v.businessId,
                        companyType: v.companyType,
                        companyName: lead.businessName || lead.companyName,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 hover:border-blue-200 transition-colors underline"
                    >
                      {v.companyType} · {v.city || "--"}
                    </a>
                  ))}
                </div>
              </div>
            )}
          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="w-full py-2.5 bg-blue-50 text-blue-700 rounded-xl font-pmedium text-[12px] hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <HistoryIcon size={14} /> View Renewal History
            </button>
          )}
        </div>
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationLeadDetailModal;
