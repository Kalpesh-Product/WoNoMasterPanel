import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileText,
  Search,
  Sparkles,
  Target,
  X,
  XCircle,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const CONTRIBUTION_TABS = [
  { slug: "blog-contributions", label: "Blog Contributions", type: "blog" },
  { slug: "news-contributions", label: "News Contributions", type: "news" },
  { slug: "places-contributions", label: "Places Contributions", type: "places" },
  { slug: "event-contributions", label: "Event Contributions", type: "events" },
];

const DEFAULT_TAB = CONTRIBUTION_TABS[0];
const TAB_BY_SLUG = CONTRIBUTION_TABS.reduce((acc, tab) => ({ ...acc, [tab.slug]: tab }), {});
const STATUSES = ["pending", "approved", "rejected"];

const formatDate = (raw) => {
  if (!raw) return "-";
  const date = new Date(raw);
  return isValid(date) ? format(date, "dd-MM-yyyy") : "-";
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

const getContributorName = (blog) => {
  const contributor = blog?.contributor;
  if (contributor && typeof contributor === "object") {
    const name = [contributor.firstName, contributor.lastName].filter(Boolean).join(" ").trim();
    return contributor.fullName || contributor.name || name || contributor.email || blog.author || "Contributor";
  }
  return blog?.author || "Contributor";
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

const getDestination = (blog) => getText(blog?.destination);

const extractBlogs = (payload) => {
  const rows = payload?.data?.data ?? payload?.data?.blogs ?? payload?.data ?? payload;
  return Array.isArray(rows) ? rows : [];
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
    <p className="text-slate-400 font-semibold">No {label.toLowerCase()} found.</p>
  </div>
);

const BlogPreviewModal = ({ blog, onClose, onStatusChange, isUpdating }) => {
  if (!blog) return null;
  const status = String(blog.status || "pending").toLowerCase();
  const canModerate = status === "pending";
  const sections = Array.isArray(blog.sections) ? blog.sections : [];
  const editCount = Number(blog.numberOfEdits ?? blog.editCount ?? blog.edits?.length ?? 0);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/50 p-3 backdrop-blur-md" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5 text-[15px] font-pmedium text-slate-600 md:grid-cols-3 md:px-10">
          <p>Destination: <span className="text-slate-800">{getDestination(blog)}</span></p>
          <p>Date: <span className="text-slate-800">{formatDate(blog.date || blog.createdAt)}</span></p>
          <p>Number Of Edits: <span className="text-slate-800">{Number.isFinite(editCount) ? editCount : 0}</span></p>
          <button type="button" onClick={onClose} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-6 md:px-12 md:py-8">
          <h2 className="mb-6 max-w-4xl text-2xl font-pmedium leading-tight text-slate-950 md:text-3xl">{getText(blog.mainTitle, "Untitled blog")}</h2>
          <div className="mb-9 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            <p className="whitespace-pre-line text-[15px] font-pmedium leading-7 text-slate-800">{stripHtml(blog.mainContent) || "No main content provided."}</p>
            {blog.mainImage ? (
              <img src={blog.mainImage} alt={blog.mainTitle || "Blog"} className="h-40 w-full rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-[12px] font-pmedium text-slate-400">No image</div>
            )}
          </div>

          <div className="space-y-7">
            {sections.length === 0 ? null : sections.map((section, index) => (
              <section key={`${section.title || "section"}-${index}`} className="space-y-3">
                {section.title ? <h3 className="text-xl font-pmedium text-slate-950">{section.title}</h3> : null}
                {section.image ? <img src={section.image} alt={section.title || `Section ${index + 1}`} className="max-h-64 w-full rounded-2xl object-cover" /> : null}
                {section.content ? <p className="whitespace-pre-line text-[15px] font-pmedium leading-7 text-slate-800">{stripHtml(section.content)}</p> : null}
              </section>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 justify-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-5">
          {canModerate ? (
            <>
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(blog._id || blog.id, "approved")} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[12px] font-pmedium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={14} className="mr-1.5 inline" />Approve Blog</button>
              <button type="button" disabled={isUpdating} onClick={() => onStatusChange(blog._id || blog.id, "rejected")} className="rounded-xl bg-rose-600 px-6 py-2.5 text-[12px] font-pmedium text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"><XCircle size={14} className="mr-1.5 inline" />Reject Blog</button>
            </>
          ) : (
            <span className="flex items-center text-[12px] font-pmedium text-slate-500">This blog has already been {status}.</span>
          )}
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-200 px-6 py-2.5 text-[12px] font-pmedium text-slate-700 transition hover:bg-slate-300">Cancel</button>
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
  const activeTab = TAB_BY_SLUG[contributionTab] || DEFAULT_TAB;
  const [stageFilter, setStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBlogId, setSelectedBlogId] = useState(null);

  useEffect(() => {
    if (!contributionTab || !TAB_BY_SLUG[contributionTab]) {
      navigate(`/dashboard/contributions/${DEFAULT_TAB.slug}`, { replace: true });
    }
  }, [contributionTab, navigate]);

  useEffect(() => {
    setStageFilter("all");
    setSearchQuery("");
    setSelectedBlogId(null);
  }, [activeTab.slug]);

  const { data: blogs = [], isPending, isError } = useQuery({
    queryKey: ["blogContributions"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/blogs/contributions", { headers: { "Cache-Control": "no-cache" } });
      return extractBlogs(response);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ blogId, status }) => {
      const response = await axiosPrivate.patch(`/api/blogs/contributions/${blogId}/status`, { status });
      return response?.data;
    },
    onSuccess: (_data, { status }) => {
      toast.success(status === "approved" ? "Blog approved." : "Blog rejected.");
      queryClient.invalidateQueries({ queryKey: ["blogContributions"] });
      setSelectedBlogId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update blog contribution.");
    },
  });

  const filteredBlogs = useMemo(() => {
    if (activeTab.type !== "blog") return [];
    const query = searchQuery.trim().toLowerCase();
    return blogs.filter((blog) => {
      const status = String(blog.status || "pending").toLowerCase();
      const matchesStatus = stageFilter === "all" || status === stageFilter;
      const matchesSearch = !query || [getContributorName(blog), blog.mainTitle, blog.mainContent, blog.source, blog.destination, blog.link]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [activeTab.type, blogs, searchQuery, stageFilter]);

  const stats = useMemo(() => {
    const rows = activeTab.type === "blog" ? blogs : [];
    return {
      total: rows.length,
      pending: rows.filter((item) => String(item.status || "pending").toLowerCase() === "pending").length,
      approved: rows.filter((item) => String(item.status || "pending").toLowerCase() === "approved").length,
      rejected: rows.filter((item) => String(item.status || "pending").toLowerCase() === "rejected").length,
    };
  }, [activeTab.type, blogs]);

  const selectedBlog = useMemo(() => blogs.find((blog) => (blog._id || blog.id) === selectedBlogId), [blogs, selectedBlogId]);

  const rows = activeTab.type === "blog" ? filteredBlogs : [];
  const colSpan = 8;

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

          {isPending && activeTab.type === "blog" ? (
            <div className="py-16 text-center text-slate-400 text-sm font-semibold">Loading contributions...</div>
          ) : isError && activeTab.type === "blog" ? (
            <div className="py-16 text-center text-red-500 text-sm font-semibold">Failed to load blog contributions.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                <StatTile label={`Total ${activeTab.type === "blog" ? "Blogs" : "Items"}`} value={stats.total} icon={FileText} tone="slate" />
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
                        <th className="px-5 py-4">Blogger</th>
                        <th className="px-5 py-4">Title</th>
                        <th className="px-5 py-4">Description</th>
                        <th className="px-5 py-4">Source</th>
                        <th className="px-5 py-4">Link</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Category</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {rows.length === 0 ? (
                        <tr><td colSpan={colSpan}><EmptyTable label={activeTab.label} /></td></tr>
                      ) : rows.map((blog, index) => {
                        const blogId = blog._id || blog.id;
                        const blogger = getContributorName(blog);
                        const status = String(blog.status || "pending").toLowerCase();
                        return (
                          <tr key={blogId} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-5 py-4"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(blogger)}</div><p className="text-[12px] font-pmedium text-slate-900">{blogger}</p></div></td>
                            <td className="px-5 py-4 max-w-[170px]"><p className="text-[11px] font-pmedium uppercase text-slate-900 truncate">{truncate(blog.mainTitle, 28)}</p></td>
                            <td className="px-5 py-4 max-w-[240px]"><p className="text-[12px] font-pmedium text-slate-600 truncate">{truncate(stripHtml(blog.mainContent), 48)}</p></td>
                            <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-700">{getText(blog.source)}</span></td>
                            <td className="px-5 py-4"><span className="text-[12px] font-pmedium text-slate-600">{blog.link ? <a className="text-[#2563EB] hover:underline" href={blog.link} target="_blank" rel="noreferrer">Open</a> : "-"}</span></td>
                            <td className="px-5 py-4"><span className={statusPillClass(status)}>{status}</span></td>
                            <td className="px-5 py-4"><span className="inline-flex whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-pmedium text-blue-700">Blog</span></td>
                            <td className="px-5 py-4"><div className="flex items-center justify-center"><button type="button" onClick={() => setSelectedBlogId(blogId)} data-tour={index === 0 ? "contributions-action-view" : undefined} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"><Eye size={15} strokeWidth={2.5} /></button></div></td>
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

      <BlogPreviewModal blog={selectedBlog} onClose={() => setSelectedBlogId(null)} onStatusChange={(blogId, status) => updateStatusMutation.mutate({ blogId, status })} isUpdating={updateStatusMutation.isPending} />
    </div>
  );
};

export default Contributions;

