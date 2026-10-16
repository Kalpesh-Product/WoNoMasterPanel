import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, Eye, Pencil, EyeOff, X, ImageOff, Search, Plus } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import SecondaryButton from "../../../components/SecondaryButton";
import WebsiteFormField from "../../../components/WebsiteFormField";
import UploadFileInput from "../../../components/UploadFileInput";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

// Editing surface for the host.wono.co /modules page: the same categories
// (Common Modules, Extra Common Modules, Key Apps, Core Modules, Department
// Accesses, Add-ons) and modules the real site sidebar drives, with the
// content and screenshot each module shows there. Everything here proxies
// to the Nomads backend's HostModuleCategory collection — see
// D:\Nomads\backend\models\HostModuleCategory.js. Fetches with
// includeDisabled=1 (server side) so a hidden module stays visible here to
// re-enable, even though host.wono.co itself won't show it.
const PLAN_LABELS = { basic: "Basic", professional: "Professional", custom: "Custom" };
const PLAN_BADGE_CLASS = {
  basic: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  professional: "bg-blue-50 text-blue-700 border border-blue-200",
  custom: "bg-purple-50 text-purple-700 border border-purple-200",
};
const NEW_CATEGORY_VALUE = "__new__";

// Flattens a category's modules into rows for the table: each top-level
// module, immediately followed by its children (if any). `groupKey`
// identifies the sibling array a row belongs to (top-level modules, or one
// module's children) — a drag can only reorder within the same group.
const toRows = (modules = []) => {
  const rows = [];
  modules.forEach((module, moduleIndex) => {
    rows.push({
      key: module.id,
      module,
      childId: null,
      depth: 0,
      groupKey: "top",
      siblingIndex: moduleIndex,
    });
    (module.children || []).forEach((child, childIndex) => {
      rows.push({
        key: `${module.id}:${child.id}`,
        module: child,
        parentModuleId: module.id,
        childId: child.id,
        depth: 1,
        groupKey: `child:${module.id}`,
        siblingIndex: childIndex,
      });
    });
  });
  return rows;
};

const moveToIndex = (array, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return array;
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const bulletsToText = (bullets = []) => bullets.join("\n");
const textToBullets = (text = "") =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const matchesSearch = (module, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    module.label?.toLowerCase().includes(q) || module.summary?.toLowerCase().includes(q)
  );
};

