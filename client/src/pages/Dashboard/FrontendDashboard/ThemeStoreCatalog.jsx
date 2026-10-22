import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Eye,
  ExternalLink,
  ImageUp,
  Monitor,
  Pencil,
  Plus,
  Save,
  Search,
  Smartphone,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { TEMPLATE_REGISTRY } from "./WebsiteBuilder/templates/templateRegistry";

// Maps a registry template's `recommendedFor` service kinds to a catalog vertical.
// Templates with no match (e.g. Classic, Fresh Studio) fall back to "general"
// so admins can still correct it from the editor before publishing.
const VERTICAL_BY_RECOMMENDATION = {
  menu: "cafe",
  hostel: "hostel",
  coLiving: "co-living",
  workation: "co-living",
  workspace: "co-working",
  meeting: "meeting-rooms",
};

const verticalFromRegistryTemplate = (template) => {
  const match = (template.recommendedFor || []).find((tag) => VERTICAL_BY_RECOMMENDATION[tag]);
  return match ? VERTICAL_BY_RECOMMENDATION[match] : "general";
};

const EMPTY_FORM = {
  templateId: "",
  name: "",
  vertical: "",
  description: "",
  externalDemoUrl: "",
  status: "coming-soon",
  disabledReason: "Coming soon",
  featured: false,
  swatchBg: "#ffffff",
  swatchFg: "#111111",
  swatchAccent: "#0aa9ef",
  swatchFont: "'Poppins', sans-serif",
  desktopScreenshot: null,
  mobileScreenshot: null,
};

const STATUS_STYLE = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "coming-soon": "bg-amber-50 text-amber-700 ring-amber-200",
  hidden: "bg-slate-100 text-slate-600 ring-slate-200",
};

const titleCase = (value) => String(value || "")
  .split("-")
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

const templateIdFromName = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const themeReferenceUrl = (theme) =>
  theme?.externalDemoUrl || (theme?.templateId ? `https://${theme.templateId}demo.wono.co/` : "");

const formFromTheme = (theme) => ({
  ...EMPTY_FORM,
  templateId: theme.templateId,
  name: theme.name,
  vertical: theme.vertical,
  description: theme.description,
  externalDemoUrl: theme.externalDemoUrl || "",
  status: theme.status,
  disabledReason: theme.disabledReason || "Coming soon",
  featured: theme.featured === true,
  swatchBg: theme.swatch?.bg || "#ffffff",
  swatchFg: theme.swatch?.fg || "#111111",
  swatchAccent: theme.swatch?.accent || "#0aa9ef",
  swatchFont: theme.swatch?.font || "'Poppins', sans-serif",
});

const ScreenshotInput = ({ label, hint, icon: Icon, existingUrl, file, onChange, portrait = false }) => {
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : existingUrl, [file, existingUrl]);
  useEffect(() => () => {
    if (file && previewUrl) URL.revokeObjectURL(previewUrl);
  }, [file, previewUrl]);

  return (
    <label className="group block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400 hover:bg-blue-50/40">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      {previewUrl ? (
        <div className={`relative overflow-hidden bg-slate-100 ${portrait ? "h-56" : "aspect-[16/8]"}`}>
          <img src={previewUrl} alt={`${label} preview`} className="h-full w-full object-contain object-top" />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-pmedium text-white">Replace</span>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
          <Icon size={23} className="text-slate-400 group-hover:text-blue-600" />
          <p className="mt-3 text-xs font-pmedium text-slate-800">{label}</p>
          <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
        </div>
      )}
    </label>
  );
};

