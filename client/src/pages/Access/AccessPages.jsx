import React, { useEffect, useMemo, useState } from "react";
import {
  LuShieldCheck,
  LuUser,
  LuSearch,
  LuUserX,
  LuUserCheck,
  LuGlobe,
  LuUsers,
  LuLayers,
  LuInfo,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../components/Pages/PageFrame";
import PrimaryButton from "../../components/PrimaryButton";
import ToggleSwitch from "../../components/ui/ToggleSwitch";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import useAuth from "../../hooks/useAuth";

const initials = (user) =>
  `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

const AccessPages = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [draftIsSuperAdmin, setDraftIsSuperAdmin] = useState(false);
  const [draftAllowedModules, setDraftAllowedModules] = useState([]);
  const [draftIsActive, setDraftIsActive] = useState(true);
  const [draftCanViewPrivateNomadListings, setDraftCanViewPrivateNomadListings] =
    useState(false);

  useEffect(() => {
    if (!auth?.user?.isSuperAdmin) {
      navigate("/unauthorized");
    }
  }, [auth, navigate]);

  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ["admin-access-users"],
    queryFn: async () => {
      const res = await axios.get("/api/admin-access/users");
      return res.data;
    },
    enabled: Boolean(auth?.user?.isSuperAdmin),
  });

  const { data: moduleCatalog = [], isLoading: isModulesLoading } = useQuery({
    queryKey: ["admin-access-modules"],
    queryFn: async () => {
      const res = await axios.get("/api/admin-access/modules");
      return res.data;
    },
    enabled: Boolean(auth?.user?.isSuperAdmin),
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  const selectedUser = users.find((u) => u._id === selectedUserId) || null;
  const isSelf = selectedUser?._id === auth?.user?._id;

  const isDirty =
    !!selectedUser &&
    (draftIsSuperAdmin !== Boolean(selectedUser.isSuperAdmin) ||
      draftIsActive !== (selectedUser.isActive ?? true) ||
      draftCanViewPrivateNomadListings !==
        Boolean(selectedUser.canViewPrivateNomadListings) ||
      JSON.stringify([...draftAllowedModules].sort()) !==
        JSON.stringify([...(selectedUser.allowedModules || [])].sort()));

  const handleSelectUser = (user) => {
    setSelectedUserId(user._id);
    setDraftIsSuperAdmin(Boolean(user.isSuperAdmin));
    setDraftAllowedModules(user.allowedModules || []);
    setDraftIsActive(user.isActive ?? true);
    setDraftCanViewPrivateNomadListings(
      Boolean(user.canViewPrivateNomadListings),
    );
  };

  const handleSuperAdminToggle = (checked) => {
    setDraftIsSuperAdmin(checked);
    // Superadmins can never be disabled, so flipping this on re-enables login.
    if (checked) setDraftIsActive(true);
  };

  const submenuTabKeys = (submenu) =>
    (submenu.tabs || []).map((tab) => `${submenu.key}.${tab.key}`);

  // The submenu's own switch is a pure on/off gate, independent of which
  // tabs are currently checked below it — turning individual tabs off must
  // never flip this off by itself. "On" means the bare key, or (from older
  // data) any leftover tab key, is present.
  const isSubmenuEnabled = (submenu) => {
    if (draftAllowedModules.includes(submenu.key)) return true;
    return submenuTabKeys(submenu).some((k) => draftAllowedModules.includes(k));
  };

  // A tab reads as checked if explicitly granted, or — for a submenu that's
  // on but has no explicit tab keys yet (either freshly enabled, or an
  // older bare-key-only grant from before tabs existed) — implicitly, since
  // "on" defaults to every tab.
  const isTabGranted = (submenu, tabKey) => {
    if (draftAllowedModules.includes(tabKey)) return true;
    const tabKeys = submenuTabKeys(submenu);
    const hasAnyExplicitTab = tabKeys.some((k) => draftAllowedModules.includes(k));
    return draftAllowedModules.includes(submenu.key) && !hasAnyExplicitTab;
  };

  // The submenu's own switch: turning it on grants every tab (so they start
  // enabled and can then be individually turned off below); turning it off
  // clears the submenu and every one of its tabs.
  const setSubmenuFullAccess = (submenu, checked) => {
    const tabKeys = submenuTabKeys(submenu);
    setDraftAllowedModules((prev) => {
      const withoutThis = prev.filter(
        (k) => k !== submenu.key && !tabKeys.includes(k),
      );
      if (!checked) return withoutThis;
      return [...withoutThis, ...(tabKeys.length ? tabKeys : [submenu.key])];
    });
  };

  // Toggling one tab keeps the submenu's own switch exactly as it is (see
  // isSubmenuEnabled above) — it only ever touches that one tab's key. If
  // every tab was only implicitly on (an older bare-key-only grant, nothing
  // explicit yet), this first expands that into explicit keys for every
  // *other* tab so the bare key still means "on", not "every tab".
  // shortcut: a user who manually unticks every tab one by one (instead of
  // using the switch) ends up back at bare-key-only, which reads as "on,
  // every tab" again — upgrade by storing an explicit sentinel if that ever
  // matters in practice.
  const toggleSubmenuTab = (submenu, tabKey, checked) => {
    setDraftAllowedModules((prev) => {
      const tabKeys = submenuTabKeys(submenu);
      const hasAnyExplicitTab = tabKeys.some((k) => prev.includes(k));
      const base =
        prev.includes(submenu.key) && !hasAnyExplicitTab
          ? [...prev, ...tabKeys]
          : prev;
      const next = new Set(base);
      if (checked) next.add(tabKey);
      else next.delete(tabKey);
      return [...next];
    });
  };

  const toggleAllInModule = (module, checked) => {
    setDraftAllowedModules((prev) => {
      let next = prev;
      module.submenus.forEach((submenu) => {
        const tabKeys = submenuTabKeys(submenu);
        const withoutThis = next.filter(
          (k) => k !== submenu.key && !tabKeys.includes(k),
        );
        next = checked
          ? [...withoutThis, ...(tabKeys.length ? tabKeys : [submenu.key])]
          : withoutThis;
      });
      return [...new Set(next)];
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.patch(
        `/api/admin-access/users/${selectedUserId}`,
        {
          isSuperAdmin: draftIsSuperAdmin,
          allowedModules: draftAllowedModules,
          isActive: draftIsActive,
          canViewPrivateNomadListings: draftCanViewPrivateNomadListings,
        },
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Access updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-access-users"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Update failed");
    },
  });

  const superAdminCount = useMemo(
    () => users.filter((u) => u.isSuperAdmin).length,
    [users],
  );
  const activeCount = useMemo(
    () => users.filter((u) => u.isActive !== false).length,
    [users],
  );
  const disabledCount = useMemo(
    () => users.filter((u) => u.isActive === false).length,
    [users],
  );

  const grantedModuleCount = moduleCatalog.filter((m) =>
    m.submenus.some((s) => isSubmenuEnabled(s)),
  ).length;

  if (!auth?.user?.isSuperAdmin) return null;

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-2">
                <LuShieldCheck size={20} className="shrink-0" />
                Master Panel User Access
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Control which sidebar modules each user can see, and who has full
                superadmin access.
              </p>
            </div>
            <PrimaryButton
              title="Add User"
              handleSubmit={() => navigate("/dashboard/add-master-user")}
              externalStyles="self-start md:self-auto"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm transition-all hover:shadow-md">
              <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">
                Total Users
              </p>
              <p className="text-[15px] font-pmedium text-slate-900">
                {users.length}
              </p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-[#2563EB] shadow-sm transition-all hover:shadow-md">
              <p className="text-[10px] font-pmedium text-[#2563EB] uppercase tracking-widest mb-1">
                Superadmins
              </p>
              <p className="text-[15px] font-pmedium text-slate-900">
                {superAdminCount}
              </p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:shadow-md">
              <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">
                Active Logins
              </p>
              <p className="text-[15px] font-pmedium text-slate-900">
                {activeCount}
              </p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-rose-500 shadow-sm transition-all hover:shadow-md">
              <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">
                Login Disabled
              </p>
              <p className="text-[15px] font-pmedium text-slate-900">
                {disabledCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
            {/* User list */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100/60 bg-slate-50/50 flex items-center justify-between gap-2">
                <span className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                  Panel Users
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-pmedium text-slate-500">
                  {filteredUsers.length}
                </span>
              </div>

              <div className="p-3 border-b border-slate-100/60">
                <div className="relative">
                  <LuSearch
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    size={15}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex flex-col max-h-[600px] overflow-y-auto hideScrollBar divide-y divide-slate-100/60">
                {isUsersLoading && (
                  <p className="text-[11px] font-pmedium text-slate-400 px-3 py-8 text-center">
                    Loading users...
                  </p>
                )}
                {!isUsersLoading && filteredUsers.length === 0 && (
                  <p className="text-[11px] font-pmedium text-slate-400 px-3 py-8 text-center">
                    No users found
                  </p>
                )}
                {filteredUsers.map((user) => {
                  const isSelected = user._id === selectedUserId;
                  const isDisabled = user.isActive === false;
                  return (
                    <button
                      type="button"
                      key={user._id}
                      onClick={() => handleSelectUser(user)}
                      className={`relative flex items-center gap-3 w-full text-left px-3 py-3 transition-colors ${
                        isSelected
                          ? "bg-blue-50/60"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute inset-y-0 left-0 w-[3px] bg-[#2563EB]" />
                      )}
                      <div
                        className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-pmedium ${
                          user.isSuperAdmin
                            ? "bg-[#2563EB] text-white"
                            : "bg-slate-100 text-slate-500"
                        } ${isDisabled ? "opacity-60" : ""}`}
                      >
                        {initials(user) || <LuUser size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[12px] font-pmedium truncate ${
                              isDisabled ? "text-slate-400" : "text-slate-800"
                            }`}
                          >
                            {user.firstName} {user.lastName}
                          </span>
                          {user.isSuperAdmin && (
                            <LuShieldCheck
                              className="text-[#2563EB] shrink-0"
                              size={13}
                            />
                          )}
                          {isDisabled && (
                            <LuUserX
                              className="text-rose-400 shrink-0"
                              size={13}
                            />
                          )}
                        </div>
                        <span className="block text-[10px] font-pmedium text-slate-400 truncate mt-0.5">
                          {user.email}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[9px] font-pmedium uppercase tracking-widest rounded-full px-2 py-0.5 border ${
                          user.isSuperAdmin
                            ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {user.isSuperAdmin
                          ? "All"
                          : `${(user.allowedModules || []).length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail / access editor */}
            <div className="min-w-0">
              {!selectedUser ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                      <LuUsers size={26} />
                    </div>
                    <div>
                      <p className="text-[13px] font-pmedium text-slate-700">
                        No user selected
                      </p>
                      <p className="text-[11px] font-pmedium text-slate-400 mt-1">
                        Pick a user from the list to review and edit their access
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Identity header */}
                  <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-[13px] font-pmedium ${
                          draftIsSuperAdmin
                            ? "bg-[#2563EB] text-white"
                            : "bg-white border border-slate-200 text-slate-600"
                        }`}
                      >
                        {initials(selectedUser) || <LuUser size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-pmedium text-slate-800 truncate">
                            {selectedUser.firstName} {selectedUser.lastName}
                          </h3>
                          {isSelf && (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-pmedium text-slate-400 truncate mt-0.5">
                          {selectedUser.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[9px] font-pmedium uppercase tracking-widest ${
                          draftIsSuperAdmin
                            ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {draftIsSuperAdmin ? "Superadmin" : "Custom access"}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[9px] font-pmedium uppercase tracking-widest ${
                          draftIsActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "border-rose-200 bg-rose-50 text-rose-600"
                        }`}
                      >
                        {draftIsActive ? "Active" : "Login disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col gap-5">
                    {/* Access controls */}
                    <div>
                      <h4 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                        Access Controls
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        <div
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                            draftIsSuperAdmin
                              ? "border-blue-200 bg-blue-50/40"
                              : "border-slate-100 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                                draftIsSuperAdmin
                                  ? "bg-[#2563EB] text-white"
                                  : "bg-slate-50 border border-slate-100 text-slate-400"
                              }`}
                            >
                              <LuShieldCheck size={16} />
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[12px] font-pmedium text-slate-800">
                                Superadmin
                              </span>
                              <span className="block text-[10px] font-pmedium text-slate-400">
                                Full access to every module and this access page
                              </span>
                              {isSelf && (
                                <span className="block text-[10px] font-pmedium text-slate-400 mt-0.5">
                                  You can't change your own superadmin status.
                                </span>
                              )}
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={draftIsSuperAdmin}
                            disabled={isSelf}
                            onChange={handleSuperAdminToggle}
                            label="Toggle superadmin"
                          />
                        </div>

                        <div
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                            draftIsActive
                              ? "border-slate-100 bg-white"
                              : "border-rose-200 bg-rose-50/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                                draftIsActive
                                  ? "bg-slate-50 border border-slate-100 text-slate-400"
                                  : "bg-rose-100 text-rose-500"
                              }`}
                            >
                              {draftIsActive ? (
                                <LuUserCheck size={16} />
                              ) : (
                                <LuUserX size={16} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[12px] font-pmedium text-slate-800">
                                Login Access
                              </span>
                              <span className="block text-[10px] font-pmedium text-slate-400">
                                {draftIsSuperAdmin
                                  ? "Superadmins can't be disabled"
                                  : draftIsActive
                                    ? "This user can log in to the Master Panel"
                                    : "This user can no longer log in"}
                              </span>
                              {isSelf && (
                                <span className="block text-[10px] font-pmedium text-slate-400 mt-0.5">
                                  You can't disable your own login access.
                                </span>
                              )}
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={draftIsActive}
                            disabled={isSelf || draftIsSuperAdmin}
                            onChange={(checked) => setDraftIsActive(checked)}
                            label="Toggle login access"
                          />
                        </div>

                        <div
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                            draftCanViewPrivateNomadListings
                              ? "border-blue-200 bg-blue-50/40"
                              : "border-slate-100 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                                draftCanViewPrivateNomadListings
                                  ? "bg-[#2563EB] text-white"
                                  : "bg-slate-50 border border-slate-100 text-slate-400"
                              }`}
                            >
                              <LuGlobe size={16} />
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[12px] font-pmedium text-slate-800">
                                Nomad Listing Access
                              </span>
                              <span className="block text-[10px] font-pmedium text-slate-400">
                                On the Nomads site, this user can see every
                                country/state and listings which are not public
                                yet.
                              </span>
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={draftCanViewPrivateNomadListings}
                            onChange={(checked) =>
                              setDraftCanViewPrivateNomadListings(checked)
                            }
                            label="Toggle private nomad listing access"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sidebar modules */}
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                        <h4 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <LuLayers size={13} className="text-slate-400" />
                          Sidebar Modules
                        </h4>
                        {!draftIsSuperAdmin && !isModulesLoading && (
                          <span className="text-[10px] font-pmedium text-slate-400">
                            {grantedModuleCount}/{moduleCatalog.length} modules
                            granted
                          </span>
                        )}
                      </div>

                      {draftIsSuperAdmin ? (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/40 px-4 py-3">
                          <LuInfo
                            size={15}
                            className="text-[#2563EB] shrink-0 mt-0.5"
                          />
                          <p className="text-[11px] font-pmedium text-slate-600">
                            Superadmins automatically see every sidebar item, so
                            individual module selection is disabled.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {isModulesLoading && (
                            <p className="text-[11px] font-pmedium text-slate-400 py-6 text-center">
                              Loading modules...
                            </p>
                          )}
                          {!isModulesLoading &&
                            moduleCatalog.map((module) => {
                              const enabledSubmenus = module.submenus.filter((s) =>
                                isSubmenuEnabled(s),
                              ).length;
                              const allChecked =
                                module.submenus.length > 0 &&
                                enabledSubmenus === module.submenus.length;
                              return (
                                <div
                                  key={module.key}
                                  className="border border-slate-100 rounded-2xl overflow-hidden bg-white"
                                >
                                  <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-4 py-2.5 border-b border-slate-100">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-600 truncate">
                                        {module.label}
                                      </span>
                                      <span
                                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-pmedium ${
                                          allChecked
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                            : enabledSubmenus > 0
                                              ? "border-amber-200 bg-amber-50 text-amber-600"
                                              : "border-slate-200 bg-white text-slate-400"
                                        }`}
                                      >
                                        {enabledSubmenus}/{module.submenus.length}
                                      </span>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                      <span className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
                                        Select all
                                      </span>
                                      <ToggleSwitch
                                        checked={allChecked}
                                        onChange={(checked) =>
                                          toggleAllInModule(module, checked)
                                        }
                                        label={`Select all ${module.label}`}
                                      />
                                    </label>
                                  </div>

                                  <div className="divide-y divide-slate-100/60">
                                    {module.submenus.map((submenu) => {
                                      const isEnabled = isSubmenuEnabled(submenu);
                                      const allTabsGranted =
                                        submenu.tabs?.length > 0 &&
                                        submenu.tabs.every((tab) =>
                                          isTabGranted(
                                            submenu,
                                            `${submenu.key}.${tab.key}`,
                                          ),
                                        );
                                      return (
                                        <div key={submenu.key}>
                                          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span
                                                className={`text-[12px] font-pmedium truncate ${
                                                  isEnabled
                                                    ? "text-slate-800"
                                                    : "text-slate-500"
                                                }`}
                                              >
                                                {submenu.label}
                                              </span>
                                              {submenu.tabs?.length > 0 &&
                                              allTabsGranted ? (
                                                <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[8px] font-pmedium uppercase tracking-widest text-emerald-600">
                                                  All tabs
                                                </span>
                                              ) : null}
                                            </div>
                                            <ToggleSwitch
                                              checked={isEnabled}
                                              onChange={(checked) =>
                                                setSubmenuFullAccess(
                                                  submenu,
                                                  checked,
                                                )
                                              }
                                              label={`Toggle ${submenu.label}`}
                                            />
                                          </div>

                                          {submenu.tabs?.length ? (
                                            <div className="bg-slate-50/50 border-t border-slate-100/60 divide-y divide-slate-100/60">
                                              {submenu.tabs.map((tab) => {
                                                const tabKey = `${submenu.key}.${tab.key}`;
                                                const tabGranted = isTabGranted(
                                                  submenu,
                                                  tabKey,
                                                );
                                                return (
                                                  <div
                                                    key={tabKey}
                                                    className="flex items-center justify-between gap-3 pl-6 pr-4 py-2"
                                                  >
                                                    <span
                                                      className={`text-[11px] font-pmedium ${
                                                        tabGranted
                                                          ? "text-slate-600"
                                                          : "text-slate-400"
                                                      }`}
                                                    >
                                                      {tab.label}
                                                    </span>
                                                    <ToggleSwitch
                                                      checked={tabGranted}
                                                      onChange={(checked) =>
                                                        toggleSubmenuTab(
                                                          submenu,
                                                          tabKey,
                                                          checked,
                                                        )
                                                      }
                                                      label={`Toggle ${tab.label}`}
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save bar */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                    <span
                      className={`text-[10px] font-pmedium uppercase tracking-widest ${
                        isDirty ? "text-amber-600" : "text-slate-400"
                      }`}
                    >
                      {isDirty ? "Unsaved changes" : "All changes saved"}
                    </span>
                    <PrimaryButton
                      title="Save Access"
                      handleSubmit={() => mutation.mutate()}
                      isLoading={mutation.isPending}
                      disabled={mutation.isPending || !isDirty}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default AccessPages;
