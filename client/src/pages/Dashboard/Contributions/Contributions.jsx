import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  History,
  MapPin,
  Power,
  Search,
  Sparkles,
  Star,
  Target,
  X,
  XCircle,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAuth from "../../../hooks/useAuth";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const CONTRIBUTION_TABS = [
  { slug: "blog-contributions", label: "Blog Contributions", type: "blog" },
  { slug: "news-contributions", label: "News Contributions", type: "news" },
  { slug: "places-contributions", label: "Places Contributions", type: "places" },
  { slug: "event-contributions", label: "Event Contributions", type: "events" },
];

const CONTRIBUTION_CONFIG = {
  blog: {
    singular: "Blog",
    plural: "Blogs",
    contributorColumn: "Blogger",
    category: "Blog",
    emptyLabel: "blog contributions",
    queryKey: "blogContributions",
    endpoint: "/api/blogs/contributions",
    statusEndpoint: (id) => `/api/blogs/contributions/${id}/status`,
    activeEndpoint: (id) => `/api/blogs/${id}`,
    requiresRejectionReason: true,
    approvedToast: "Blog approved.",
    rejectedToast: "Blog rejected.",
    activeToast: (isActive) => `Blog marked as ${isActive ? "active" : "inactive"}.`,
    loadError: "Failed to load blog contributions.",
    updateError: "Failed to update blog contribution.",
  },
  news: {
    singular: "News",
    plural: "News",
    contributorColumn: "Contributor",
    category: "News",
    emptyLabel: "news contributions",
    queryKey: "newsContributions",
    endpoint: "/api/news/contributions",
    statusEndpoint: (id) => `/api/news/contributions/${id}/status`,
    approvedToast: "News approved.",
    rejectedToast: "News rejected.",
    loadError: "Failed to load news contributions.",
    updateError: "Failed to update news contribution.",
  },
  events: {
    singular: "Event",
    plural: "Events",
    contributorColumn: "Contributor",
    category: "Event",
    emptyLabel: "event contributions",
    queryKey: "eventContributions",
    endpoint: "/api/events/contributions",
    statusEndpoint: (id) => `/api/events/contributions/${id}/status`,
    approvedToast: "Event approved.",
    rejectedToast: "Event rejected.",
    loadError: "Failed to load event contributions.",
    updateError: "Failed to update event contribution.",
  },
  places: {
    singular: "Place",
    plural: "Places",
    contributorColumn: "Contributor",
    category: "Place",
    emptyLabel: "place contributions",
    queryKey: "placeContributions",
    endpoint: "/api/places/contributions",
    statusEndpoint: (id) => `/api/places/contributions/${id}/status`,
    approvedToast: "Place approved.",
    rejectedToast: "Place rejected.",
    loadError: "Failed to load place contributions.",
    updateError: "Failed to update place contribution.",
  },
};

const DEFAULT_TAB = CONTRIBUTION_TABS[0];
const TAB_BY_SLUG = CONTRIBUTION_TABS.reduce((acc, tab) => ({ ...acc, [tab.slug]: tab }), {});
const STATUSES = ["pending", "approved", "rejected"];

const formatDate = (raw) => {
  if (!raw) return "-";
  const date = new Date(raw);
  return isValid(date) ? format(date, "dd-MM-yyyy") : "-";
};

const formatDateTime = (raw) => {
  if (!raw) return "-";
  const date = new Date(raw);
  return isValid(date) ? format(date, "dd-MM-yyyy hh:mm a") : "-";
};

const formatLabel = (value) => {
  const raw = String(value || "").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "-";
};

const getText = (value, fallback = "-") => {
  const raw = String(value || "").trim();
  return raw || fallback;
};

const truncate = (value, length = 42) => {
  const text = getText(value, "");
  if (!text) return "-";
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
};

const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const isEventContribution = (config) => config?.category === "Event";
const isPlaceContribution = (config) => config?.category === "Place";