const ThemeStoreCatalog = ({ embedded = false }) => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [orderedThemes, setOrderedThemes] = useState([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggedId, setDraggedId] = useState("");
  const [editor, setEditor] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const registrySyncRef = useRef(false);

  const catalogQuery = useQuery({
    queryKey: ["website-theme-catalog"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-theme-catalog");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  useEffect(() => {
    if (!orderDirty && catalogQuery.data) setOrderedThemes(catalogQuery.data);
  }, [catalogQuery.data, orderDirty]);

  // Keep the catalog in sync with the website builder's template registry: any
  // template added there (Template settings shows the same registry) shows up
  // here automatically, hidden, instead of requiring a manual "Add theme" entry.
  // Admins still choose the vertical/screenshots and flip it live themselves.
  useEffect(() => {
    if (registrySyncRef.current || !catalogQuery.data) return;
    const existingIds = new Set(catalogQuery.data.map((theme) => theme.templateId));
    const missingTemplates = Object.values(TEMPLATE_REGISTRY).filter(
      (template) => !template.hidden && !existingIds.has(template.id),
    );
    if (missingTemplates.length === 0) return;
    registrySyncRef.current = true;

    (async () => {
      let added = 0;
      for (const template of missingTemplates) {
        const payload = new FormData();
        payload.append("templateId", template.id);
        payload.append("name", template.name);
        payload.append("vertical", verticalFromRegistryTemplate(template));
        payload.append("description", template.description);
        payload.append("status", "hidden");
        payload.append("swatchBg", template.swatch?.bg || "#ffffff");
        payload.append("swatchFg", template.swatch?.fg || "#111111");
        payload.append("swatchAccent", template.swatch?.accent || "#0aa9ef");
        payload.append("swatchFont", template.swatch?.font || "'Poppins', sans-serif");
        payload.append("featured", "false");
        payload.append("disabledReason", "Coming soon");
        try {
          await axiosPrivate.post("/api/website-theme-catalog", payload);
          added += 1;
        } catch (error) {
          if (error?.response?.status !== 409) {
            console.error(`Failed to sync template "${template.id}" into the theme catalog:`, error);
          }
        }
      }
      if (added > 0) {
        toast.success(`Added ${added} new theme${added === 1 ? "" : "s"} from the template registry (hidden until you publish it)`);
        await queryClient.invalidateQueries({ queryKey: ["website-theme-catalog"] });
      }
    })();
  }, [catalogQuery.data, axiosPrivate, queryClient]);

  const verticalOptions = useMemo(() => {
    const values = [...new Set(orderedThemes.map((theme) => theme.vertical).filter(Boolean))];
    return ["all", ...values.sort((left, right) => titleCase(left).localeCompare(titleCase(right)))];
  }, [orderedThemes]);

  const filteredThemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orderedThemes.filter((theme) => {
      if (verticalFilter !== "all" && theme.vertical !== verticalFilter) return false;
      if (statusFilter !== "all" && theme.status !== statusFilter) return false;
      if (!query) return true;
      return [theme.name, theme.templateId, theme.vertical, theme.description]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [orderedThemes, searchQuery, statusFilter, verticalFilter]);

  const saveThemeMutation = useMutation({
    mutationFn: async ({ themeId, values }) => {
      const payload = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (key === "desktopScreenshot" || key === "mobileScreenshot") {
          if (value) payload.append(key, value);
        } else {
          payload.append(key, String(value ?? ""));
        }
      });
      return themeId
        ? axiosPrivate.patch(`/api/website-theme-catalog/${themeId}`, payload)
        : axiosPrivate.post("/api/website-theme-catalog", payload);
    },
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Theme saved");
      setEditor(null);
      setForm(EMPTY_FORM);
      setOrderDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["website-theme-catalog"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save the theme"),
  });

  const reorderMutation = useMutation({
    mutationFn: () => axiosPrivate.put("/api/website-theme-catalog/order", {
      themeIds: orderedThemes.map((theme) => theme._id),
    }),
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Theme order saved");
      setOrderDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["website-theme-catalog"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save the order"),
  });

  const openCreate = () => {
    setEditor({ mode: "create", theme: null });
    setForm(EMPTY_FORM);
  };

  const openEdit = (theme) => {
    setEditor({ mode: "edit", theme });
    setForm(formFromTheme(theme));
  };

  const openPreview = (theme) => {
    setPreviewTheme(theme);
    setPreviewDevice("desktop");
  };

  const handleDrop = (targetId) => {
    if (!draggedId || draggedId === targetId) return;
    setOrderedThemes((current) => {
      const from = current.findIndex((theme) => theme._id === draggedId);
      const to = current.findIndex((theme) => theme._id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setOrderDirty(true);
    setDraggedId("");
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.templateId.trim() || !form.name.trim() || !form.vertical.trim() || !form.description.trim()) {
      toast.error("Template ID, name, vertical and description are required");
      return;
    }
    saveThemeMutation.mutate({ themeId: editor?.theme?._id, values: form });
  };

  const Frame = embedded ? Fragment : PageFrame;

  return (
    <Frame>
      <div className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/50 p-4">
            {verticalOptions.map((vertical) => (
              <button
                key={vertical}
                type="button"
                onClick={() => setVerticalFilter(vertical)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-[11px] font-pmedium transition-all ${verticalFilter === vertical ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70"}`}
              >
                {vertical === "all" ? "All verticals" : titleCase(vertical)}
              </button>
            ))}
            <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter themes by status"
              className="w-40 shrink-0 rounded-lg border border-slate-200/60 bg-white px-3 py-2.5 text-[12px] font-pmedium text-slate-600 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            >
              <option value="all">All status</option>
              <option value="live">Live</option>
              <option value="coming-soon">Coming soon</option>
              <option value="hidden">Not visible</option>
            </select>
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search themes or verticals..."
                className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-slate-900 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
            {orderDirty ? (
              <button
                type="button"
                disabled={reorderMutation.isPending}
                onClick={() => reorderMutation.mutate()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <Save size={15} /> {reorderMutation.isPending ? "Saving..." : "Save order"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-white hover:bg-blue-700"
            >
              <Plus size={15} /> Add theme
            </button>
          </div>
          <div className="grid grid-cols-[48px_minmax(280px,1.4fr)_minmax(130px,.55fr)_minmax(130px,.55fr)_132px] items-center border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
            <span />
            <span>Theme</span>
            <span>Vertical</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {catalogQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : orderedThemes.length === 0 ? (
            <div className="py-20 text-center">
              <ImageUp size={26} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-pmedium text-slate-600">No themes have been added yet.</p>
              <button type="button" onClick={openCreate} className="mt-3 text-xs font-pmedium text-blue-600 hover:text-blue-800">Add the first theme</button>
            </div>
          ) : filteredThemes.length === 0 ? (
            <div className="py-20 text-center">
              <Search size={25} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-pmedium text-slate-600">No themes match these filters.</p>
              <button type="button" onClick={() => { setVerticalFilter("all"); setStatusFilter("all"); setSearchQuery(""); }} className="mt-3 text-xs font-pmedium text-blue-600 hover:text-blue-800">Clear filters</button>
            </div>
          ) : filteredThemes.map((theme) => (
            <div
              key={theme._id}
              draggable
              onDragStart={() => setDraggedId(theme._id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(theme._id)}
              className={`grid grid-cols-[48px_minmax(280px,1.4fr)_minmax(130px,.55fr)_minmax(130px,.55fr)_132px] items-center border-b border-slate-100 px-4 py-3 last:border-0 ${draggedId === theme._id ? "bg-blue-50/70 opacity-60" : "hover:bg-slate-50/70"}`}
            >
              <button type="button" className="cursor-grab text-slate-300 hover:text-slate-600" aria-label={`Reorder ${theme.name}`}><GripVertical size={18} /></button>
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {theme.heroImage ? <img src={theme.heroImage} alt="" className="h-full w-full object-cover object-top" /> : <ImageUp className="absolute inset-0 m-auto text-slate-300" size={20} />}
                  {theme.featured ? <Star size={16} className="absolute right-1.5 top-1.5 fill-amber-400 text-amber-400" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-pmedium text-slate-900">{theme.name}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{theme.templateId}</p>
                </div>
              </div>
              <span className="text-xs font-pmedium text-slate-600">{titleCase(theme.vertical)}</span>
              <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-pmedium capitalize ring-1 ring-inset ${STATUS_STYLE[theme.status]}`}>
                {theme.status.replace("-", " ")}
              </span>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => openPreview(theme)} className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-blue-100 hover:text-blue-700" aria-label={`View ${theme.name}`} title={`View ${theme.name}`}><Eye size={15} /></button>
                <button type="button" onClick={() => openEdit(theme)} className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-blue-100 hover:text-blue-700" aria-label={`Edit ${theme.name}`} title={`Edit ${theme.name}`}><Pencil size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewTheme ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onMouseDown={() => setPreviewTheme(null)}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-[#f7f8fa] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-pmedium text-slate-950">{previewTheme.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-pmedium capitalize ring-1 ring-inset ${STATUS_STYLE[previewTheme.status]}`}>{previewTheme.status.replace("-", " ")}</span>
                  {previewTheme.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-pmedium text-amber-700 ring-1 ring-inset ring-amber-200"><Star size={11} className="fill-amber-500" /> Featured</span> : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{titleCase(previewTheme.vertical)} · {previewTheme.templateId}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {[{ id: "desktop", label: "Desktop", icon: Monitor }, { id: "mobile", label: "Mobile", icon: Smartphone }].map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setPreviewDevice(id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-pmedium ${previewDevice === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Icon size={13} /> {label}</button>
                  ))}
                </div>
                <button type="button" onClick={() => { const theme = previewTheme; setPreviewTheme(null); openEdit(theme); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium text-white hover:bg-blue-700"><Pencil size={14} /> Edit theme</button>
                <button type="button" onClick={() => setPreviewTheme(null)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-h-[520px] items-start justify-center overflow-auto p-6 lg:p-8">
                {previewDevice === "desktop" ? (
                  <div className="w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[0_20px_60px_rgba(15,23,42,.14)]">
                    <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-4"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-3 h-4 flex-1 rounded bg-white" /></div>
                    {previewTheme.heroImage ? <img src={previewTheme.heroImage} alt={`${previewTheme.name} desktop reference`} className="aspect-[16/10] w-full object-cover object-top" /> : <div className="flex aspect-[16/10] items-center justify-center text-sm text-slate-400">No desktop screenshot</div>}
                  </div>
                ) : (
                  <div className="w-[290px] rounded-[2.5rem] bg-slate-950 p-2.5 shadow-[0_22px_60px_rgba(15,23,42,.22)]">
                    <div
                      className="relative overflow-hidden rounded-[2rem] bg-white"
                      style={{ aspectRatio: `${previewTheme.mobileScreenshot?.width || 9} / ${previewTheme.mobileScreenshot?.height || 19.5}` }}
                    >
                      <span className="absolute left-1/2 top-0 z-10 h-4 w-16 -translate-x-1/2 rounded-b-xl bg-slate-950" />
                      {previewTheme.heroImageMobile ? <img src={previewTheme.heroImageMobile} alt={`${previewTheme.name} mobile reference`} className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No mobile screenshot</div>}
                    </div>
                  </div>
                )}
              </div>

              <aside className="border-t border-slate-200 bg-white p-6 lg:border-l lg:border-t-0">
                <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Website reference</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{previewTheme.description}</p>
                <div className="mt-6 border-y border-slate-100 py-5">
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Theme palette</p>
                  <div className="mt-3 flex gap-2">{[previewTheme.swatch?.bg, previewTheme.swatch?.fg, previewTheme.swatch?.accent].map((shade, index) => <span key={`${shade}-${index}`} className="h-8 flex-1 rounded-lg border border-black/10" style={{ backgroundColor: shade }} title={shade} />)}</div>
                </div>
                {previewTheme.status === "coming-soon" ? <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">{previewTheme.disabledReason || "Coming soon"}</div> : null}
                {themeReferenceUrl(previewTheme) ? <a href={themeReferenceUrl(previewTheme)} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-pmedium text-blue-600 hover:text-blue-800">Open live reference <ExternalLink size={13} /></a> : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={() => !saveThemeMutation.isPending && setEditor(null)}>
          <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-pmedium text-slate-900">{editor.mode === "create" ? "Add website theme" : `Edit ${editor.theme.name}`}</h2>
                <p className="mt-1 text-[11px] font-pmedium text-slate-500">Manage catalog details, publishing state, responsive captures, and appearance.</p>
              </div>
              <button type="button" disabled={saveThemeMutation.isPending} onClick={() => setEditor(null)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close editor"><X size={17} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-sm font-pmedium text-slate-900">Theme information</h3>
                    <p className="mt-1 text-[11px] text-slate-500">The name and vertical shown to customers in the Theme Store.</p>
                    <div className="mt-4 flex flex-col gap-4">
                      <label className="text-[11px] font-pmedium text-slate-600">Theme name
                        <input value={form.name} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, ...(editor.mode === "create" ? { templateId: templateIdFromName(name) } : {}) })); }} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" placeholder="Savor" />
                      </label>
                      <label className="text-[11px] font-pmedium text-slate-600">Template ID <span className="font-normal text-slate-400">(generated automatically)</span>
                        <input disabled value={form.templateId} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500" placeholder="Generated from theme name" />
                      </label>
                      <label className="text-[11px] font-pmedium text-slate-600">Vertical
                        <select value={form.vertical} onChange={(event) => setForm((current) => ({ ...current, vertical: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100">
                          <option value="" disabled>Select vertical</option>
                          {verticalOptions.filter((vertical) => vertical !== "all").map((vertical) => <option key={vertical} value={vertical}>{titleCase(vertical)}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="mt-4 block text-[11px] font-pmedium text-slate-600">Description
                      <textarea rows={4} maxLength={600} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" placeholder="Describe what makes this theme useful..." />
                      <span className="mt-1 block text-right text-[9px] text-slate-400">{form.description.length}/600</span>
                    </label>
                  </section>

                  <section className="border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-pmedium text-slate-900">Responsive screenshots</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Live themes require both captures. Mobile images keep their original proportion.</p>
                    <div className="mt-4 flex flex-col gap-4">
                      <ScreenshotInput label="Desktop screenshot" hint="Cropped to 1600 × 1000 WebP" icon={Monitor} existingUrl={editor.theme?.heroImage} file={form.desktopScreenshot} onChange={(file) => setForm((current) => ({ ...current, desktopScreenshot: file }))} />
                      <ScreenshotInput portrait label="Mobile screenshot" hint="Resized to 750 px wide without cropping" icon={Smartphone} existingUrl={editor.theme?.heroImageMobile} file={form.mobileScreenshot} onChange={(file) => setForm((current) => ({ ...current, mobileScreenshot: file }))} />
                    </div>
                  </section>
                </div>

                <div className="space-y-6 border-t border-slate-200 pt-5">
                  <section>
                    <h3 className="text-sm font-pmedium text-slate-900">Publishing</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Control how this theme appears in the public catalog.</p>
                    <label className="mt-4 block text-[11px] font-pmedium text-slate-600">Status
                      <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100">
                        <option value="live">Live</option>
                        <option value="coming-soon">Coming soon</option>
                        <option value="hidden">Not visible</option>
                      </select>
                    </label>
                    {form.status === "coming-soon" ? (
                      <label className="mt-4 block text-[11px] font-pmedium text-slate-600">Coming-soon message
                        <input value={form.disabledReason} onChange={(event) => setForm((current) => ({ ...current, disabledReason: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
                      </label>
                    ) : null}
                    <label className="mt-4 block text-[11px] font-pmedium text-slate-600">External preview URL <span className="font-normal text-slate-400">(optional)</span>
                      <input value={form.externalDemoUrl} onChange={(event) => setForm((current) => ({ ...current, externalDemoUrl: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" placeholder="https://example.wono.co" />
                    </label>
                    <label className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <span><span className="block text-xs font-pmedium text-slate-800">Featured theme</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">Show in the top device showcase.</span></span>
                      <input type="checkbox" checked={form.featured} onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))} className="h-4 w-4 accent-[#2563EB]" />
                    </label>
                  </section>

                  <section className="border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-pmedium text-slate-900">Theme palette</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Used for catalog accents and theme identification.</p>
                    <div className="mt-4 space-y-2">
                      {[["swatchBg", "Background"], ["swatchFg", "Text"], ["swatchAccent", "Accent"]].map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-pmedium text-slate-600">
                          <span>{label}</span>
                          <span className="flex items-center gap-2 text-[10px] uppercase text-slate-400"><span>{form[key]}</span><input type="color" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" /></span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" disabled={saveThemeMutation.isPending} onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saveThemeMutation.isPending} className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white shadow-sm shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">{saveThemeMutation.isPending ? "Saving..." : editor.mode === "create" ? "Add theme" : "Save changes"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </Frame>
  );
};

export default ThemeStoreCatalog;