const HostModulesContent = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [search, setSearch] = useState("");
  const [viewingRow, setViewingRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null); // { module, childId }
  const [editForm, setEditForm] = useState(null);
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [addCategoryChoice, setAddCategoryChoice] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newModuleLabel, setNewModuleLabel] = useState("");
  const [newModuleBullets, setNewModuleBullets] = useState("");
  const [newModuleScreenshot, setNewModuleScreenshot] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["hostModuleCatalog"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/host-modules");
      return response.data?.categories || [];
    },
  });

  const categories = data || [];
  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) || categories[0] || null;

  const rows = useMemo(() => {
    const allRows = toRows(activeCategory?.modules || []);
    if (!search.trim()) return allRows;
    return allRows.filter((row) => matchesSearch(row.module, search));
  }, [activeCategory, search]);

  const totalModules = useMemo(
    () =>
      categories.reduce(
        (sum, category) =>
          sum +
          category.modules.length +
          category.modules.reduce((childSum, m) => childSum + (m.children?.length || 0), 0),
        0,
      ),
    [categories],
  );
  const missingScreenshots = useMemo(
    () =>
      categories.reduce((sum, category) => {
        const allModules = category.modules.flatMap((m) => [m, ...(m.children || [])]);
        return sum + allModules.filter((m) => !m.image?.url).length;
      }, 0),
    [categories],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["hostModuleCatalog"] });

  const { mutate: reorderRows } = useMutation({
    mutationFn: async ({ categoryId, modules }) => {
      const response = await axiosPrivate.put(`/api/host-modules/${categoryId}`, { modules });
      return response.data;
    },
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to reorder");
    },
  });

  const handleDrop = (targetRow) => {
    if (!activeCategory || !dragKey || dragKey === targetRow.key) {
      setDragKey(null);
      return;
    }
    const draggedRow = rows.find((r) => r.key === dragKey);
    setDragKey(null);
    if (!draggedRow || draggedRow.groupKey !== targetRow.groupKey) return;

    if (draggedRow.depth === 0) {
      const nextModules = moveToIndex(
        activeCategory.modules,
        draggedRow.siblingIndex,
        targetRow.siblingIndex,
      );
      reorderRows({ categoryId: activeCategory.id, modules: nextModules });
    } else {
      const nextModules = activeCategory.modules.map((module) => {
        if (module.id !== draggedRow.parentModuleId) return module;
        return {
          ...module,
          children: moveToIndex(module.children, draggedRow.siblingIndex, targetRow.siblingIndex),
        };
      });
      reorderRows({ categoryId: activeCategory.id, modules: nextModules });
    }
  };

  const { mutate: toggleEnabled } = useMutation({
    mutationFn: async (row) => {
      const moduleId = row.depth === 0 ? row.module.id : row.parentModuleId;
      await axiosPrivate.patch(`/api/host-modules/${activeCategory.id}/modules/${moduleId}`, {
        childId: row.childId,
        enabled: row.module.enabled === false,
      });
    },
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update visibility");
    },
  });

  const openEdit = (row) => {
    setEditingRow(row);
    setEditForm({
      label: row.module.label || "",
      summary: row.module.summary || "",
      bullets: bulletsToText(row.module.bullets),
      plan: row.module.plan || "",
    });
    setScreenshotFile(null);
  };

  const closeEdit = () => {
    setEditingRow(null);
    setEditForm(null);
    setScreenshotFile(null);
  };

  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const moduleId = editingRow.depth === 0 ? editingRow.module.id : editingRow.parentModuleId;
      const childId = editingRow.childId;

      await axiosPrivate.patch(`/api/host-modules/${activeCategory.id}/modules/${moduleId}`, {
        childId,
        label: editForm.label,
        summary: editForm.summary,
        bullets: textToBullets(editForm.bullets),
        plan: editForm.plan || null,
      });

      if (screenshotFile) {
        const formData = new FormData();
        formData.append("image", screenshotFile);
        if (childId) formData.append("childId", childId);
        await axiosPrivate.post(
          `/api/host-modules/${activeCategory.id}/modules/${moduleId}/screenshot`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      }
    },
    onSuccess: () => {
      toast.success("Module updated");
      invalidate();
      closeEdit();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update module");
    },
  });

  const closeAddModule = () => {
    setIsAddModuleOpen(false);
    setAddCategoryChoice("");
    setNewCategoryLabel("");
    setNewModuleLabel("");
    setNewModuleBullets("");
    setNewModuleScreenshot(null);
  };

  const isAddModuleValid =
    newModuleLabel.trim() &&
    (addCategoryChoice === NEW_CATEGORY_VALUE ? newCategoryLabel.trim() : addCategoryChoice);

  const { mutate: submitAddModule, isPending: isAddingModule } = useMutation({
    mutationFn: async () => {
      let targetCategoryId = addCategoryChoice;
      if (addCategoryChoice === NEW_CATEGORY_VALUE) {
        const response = await axiosPrivate.post("/api/host-modules", {
          label: newCategoryLabel.trim(),
        });
        targetCategoryId = response.data?.category?.id;
      }

      const createResponse = await axiosPrivate.post(`/api/host-modules/${targetCategoryId}/modules`, {
        label: newModuleLabel.trim(),
      });
      // The new module is always appended last by the backend — grab its id
      // off the end of the returned array rather than guessing a slug.
      const createdModules = createResponse.data?.category?.modules || [];
      const moduleId = createdModules[createdModules.length - 1]?.id;

      const bullets = textToBullets(newModuleBullets);
      if (moduleId && bullets.length) {
        await axiosPrivate.patch(`/api/host-modules/${targetCategoryId}/modules/${moduleId}`, { bullets });
      }

      if (moduleId && newModuleScreenshot) {
        const formData = new FormData();
        formData.append("image", newModuleScreenshot);
        await axiosPrivate.post(
          `/api/host-modules/${targetCategoryId}/modules/${moduleId}/screenshot`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      }

      return targetCategoryId;
    },
    onSuccess: (targetCategoryId) => {
      toast.success("Module added");
      invalidate();
      setActiveCategoryId(targetCategoryId);
      closeAddModule();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add module");
    },
  });

  if (isLoading) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
            Loading host modules...
          </div>
        </PageFrame>
      </div>
    );
  }
  if (isError) {
    return <div className="p-6 text-red-500">Failed to load host modules catalog.</div>;
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">Host Modules Content</h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Copy, screenshots and ordering for the host.wono.co /modules page and sidebar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 shrink-0">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm">
              <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Categories</p>
              <p className="text-[15px] font-pmedium text-slate-900">{categories.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 shadow-sm">
              <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Modules</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalModules}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-rose-500 shadow-sm">
              <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">Missing Screenshots</p>
              <p className="text-[15px] font-pmedium text-slate-900">{missingScreenshots}</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`px-4 py-2 rounded-xl text-[12px] font-pmedium transition-all ${
                    activeCategory?.id === category.id
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 w-56 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsAddModuleOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] text-white rounded-lg text-[12px] font-pmedium hover:bg-[#1d4ed8] transition-all shrink-0"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Module
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-[700px] text-left border-collapse table-fixed">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="w-[56px] px-5 py-4 text-left whitespace-nowrap">Sr No</th>
                    <th className="px-5 py-4 text-left whitespace-nowrap">Module</th>
                    <th className="w-[150px] px-5 py-4 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-20 text-slate-400 font-pmedium">
                        No modules in this category.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.key}
                        draggable
                        onDragStart={() => setDragKey(row.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(row)}
                        onDragEnd={() => setDragKey(null)}
                        className={`hover:bg-slate-50/50 transition-colors cursor-grab ${
                          dragKey === row.key ? "opacity-40" : ""
                        } ${row.module.enabled === false ? "opacity-50" : ""}`}
                      >
                        <td className="px-5 py-4 align-top text-slate-400 font-pmedium">{index + 1}</td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2" style={{ paddingLeft: row.depth * 16 }}>
                            <GripVertical size={14} className="text-slate-300 shrink-0" />
                            <span className="block truncate font-pmedium text-[13px] text-slate-800">
                              {row.depth > 0 ? "— " : ""}
                              {row.module.label}
                            </span>
                            {row.module.enabled === false ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                Hidden
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingRow(row)}
                              title="View (how it shows on the website)"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all"
                            >
                              <Eye size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              title="Edit"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-all"
                            >
                              <Pencil size={14} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleEnabled(row)}
                              title={row.module.enabled === false ? "Enable (show on website)" : "Disable (hide from website)"}
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-all"
                            >
                              <EyeOff size={14} strokeWidth={2.5} />
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
        </div>
      </PageFrame>

      {viewingRow ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setViewingRow(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-emerald-50/30 flex items-center justify-between gap-3">
              <h2 className="text-base font-pmedium tracking-tight text-slate-800 truncate">
                {viewingRow.module.label}
              </h2>
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto bg-white">
              {viewingRow.module.plan ? (
                <span
                  className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${PLAN_BADGE_CLASS[viewingRow.module.plan] || ""}`}
                >
                  {PLAN_LABELS[viewingRow.module.plan] || viewingRow.module.plan}
                </span>
              ) : null}
              <p className="text-sm text-slate-700">{viewingRow.module.summary || "No summary yet."}</p>
              {viewingRow.module.bullets?.length ? (
                <ul className="flex flex-col gap-1.5">
                  {viewingRow.module.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                {viewingRow.module.image?.url ? (
                  <img
                    src={viewingRow.module.image.url}
                    alt={viewingRow.module.label}
                    className="w-full h-64 object-contain"
                  />
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-300">
                    <ImageOff size={28} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingRow && editForm ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={closeEdit}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <h2 className="text-base font-pmedium tracking-tight text-slate-800 truncate">
                Edit {editingRow.module.label}
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto bg-white">
              <WebsiteFormField
                label="Label"
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              />
              <WebsiteFormField
                select
                label="Plan"
                value={editForm.plan}
                onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                helperText="Leave blank to inherit the parent module's plan."
              >
                <option value="">Inherit / none</option>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="custom">Custom</option>
              </WebsiteFormField>
              <WebsiteFormField
                label="Summary"
                multiline
                minRows={3}
                value={editForm.summary}
                onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
              />
              <WebsiteFormField
                label="Bullets"
                multiline
                minRows={4}
                value={editForm.bullets}
                onChange={(e) => setEditForm((f) => ({ ...f, bullets: e.target.value }))}
                helperText="One bullet per line."
              />

              <div>
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                  Current Screenshot
                </label>
                <div className="mt-1 mb-2">
                  {editingRow.module.image?.url ? (
                    <img
                      src={editingRow.module.image.url}
                      alt={editingRow.module.label}
                      className="h-28 rounded-xl border border-slate-100 object-contain bg-slate-50"
                    />
                  ) : (
                    <p className="text-[11px] text-slate-400">No screenshot yet.</p>
                  )}
                </div>
                <UploadFileInput
                  label="Replace Screenshot"
                  value={screenshotFile}
                  onChange={setScreenshotFile}
                  allowedExtensions={["jpg", "jpeg", "png", "webp", "gif"]}
                />
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
              <SecondaryButton type="button" handleSubmit={closeEdit} title="Cancel" disabled={isSaving} />
              <PrimaryButton
                type="button"
                handleSubmit={() => saveEdit()}
                title={isSaving ? "Saving..." : "Save"}
                isLoading={isSaving}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isAddModuleOpen ? (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={closeAddModule}
        >
          <div
            className="bg-white rounded-[2rem] max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <h2 className="text-base font-pmedium tracking-tight text-slate-800">Add Module</h2>
              <button
                type="button"
                onClick={closeAddModule}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 bg-white">
              <WebsiteFormField
                select
                required
                label="Category"
                value={addCategoryChoice}
                onChange={(e) => setAddCategoryChoice(e.target.value)}
              >
                <option value="" disabled>
                  Select a category...
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>+ Add New Category</option>
              </WebsiteFormField>

              {addCategoryChoice === NEW_CATEGORY_VALUE ? (
                <WebsiteFormField
                  required
                  label="New Category Name"
                  placeholder="e.g. Integrations"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                />
              ) : null}

              <WebsiteFormField
                required
                label="Module Name"
                placeholder="e.g. Task Automation"
                value={newModuleLabel}
                onChange={(e) => setNewModuleLabel(e.target.value)}
              />
              <WebsiteFormField
                label="Bullets"
                multiline
                minRows={3}
                placeholder="One bullet per line"
                value={newModuleBullets}
                onChange={(e) => setNewModuleBullets(e.target.value)}
                helperText="Optional — one bullet per line."
              />
              <UploadFileInput
                label="Screenshot"
                value={newModuleScreenshot}
                onChange={setNewModuleScreenshot}
                allowedExtensions={["jpg", "jpeg", "png", "webp", "gif"]}
              />
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
              <SecondaryButton type="button" handleSubmit={closeAddModule} title="Cancel" disabled={isAddingModule} />
              <PrimaryButton
                type="button"
                handleSubmit={() => submitAddModule()}
                title={isAddingModule ? "Adding..." : "Add"}
                isLoading={isAddingModule}
                disabled={isAddingModule || !isAddModuleValid}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HostModulesContent;