const getContributorName = (item) => {
  const contributor = item?.contributor;
  if (contributor && typeof contributor === "object") {
    const name = [contributor.firstName, contributor.lastName].filter(Boolean).join(" ").trim();
    return contributor.fullName || contributor.name || name || contributor.email || item.author || "Contributor";
  }
  return item?.author || "Contributor";
};

const getActorName = (actor, fallback = "Master Panel") => {
  if (!actor) return fallback;
  if (typeof actor === "string") return actor.trim() || fallback;
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  return actor.fullName || actor.name || actor.reviewerName || actor.email || name || fallback;
};

const getInitials = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CB";

const getDestination = (item) => getText(item?.destination);

const getContributionTitle = (item, config) =>
  getText(isEventContribution(config) ? item?.eventName : isPlaceContribution(config) ? item?.placeName : item?.mainTitle, `Untitled ${config?.singular?.toLowerCase() || "item"}`);

const getContributionDescription = (item, config) =>
  stripHtml(isEventContribution(config) || isPlaceContribution(config) ? item?.shortDescription : item?.mainContent);

const getContributionImage = (item) => getText(item?.mainImage || item?.image, "");

const getContributionSource = (item, config) => {
  if (isEventContribution(config)) {
    return getText(item?.venue || item?.category || item?.eventType);
  }
  if (isPlaceContribution(config)) {
    return getText(item?.address || item?.category || item?.placeType);
  }
  return getText(item?.source);
};

const getContributionDate = (item, config) =>
  isEventContribution(config) || isPlaceContribution(config) ? item?.updatedAt || item?.createdAt : item?.date || item?.createdAt;

const getFirstSubmissionDate = (item) => item?.firstSubmittedAt || item?.submittedAt || item?.createdAt || item?.date;

const getLastEditedDate = (item) => {
  if (Array.isArray(item?.edits) && item.edits.length > 0) {
    const latestEdit = item.edits
      .map((edit) => edit?.updatedAt || edit?.editedAt || edit?.date || edit?.createdAt)
      .filter(Boolean)
      .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0];
    if (latestEdit) return latestEdit;
  }

  return item?.lastEditedAt || item?.editedAt || item?.updatedAt || item?.createdAt || item?.date;
};

const isContributionActive = (item) => item?.isActive !== false;

const getSearchValues = (item, config) => [
  getContributorName(item),
  getContributionTitle(item, config),
  getContributionDescription(item, config),
  getContributionSource(item, config),
  item?.destination,
  item?.link,
  item?.category,
  item?.month,
  item?.eventType,
  item?.address,
  item?.placeType,
  item?.rating,
];

const extractContributions = (payload) => {
  const rows = payload?.data?.data ?? payload?.data?.blogs ?? payload?.data?.news ?? payload?.data ?? payload;
  return Array.isArray(rows) ? rows : [];
};

const normalizeTimelineStatus = (status) => {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved") return "Approved";
  if (raw === "rejected") return "Rejected";
  if (raw === "pending") return "Pending Review";
  return formatLabel(raw);
};

