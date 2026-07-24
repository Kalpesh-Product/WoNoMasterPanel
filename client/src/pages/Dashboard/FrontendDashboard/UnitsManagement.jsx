import React, { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Power, RotateCcw, Trash2, X } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatLabel = (value) =>
    String(value || "-")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

const unitStatus = (unit) => {
    if (unit.isDeleted) return "Deleted";
    if (!unit.isActive) return "Disabled";
    return "Active";
};

const UnitsManagement = () => {
    const axiosPrivate = useAxiosPrivate();
    const queryClient = useQueryClient();
    const { companyId: companySlug } = useParams();
    const location = useLocation();

    const resolvedCompanyId = useMemo(() => {
        const stateCompanyId = String(location.state?.companyId || "").trim();
        if (stateCompanyId) return stateCompanyId;
        const storedCompanyId = String(sessionStorage.getItem("companyId") || "").trim();
        if (storedCompanyId) return storedCompanyId;
        return "";
    }, [location.state]);

    const resolvedCompanyName = useMemo(() => {
        const stateCompanyName = String(location.state?.companyName || "").trim();
        if (stateCompanyName) return stateCompanyName;
        const storedCompanyName = String(sessionStorage.getItem("companyName") || "").trim();
        if (storedCompanyName) return storedCompanyName;
        return String(companySlug || "").replace(/-/g, " ").trim();
    }, [companySlug, location.state]);

    const [confirmDelete, setConfirmDelete] = useState(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["host-company-units", resolvedCompanyId],
        queryFn: async () => {
            const response = await axiosPrivate.get("/api/hosts/units", {
                params: { companyId: resolvedCompanyId, companyName: resolvedCompanyName },
            });
            return response.data?.data || { units: [], accounts: [] };
        },
        enabled: Boolean(resolvedCompanyId),
    });

    const units = data?.units || [];
    const accounts = data?.accounts || [];
    const primaryAccount = accounts[0] || null;
    const recoveryQueue = units.filter((unit) => unit.isDeleted && unit.recoveryRequestedAt);

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["host-company-units", resolvedCompanyId] });

    const handleMutationError = (error, fallback) => {
        toast.error(error?.response?.data?.message || fallback);
    };

    const { mutate: toggleStatus, isPending: isTogglingStatus } = useMutation({
        mutationFn: async ({ workspaceId, isActive }) => {
            const response = await axiosPrivate.patch(`/api/hosts/units/${workspaceId}/status`, {
                isActive,
            });
            return response.data;
        },
        onSuccess: (result) => {
            toast.success(result?.message || "Unit status updated.");
            invalidate();
        },
        onError: (error) => handleMutationError(error, "Failed to update unit status."),
    });

    const { mutate: deleteUnitMutation, isPending: isDeleting } = useMutation({
        mutationFn: async (workspaceId) => {
            const response = await axiosPrivate.delete(`/api/hosts/units/${workspaceId}`);
            return response.data;
        },
        onSuccess: (result) => {
            toast.success(result?.message || "Unit deleted.");
            setConfirmDelete(null);
            invalidate();
        },
        onError: (error) => handleMutationError(error, "Failed to delete unit."),
    });

    const { mutate: recoverUnitMutation, isPending: isRecovering } = useMutation({
        mutationFn: async (workspaceId) => {
            const response = await axiosPrivate.post(`/api/hosts/units/${workspaceId}/recover`);
            return response.data;
        },
        onSuccess: (result) => {
            toast.success(result?.message || "Unit recovered.");
            invalidate();
        },
        onError: (error) => handleMutationError(error, "Failed to recover unit."),
    });

    if (isLoading) {
        return (
            <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
                <PageFrame>
                    <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
                        Loading units...
                    </div>
                </PageFrame>
            </div>
        );
    }
    if (isError) {
        return <div className="p-6 text-red-500">Failed to load units.</div>;
    }

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">
                    <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
                        <div>
                            <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                                {resolvedCompanyName || companySlug || "Host Company"} — Units
                            </h2>
                            <p className="text-xs font-pmedium text-slate-500 mt-1">
                                Enable, disable, delete, or recover this founder's workspaces (units).
                            </p>
                        </div>
                    </div>

                    {primaryAccount ? (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-1 shrink-0">
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">
                                        Plan
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">
                                        {formatLabel(primaryAccount.accountPlan)}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">
                                        Kept
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">
                                        {primaryAccount.keptCount ?? 0}
                                        {primaryAccount.workspaceLimit ? ` / ${primaryAccount.workspaceLimit}` : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">
                                        Active
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">
                                        {primaryAccount.activeCount ?? 0}
                                        {primaryAccount.activeWorkspaceLimit
                                            ? ` / ${primaryAccount.activeWorkspaceLimit}`
                                            : ""}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-amber-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">
                                        Disabled
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">
                                        {primaryAccount.disabledCount ?? 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-rose-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">
                                        Deleted
                                    </p>
                                    <p className="text-[15px] font-pmedium text-slate-900">
                                        {primaryAccount.deletedCount ?? 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {recoveryQueue.length ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-[11px] font-pmedium text-amber-800 uppercase tracking-widest mb-2">
                                Pending recovery requests ({recoveryQueue.length})
                            </p>
                            <ul className="space-y-1.5">
                                {recoveryQueue.map((unit) => (
                                    <li
                                        key={unit.id}
                                        className="text-[12px] text-amber-900 flex items-center justify-between gap-3"
                                    >
                                        <span className="truncate">
                                            {unit.workspaceName} — requested {formatDateTime(unit.recoveryRequestedAt)}
                                        </span>
                                        <button
                                            type="button"
                                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-pmedium uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 transition-all"
                                            onClick={() => recoverUnitMutation(unit.id)}
                                            disabled={isRecovering}
                                        >
                                            <RotateCcw size={12} />
                                            Recover
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                                    <tr>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                                            Unit
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                                            Business Name
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                                            Plan
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">
                                            Status
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                                            Recovery Requested
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">
                                            Created
                                        </th>
                                        <th className="px-5 py-4 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {units.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">
                                                No units found for this company.
                                            </td>
                                        </tr>
                                    ) : (
                                        units.map((unit) => {
                                            return (
                                                <tr
                                                    key={unit.id}
                                                    className="hover:bg-slate-50/50 transition-colors group"
                                                >
                                                    <td className="px-5 py-4 align-top">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-pmedium text-[13px] text-slate-900">
                                                                {unit.workspaceName || "-"}
                                                            </span>
                                                            {unit.isMain ? (
                                                                <span className={statusPillClass("Active")}>Main</span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                                                        {unit.businessName || "-"}
                                                    </td>
                                                    <td className="px-5 py-4 align-top">
                                                        <span className={statusPillClass(formatLabel(unit.selectedPlan))}>
                                                            {formatLabel(unit.selectedPlan)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 align-top text-center">
                                                        <span className={statusPillClass(unitStatus(unit))}>
                                                            {unitStatus(unit)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                                                        {formatDateTime(unit.recoveryRequestedAt)}
                                                    </td>
                                                    <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                                                        {formatDateTime(unit.createdAt)}
                                                    </td>
                                                    <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {unit.canEnable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleStatus({ workspaceId: unit.id, isActive: true })
                                                                    }
                                                                    disabled={isTogglingStatus}
                                                                    title="Enable unit"
                                                                    className="p-1.5 bg-rose-100 text-rose-700 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                                                >
                                                                    <Power size={15} strokeWidth={2.5} />
                                                                </button>
                                                            ) : null}
                                                            {unit.canDisable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        toggleStatus({ workspaceId: unit.id, isActive: false })
                                                                    }
                                                                    disabled={isTogglingStatus}
                                                                    title="Disable unit"
                                                                    className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                                                >
                                                                    <Power size={15} strokeWidth={2.5} />
                                                                </button>
                                                            ) : null}
                                                            {unit.canDelete ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setConfirmDelete(unit)}
                                                                    title="Delete unit"
                                                                    className="p-1.5 bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                                                >
                                                                    <Trash2 size={15} strokeWidth={2.5} />
                                                                </button>
                                                            ) : null}
                                                            {unit.canRecover ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => recoverUnitMutation(unit.id)}
                                                                    disabled={isRecovering}
                                                                    title="Recover unit"
                                                                    className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                                                >
                                                                    <RotateCcw size={15} strokeWidth={2.5} />
                                                                </button>
                                                            ) : null}
                                                            {!unit.canEnable &&
                                                            !unit.canDisable &&
                                                            !unit.canDelete &&
                                                            !unit.canRecover ? (
                                                                <span className="text-slate-300">-</span>
                                                            ) : null}
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
                </div>
            </PageFrame>

            {confirmDelete ? (
                <div
                    className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
                    onClick={() => setConfirmDelete(null)}
                >
                    <div
                        className="bg-white rounded-[2rem] max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-5 sm:p-6 border-b border-slate-100 bg-rose-50/40 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                                    Delete unit
                                </h2>
                                <p className="text-xs font-pmedium text-slate-500 mt-1 truncate">
                                    {confirmDelete.workspaceName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 sm:p-6 space-y-5 bg-white">
                            <p className="text-[12px] font-pmedium text-slate-600">
                                This soft-deletes <strong>{confirmDelete.workspaceName}</strong>. It stays
                                recoverable from this page until staff or the founder restores it.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    className="px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                                    onClick={() => setConfirmDelete(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider rounded-2xl bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all"
                                    disabled={isDeleting}
                                    onClick={() => deleteUnitMutation(confirmDelete.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default UnitsManagement;