const buildContributionTimeline = (item, config) => {
  if (!item) return [];
  const contributorName = getContributorName(item);
  const createdAt = getFirstSubmissionDate(item);
  const updatedAt = getLastEditedDate(item);
  const status = String(item.status || "pending").toLowerCase();
  const editCount = Number(item.numberOfEdits ?? item.editCount ?? item.edits?.length ?? 0);
  const timeline = [];

  if (createdAt) {
    timeline.push({
      date: createdAt,
      title: "First Submission",
      description: `${config.singular} submitted by ${contributorName}.`,
      tone: "blue",
    });
  }

  if (Array.isArray(item.edits) && item.edits.length > 0) {
    item.edits.forEach((edit, index) => {
      const editDate = edit?.updatedAt || edit?.editedAt || edit?.date || edit?.createdAt;
      if (!editDate) return;
      timeline.push({
        date: editDate,
        title: `Edit ${index + 1}`,
        description: `Edited by ${getActorName(edit?.editedBy || edit?.updatedBy, contributorName)}.`,
        tone: "amber",
      });
    });
  } else if (updatedAt && updatedAt !== createdAt && editCount > 0) {
    timeline.push({
      date: updatedAt,
      title: "Last Edited",
      description: `Edited by ${contributorName}${editCount > 0 ? ` (${editCount} edit${editCount === 1 ? "" : "s"})` : ""}.`,
      tone: "amber",
    });
  }

  if (Array.isArray(item.moderationHistory) && item.moderationHistory.length > 0) {
    item.moderationHistory.forEach((entry) => {
      const entryStatus = String(entry?.status || entry?.action || "").toLowerCase();
      const entryDate = entry?.date || entry?.createdAt || entry?.updatedAt;
      if (!entryDate || !entryStatus) return;
      timeline.push({
        date: entryDate,
        title: normalizeTimelineStatus(entryStatus),
        description: `${normalizeTimelineStatus(entryStatus)} by ${getActorName(entry?.reviewedBy || entry?.moderatedBy || entry?.actor)}.`,
        details: entry?.reason || entry?.rejectionReason || "",
        tone: entryStatus === "approved" ? "emerald" : entryStatus === "rejected" ? "rose" : "slate",
      });
    });
  } else if (["approved", "rejected"].includes(status)) {
    const reviewedAt = item.reviewedAt || item.moderatedAt || item.approvedAt || item.rejectedAt || item.updatedAt;
    timeline.push({
      date: reviewedAt,
      title: normalizeTimelineStatus(status),
      description: `${normalizeTimelineStatus(status)} by ${getActorName(item.reviewedBy || item.moderatedBy || item.approvedBy || item.rejectedBy)}.`,
      details: status === "rejected" ? item.rejectionReason : "",
      tone: status === "approved" ? "emerald" : "rose",
    });
  } else {
    timeline.push({
      date: item.updatedAt || createdAt,
      title: "Pending Review",
      description: `Waiting for ${config.singular.toLowerCase()} review.`,
      tone: "slate",
    });
  }

  return timeline
    .filter((entry) => entry.date)
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
};

const StatTile = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    slate: { border: "border-l-slate-400", label: "text-slate-500", icon: "bg-slate-50 text-slate-600" },
    amber: { border: "border-l-amber-500", label: "text-amber-600", icon: "bg-amber-50 text-amber-600" },
    emerald: { border: "border-l-emerald-500", label: "text-emerald-600", icon: "bg-emerald-50 text-emerald-600" },
    rose: { border: "border-l-rose-500", label: "text-rose-600", icon: "bg-rose-50 text-rose-600" },
  }[tone] || {};

  return (
    <div className={`bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 shadow-sm flex justify-between items-center transition-all hover:shadow-md ${tones.border}`}>
      <div className="min-w-0">
        <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${tones.label}`}>{label}</p>
        <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
      </div>
      <div className={`p-2 rounded-2xl shrink-0 ${tones.icon}`}><Icon size={16} /></div>
    </div>
  );
};

const EmptyTable = ({ label }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Target size={28} /></div>
    <p className="text-slate-400 font-semibold">No {label} found.</p>
  </div>
);

const EventPreviewContent = ({ item, config }) => {
  const image = getContributionImage(item);
  const description = getContributionDescription(item, config);

  return (
    <div className="min-h-0 overflow-y-auto break-words px-4 pb-10 pt-4 font-pregular text-base font-normal text-black md:px-8">
      <h2 className="font-pbold text-[28px] leading-normal sm:text-[32px]">{getContributionTitle(item, config)}</h2>
      {item.month ? (
        <div className="mt-2 flex items-center gap-2 text-base font-medium">
          <CalendarDays size={16} strokeWidth={2.2} />
          <span>During the month of {item.month}</span>
        </div>
      ) : null}

      {image ? (
        <img src={image} alt={getContributionTitle(item, config)} className="mt-6 aspect-[3.3/1] w-full rounded-xl bg-slate-100 object-cover" />
      ) : (
        <div className="mt-6 flex aspect-[3.3/1] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">No image</div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 font-pbold text-base md:grid-cols-3">
        <p>{getText(item.category)}</p>
        <p className="md:text-center">{getText(item.month)}</p>
        <p className="md:text-right">{getText(item.venue)}</p>
      </div>

      <hr className="my-6" />
      <p className="whitespace-pre-line leading-relaxed">{description || "No short description provided."}</p>
      {item.eventType ? <p className="mt-6 text-sm text-slate-600">Type: {item.eventType}</p> : null}
      {item.link ? (
        <a className="mt-6 inline-flex text-sm font-pmedium text-[#0BA9EF] hover:underline" href={item.link} target="_blank" rel="noreferrer">Open event link</a>
      ) : null}
    </div>
  );
};

const PlacePreviewContent = ({ item, config }) => {
  const image = getContributionImage(item);
  const description = getContributionDescription(item, config);
  const rating = getText(item.rating, "");

  return (
    <div className="min-h-0 overflow-y-auto break-words px-4 pb-10 pt-4 font-pregular text-base font-normal text-black md:px-8">
      <h2 className="font-pbold text-[28px] leading-normal sm:text-[32px]">{getContributionTitle(item, config)}</h2>
      {item.address ? (
        <div className="mt-2 flex items-center gap-2 text-base font-medium">
          <MapPin size={16} strokeWidth={2.2} />
          <span>{item.address}</span>
        </div>
      ) : null}

      {image ? (
        <img src={image} alt={getContributionTitle(item, config)} className="mt-6 aspect-[3.3/1] w-full rounded-xl bg-slate-100 object-cover" />
      ) : (
        <div className="mt-6 flex aspect-[3.3/1] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">No image</div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 font-pbold text-base md:grid-cols-3">
        <p>{getText(item.category || item.placeType)}</p>
        <p className="md:text-center">{rating ? <span className="inline-flex items-center justify-center gap-1"><Star size={15} className="fill-amber-400 text-amber-400" />{rating}</span> : "-"}</p>
        <p className="md:text-right">{getText(item.venue || item.month)}</p>
      </div>

      <hr className="my-6" />
      <p className="whitespace-pre-line leading-relaxed">{description || "No short description provided."}</p>
      {item.googleMapsLink ? (
        <a className="mt-6 inline-flex text-sm font-pmedium text-[#0BA9EF] hover:underline" href={item.googleMapsLink} target="_blank" rel="noreferrer">Open Google Maps</a>
      ) : null}
      {item.link ? (
        <a className="ml-0 mt-6 inline-flex text-sm font-pmedium text-[#0BA9EF] hover:underline sm:ml-5" href={item.link} target="_blank" rel="noreferrer">Open place link</a>
      ) : null}
    </div>
  );
};
// Keep blog and news typography and image wrapping aligned with contributor articles.
const ArticlePreviewImage = ({ src, alt, side = "right" }) => {
  if (!src) return null;

  return (
    <div className={`mb-5 h-auto w-full overflow-hidden rounded-xl md:mb-3 md:w-[38%] lg:w-[36%] ${side === "left" ? "md:float-left md:mr-8" : "md:float-right md:ml-8"}`}>
      <img src={src} alt={alt} className="block h-auto w-full" />
    </div>
  );
};

const ArticlePreviewContent = ({ item, config }) => {
  const sections = Array.isArray(item.sections) ? item.sections : [];
  const title = getContributionTitle(item, config);
  let sectionImageIndex = 0;

  return (
    <div className="min-h-0 overflow-y-auto break-words px-4 pb-10 pt-4 font-pregular text-base font-normal text-black md:px-8">
      <div className="flex flex-col gap-8">
        <section className="clear-both flow-root">
          <h2 className="mb-8 font-pbold text-[28px] leading-normal sm:text-[32px]">{title}</h2>
          <ArticlePreviewImage src={getContributionImage(item)} alt={title} />
          <p className="whitespace-pre-line leading-relaxed max-sm:text-[14px]">{getContributionDescription(item, config) || "No main content provided."}</p>
        </section>

        {sections.length > 0 ? (
          <>
            <hr />
            <section className="flex flex-col gap-8">
              {sections.map((section, index) => {
                const imageSide = section.image ? (sectionImageIndex++ % 2 === 0 ? "left" : "right") : undefined;

                return (
                  <article key={`${section.title || "section"}-${index}`} className="clear-both flow-root">
                    {section.title ? <h3 className="mb-4 font-pbold text-[20px] leading-[1.2] sm:text-2xl md:leading-[1.35]">{section.title}</h3> : null}
                    <ArticlePreviewImage src={section.image} alt={section.title || `Section ${index + 1}`} side={imageSide} />
                    {section.content ? <p className="whitespace-pre-line leading-relaxed max-sm:text-[14px]">{stripHtml(section.content).trimStart()}</p> : null}
                  </article>
                );
              })}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

const ContributionPreviewModal = ({ item, config, onClose, onStatusChange, isUpdating }) => {
  if (!item || !config) return null;
  const status = String(item.status || "pending").toLowerCase();
  const canModerate = status === "pending";
  const editCount = Number(item.numberOfEdits ?? item.editCount ?? item.edits?.length ?? 0);
  const metadata = [
    ["Destination", getDestination(item)],
    ["Date", formatDate(getContributionDate(item, config))],
    ["First Submission", formatDateTime(getFirstSubmissionDate(item))],
    ["Last Edited", formatDateTime(getLastEditedDate(item))],
    ["Number Of Edits", Number.isFinite(editCount) ? editCount : 0],
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/50 p-3 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 px-6 py-5 pr-16 text-[14px] font-pregular font-normal text-slate-600 md:px-8 md:pr-16">
          <div className="flex flex-nowrap items-center overflow-x-auto whitespace-nowrap">
            {metadata.map(([label, value], index) => (
              <React.Fragment key={label}>
                {index > 0 ? <span className="mx-2 shrink-0 text-slate-300">|</span> : null}
                <p className="shrink-0">
                  {label}: <span className="text-slate-800">{value}</span>
                </p>
              </React.Fragment>
            ))}
          </div>
          <button type="button" onClick={onClose} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"><X size={16} /></button>
        </div>

        {isEventContribution(config) ? (
          <EventPreviewContent item={item} config={config} />
        ) : isPlaceContribution(config) ? (
          <PlacePreviewContent item={item} config={config} />
        ) : (
          <ArticlePreviewContent item={item} config={config} />
        )}

        <div className="flex shrink-0 justify-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-5">
          {canModerate ? (
            <>
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item._id || item.id, "approved")} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[12px] font-pmedium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={14} className="mr-1.5 inline" />Approve {config.singular}</button>
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(item._id || item.id, "rejected")} className="rounded-xl bg-rose-600 px-6 py-2.5 text-[12px] font-pmedium text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"><XCircle size={14} className="mr-1.5 inline" />Reject {config.singular}</button>
            </>
          ) : (
            <span className="flex items-center text-[12px] font-pmedium text-slate-500">This {config.singular.toLowerCase()} has already been {status}.</span>
          )}
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-200 px-6 py-2.5 text-[12px] font-pmedium text-slate-700 transition hover:bg-slate-300">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const RejectionReasonModal = ({ item, config, reason, onReasonChange, onClose, onSubmit, isSubmitting }) => {
  if (!item || !config) return null;
  const title = getContributionTitle(item, config);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/80 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-pmedium text-slate-950">Reject {config.singular}</h3>
            <p className="mt-1 text-[12px] font-pmedium text-slate-500">{title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:text-slate-700 disabled:opacity-60">
            <X size={16} />
          </button>
        </div>

        <label className="mb-2 block text-[11px] font-pmedium uppercase tracking-widest text-slate-500">Reason for rejection</label>
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value.slice(0, 500))}
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-pmedium text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          placeholder={`Tell the contributor why this ${config.singular.toLowerCase()} was rejected...`}
          autoFocus
        />
        <p className="mt-1 text-right text-[10px] font-pmedium text-slate-400">{reason.length}/500</p>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl bg-slate-100 px-5 py-2.5 text-[12px] font-pmedium text-slate-700 transition hover:bg-slate-200 disabled:opacity-60">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={!reason.trim() || isSubmitting} className="rounded-xl bg-rose-600 px-5 py-2.5 text-[12px] font-pmedium text-white transition hover:bg-rose-700 disabled:opacity-60">
            {isSubmitting ? "Rejecting..." : `Reject ${config.singular}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const TimelineModal = ({ item, config, onClose }) => {
  if (!item || !config) return null;
  const title = getContributionTitle(item, config);
  const timeline = buildContributionTimeline(item, config);
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div>
            <h3 className="text-base font-pmedium text-slate-950">{config.singular} Timeline</h3>
            <p className="mt-1 text-[12px] font-pmedium text-slate-500">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-6">
          {timeline.length > 0 ? (
            <ol className="relative ml-3 border-l border-slate-200">
              {timeline.map((entry, index) => (
                <li key={`${entry.title}-${entry.date}-${index}`} className="mb-7 ml-6 last:mb-0">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border ${tones[entry.tone] || tones.slate}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                  </span>
                  <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-[13px] font-pmedium text-slate-950">{entry.title}</h4>
                      <time className="text-[11px] font-pmedium text-slate-400">{formatDateTime(entry.date)}</time>
                    </div>
                    <p className="mt-1 text-[12px] font-pmedium text-slate-600">{entry.description}</p>
                    {entry.details ? (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] font-pmedium text-slate-700">{entry.details}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[12px] font-pmedium text-slate-400">No timeline entries available.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const Contributions = () => {
  const navigate = useNavigate();
  const { contributionTab } = useParams();
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const { auth } = useAuth();
  const activeTab = TAB_BY_SLUG[contributionTab] || DEFAULT_TAB;
  const activeConfig = CONTRIBUTION_CONFIG[activeTab.type];
  const supportsModeration = Boolean(activeConfig);
  const [stageFilter, setStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [timelineItemId, setTimelineItemId] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!contributionTab || !TAB_BY_SLUG[contributionTab]) {
      navigate(`/dashboard/contributions/${DEFAULT_TAB.slug}`, { replace: true });
    }
  }, [contributionTab, navigate]);

  useEffect(() => {
    setStageFilter("all");
    setSearchQuery("");
    setSelectedItemId(null);
    setTimelineItemId(null);
    setRejectionTarget(null);
    setRejectionReason("");
  }, [activeTab.slug]);

  const { data: contributions = [], isPending, isError } = useQuery({
    queryKey: [activeConfig?.queryKey],
    enabled: supportsModeration,
    queryFn: async () => {
      const response = await axiosPrivate.get(activeConfig.endpoint, { headers: { "Cache-Control": "no-cache" } });
      return extractContributions(response);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status, rejectionReason }) => {
      const payload = { status };
      const reviewerName = [auth?.user?.firstName, auth?.user?.lastName].filter(Boolean).join(" ").trim();
      payload.reviewerName = reviewerName || auth?.user?.name || auth?.user?.email || "Master Panel";
      payload.reviewerEmail = auth?.user?.email || "";
      if (status === "rejected") {
        payload.rejectionReason = rejectionReason;
      }
      const response = await axiosPrivate.patch(activeConfig.statusEndpoint(itemId), payload);
      return response?.data;
    },
    onSuccess: (_data, { status }) => {
      toast.success(status === "approved" ? activeConfig.approvedToast : activeConfig.rejectedToast);
      queryClient.invalidateQueries({ queryKey: [activeConfig.queryKey] });
      setSelectedItemId(null);
      setRejectionTarget(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || activeConfig.updateError);
    },
  });

  const updateActiveMutation = useMutation({
    mutationFn: async ({ itemId, isActive }) => {
      const response = await axiosPrivate.patch(activeConfig.activeEndpoint(itemId), { isActive });
      return response?.data;
    },
    onSuccess: (_data, { isActive }) => {
      toast.success(activeConfig.activeToast?.(isActive) || `${activeConfig.singular} status updated.`);
      queryClient.invalidateQueries({ queryKey: [activeConfig.queryKey] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || activeConfig.updateError);
    },
  });

  const filteredContributions = useMemo(() => {
    if (!supportsModeration) return [];
    const query = searchQuery.trim().toLowerCase();
    return contributions.filter((item) => {
      const status = String(item.status || "pending").toLowerCase();
      const matchesStatus = stageFilter === "all" || status === stageFilter;
      const matchesSearch = !query || getSearchValues(item, activeConfig)
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [activeConfig, contributions, searchQuery, stageFilter, supportsModeration]);

  const stats = useMemo(() => ({
    total: contributions.length,
    pending: contributions.filter((item) => String(item.status || "pending").toLowerCase() === "pending").length,
    approved: contributions.filter((item) => String(item.status || "pending").toLowerCase() === "approved").length,
    rejected: contributions.filter((item) => String(item.status || "pending").toLowerCase() === "rejected").length,
  }), [contributions]);

  const selectedItem = useMemo(() => contributions.find((item) => (item._id || item.id) === selectedItemId), [contributions, selectedItemId]);
  const timelineItem = useMemo(() => contributions.find((item) => (item._id || item.id) === timelineItemId), [contributions, timelineItemId]);
  const beginStatusChange = (itemId, status) => {
    if (status === "rejected" && activeConfig.requiresRejectionReason) {
      const item = contributions.find((entry) => (entry._id || entry.id) === itemId);
      setRejectionTarget(item || null);
      setRejectionReason("");
      return;
    }

    updateStatusMutation.mutate({ itemId, status });
  };

  const submitRejection = () => {
    const reason = rejectionReason.trim();
    if (!rejectionTarget || !reason) {
      toast.error("A rejection reason is required.");
      return;
    }

    updateStatusMutation.mutate({
      itemId: rejectionTarget._id || rejectionTarget.id,
      status: "rejected",
      rejectionReason: reason,
    });
  };

  const rows = supportsModeration ? filteredContributions : [];
  const colSpan = 7;

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4 text-slate-700 font-sans">
          <div className="mb-1 flex flex-col gap-1.5">
            <h2 className="text-title font-pmedium text-primary uppercase">Contributions</h2>
            <p className="text-xs font-pmedium text-slate-500">Manage submitted Blogs, News, Places, and Events across all companies.</p>
          </div>

          <div role="tablist" aria-label="Contribution type" className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
            {CONTRIBUTION_TABS.map((tab) => (
              <NavLink key={tab.slug} role="tab" aria-selected={activeTab.slug === tab.slug} to={`/dashboard/contributions/${tab.slug}`} className={`flex-1 rounded-xl px-4 py-2 text-center text-[10px] font-pmedium uppercase tracking-widest transition-all ${activeTab.slug === tab.slug ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
                {tab.label}
              </NavLink>
            ))}
          </div>

          {!supportsModeration ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center text-slate-400 text-sm font-semibold">{activeTab.label} will be available soon.</div>
          ) : isPending ? (
            <div className="py-16 text-center text-slate-400 text-sm font-semibold">Loading contributions...</div>
          ) : isError ? (
            <div className="py-16 text-center text-red-500 text-sm font-semibold">{activeConfig.loadError}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                <StatTile label={`Total ${activeConfig.plural}`} value={stats.total} icon={FileText} tone="slate" />
                <StatTile label="Pending" value={stats.pending} icon={Sparkles} tone="amber" />
                <StatTile label="Approved" value={stats.approved} icon={BadgeCheck} tone="emerald" />
                <StatTile label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" />
              </div>

              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
                <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button type="button" onClick={() => setStageFilter("all")} className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${stageFilter === "all" ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"}`}>All</button>
                    {STATUSES.map((status) => (
                      <button key={status} type="button" onClick={() => setStageFilter(status)} className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${stageFilter === status ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"}`}>{formatLabel(status)}</button>
                    ))}
                  </div>
                  <div className="relative w-full xl:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input type="text" placeholder="Search by name, source..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left min-w-[920px]">
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-5 py-4">{activeConfig.contributorColumn}</th>
                        <th className="px-5 py-4">Title</th>
                        <th className="px-5 py-4">Description</th>
                        <th className="px-5 py-4">Source</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Category</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {rows.length === 0 ? (
                        <tr><td colSpan={colSpan}><EmptyTable label={activeConfig.emptyLabel} /></td></tr>
                      ) : rows.map((item, index) => {
                        const itemId = item._id || item.id;
                        const contributor = getContributorName(item);
                        const status = String(item.status || "pending").toLowerCase();
                        const isActive = isContributionActive(item);
                        const canToggleActive = typeof activeConfig.activeEndpoint === "function";
                        return (
                          <tr key={itemId} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-5 py-4"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(contributor)}</div><p className="text-[12px] font-pmedium text-slate-900">{contributor}</p></div></td>
                            <td className="px-5 py-4 max-w-[170px]"><p className="text-[11px] font-pmedium uppercase text-slate-900 truncate">{truncate(getContributionTitle(item, activeConfig), 28)}</p></td>
                            <td className="px-5 py-4 max-w-[240px]"><p className="text-[12px] font-pmedium text-slate-600 truncate">{truncate(getContributionDescription(item, activeConfig), 48)}</p></td>
                            <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-700">{getContributionSource(item, activeConfig)}</span></td>
                            <td className="px-5 py-4"><span className={statusPillClass(status)}>{status}</span></td>
                            <td className="px-5 py-4"><span className="inline-flex whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-pmedium text-blue-700">{activeConfig.category}</span></td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => setSelectedItemId(itemId)} data-tour={index === 0 ? "contributions-action-view" : undefined} title={`View ${activeConfig.singular.toLowerCase()}`} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"><Eye size={15} strokeWidth={2.5} /></button>
                                <button type="button" onClick={() => setTimelineItemId(itemId)} title={`View ${activeConfig.singular.toLowerCase()} timeline`} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"><History size={15} strokeWidth={2.5} /></button>
                                {canToggleActive ? (
                                  <button
                                    type="button"
                                    onClick={() => updateActiveMutation.mutate({ itemId, isActive: !isActive })}
                                    disabled={updateActiveMutation.isPending}
                                    title={isActive ? "Mark as Inactive" : "Mark as Active"}
                                    className={`p-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isActive
                                        ? "bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700"
                                        : "bg-rose-100 text-rose-700 hover:bg-emerald-100 hover:text-emerald-700"
                                    }`}
                                  >
                                    <Power size={15} strokeWidth={2.5} />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </PageFrame>

      <ContributionPreviewModal item={selectedItem} config={activeConfig} onClose={() => setSelectedItemId(null)} onStatusChange={beginStatusChange} isUpdating={updateStatusMutation.isPending} />
      <TimelineModal item={timelineItem} config={activeConfig} onClose={() => setTimelineItemId(null)} />
      <RejectionReasonModal
        item={rejectionTarget}
        config={activeConfig}
        reason={rejectionReason}
        onReasonChange={setRejectionReason}
        onClose={() => {
          if (updateStatusMutation.isPending) return;
          setRejectionTarget(null);
          setRejectionReason("");
        }}
        onSubmit={submitRejection}
        isSubmitting={updateStatusMutation.isPending}
      />
    </div>
  );
};

export default Contributions;
