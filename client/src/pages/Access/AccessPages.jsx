import React, { useEffect, useMemo, useState } from "react";
import { Switch } from "@mui/material";
import { LuShieldCheck, LuUser, LuSearch, LuUserX, LuUserCheck, LuGlobe } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../components/Pages/PageFrame";
import PrimaryButton from "../../components/PrimaryButton";
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

  if (!auth?.user?.isSuperAdmin) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-title font-pmedium text-primary uppercase">
            Master Panel User Access
          </span>
          <p className="text-content font-pregular text-gray-500 mt-1">
            Control which sidebar modules each user can see, and who has full
            superadmin access.
          </p>
        </div>
        <PrimaryButton
          title="+ Add User"
          handleSubmit={() => navigate("/dashboard/add-master-user")}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* User list */}
        <PageFrame>
          <div className="w-full lg:w-80 flex flex-col gap-3">
            <div className="flex items-center gap-2 border border-borderGray rounded-lg px-3 py-2">
              <LuSearch className="text-gray-400 shrink-0" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-content font-pregular outline-none bg-transparent"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-[560px] overflow-y-auto hideScrollBar">
              {isUsersLoading && (
                <p className="text-content text-gray-400 px-2 py-4 text-center">
                  Loading users...
                </p>
              )}
              {!isUsersLoading && filteredUsers.length === 0 && (
                <p className="text-content text-gray-400 px-2 py-4 text-center">
                  No users found
                </p>
              )}
              {filteredUsers.map((user) => {
                const isSelected = user._id === selectedUserId;
                return (
                  <button
                    type="button"
                    key={user._id}
                    onClick={() => handleSelectUser(user)}
                    className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-gray-50"
                    } ${user.isActive === false ? "opacity-50" : ""}`}
                  >
                    <div
                      className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-pmedium ${
                        user.isSuperAdmin
                          ? "bg-primary text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {initials(user) || <LuUser size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-content font-pmedium truncate">
                          {user.firstName} {user.lastName}
                        </span>
                        {user.isSuperAdmin && (
                          <LuShieldCheck
                            className="text-primary shrink-0"
                            size={14}
                            title="Superadmin"
                          />
                        )}
                        {user.isActive === false && (
                          <LuUserX
                            className="text-red-400 shrink-0"
                            size={14}
                            title="Login disabled"
                          />
                        )}
                      </div>
                      <span className="block text-[11px] font-pregular text-gray-500 truncate">
                        {user.email}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] font-pmedium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 uppercase">
                      {user.isSuperAdmin
                        ? "All"
                        : `${(user.allowedModules || []).length}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </PageFrame>

        {/* Detail / access editor */}
        <div className="flex-1 w-full">
          {!selectedUser ? (
            <PageFrame>
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <LuUser size={28} />
                <p className="text-content font-pregular">
                  Select a user from the list to manage their access
                </p>
              </div>
            </PageFrame>
          ) : (
            <PageFrame>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-subtitle font-pmedium text-primary">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </span>
                    <span className="block text-content font-pregular text-gray-500">
                      {selectedUser.email}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                    draftIsSuperAdmin
                      ? "border-primary bg-primary/5"
                      : "border-borderGray"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuShieldCheck
                      className={
                        draftIsSuperAdmin ? "text-primary" : "text-gray-400"
                      }
                      size={20}
                    />
                    <div>
                      <span className="block text-content font-pmedium">
                        Superadmin
                      </span>
                      <span className="block text-[11px] font-pregular text-gray-500">
                        Full access to every module and this access-control
                        page
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={draftIsSuperAdmin}
                    disabled={isSelf}
                    onChange={(e) => handleSuperAdminToggle(e.target.checked)}
                  />
                </div>
                {isSelf && (
                  <p className="text-[11px] font-pregular text-gray-400 -mt-2">
                    You can't change your own superadmin status.
                  </p>
                )}

                <div
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                    draftIsActive
                      ? "border-borderGray"
                      : "border-red-300 bg-red-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {draftIsActive ? (
                      <LuUserCheck className="text-gray-400" size={20} />
                    ) : (
                      <LuUserX className="text-red-500" size={20} />
                    )}
                    <div>
                      <span className="block text-content font-pmedium">
                        Login Access
                      </span>
                      <span className="block text-[11px] font-pregular text-gray-500">
                        {draftIsSuperAdmin
                          ? "Superadmins can't be disabled"
                          : draftIsActive
                            ? "This user can log in to the Master Panel"
                            : "This user can no longer log in"}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={draftIsActive}
                    disabled={isSelf || draftIsSuperAdmin}
                    onChange={(e) => setDraftIsActive(e.target.checked)}
                  />
                </div>
                {isSelf && (
                  <p className="text-[11px] font-pregular text-gray-400 -mt-2">
                    You can't disable your own login access.
                  </p>
                )}

                <div
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                    draftCanViewPrivateNomadListings
                      ? "border-primary bg-primary/5"
                      : "border-borderGray"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuGlobe
                      className={
                        draftCanViewPrivateNomadListings
                          ? "text-primary"
                          : "text-gray-400"
                      }
                      size={20}
                    />
                    <div>
                      <span className="block text-content font-pmedium">
                        Nomad Listing Access
                      </span>
                      <span className="block text-[11px] font-pregular text-gray-500">
                        On the Nomads site, this user can see every
                        country/state and listings which are not public yet.
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={draftCanViewPrivateNomadListings}
                    onChange={(e) =>
                      setDraftCanViewPrivateNomadListings(e.target.checked)
                    }
                  />
                </div>

                <div>
                  <span className="text-content font-pmedium text-gray-700">
                    Sidebar modules
                  </span>
                  {draftIsSuperAdmin ? (
                    <p className="text-content font-pregular text-gray-500 mt-2">
                      Superadmins automatically see every sidebar item, so
                      individual module selection is disabled.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3 mt-3">
                      {!isModulesLoading &&
                        moduleCatalog.map((module) => {
                          const allChecked = module.submenus.every((s) =>
                            isSubmenuEnabled(s),
                          );
                          return (
                            <div
                              key={module.key}
                              className="border border-borderGray rounded-lg overflow-hidden"
                            >
                              <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                                <span className="text-content font-pmedium uppercase text-gray-600">
                                  {module.label}
                                </span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <span className="text-[11px] font-pregular text-gray-500">
                                    Select all
                                  </span>
                                  <Switch
                                    size="small"
                                    checked={allChecked}
                                    onChange={(e) =>
                                      toggleAllInModule(
                                        module,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {module.submenus.map((submenu) => {
                                  const isEnabled = isSubmenuEnabled(submenu);
                                  const allTabsGranted =
                                    submenu.tabs?.length > 0 &&
                                    submenu.tabs.every((tab) =>
                                      isTabGranted(submenu, `${submenu.key}.${tab.key}`),
                                    );
                                  return (
                                    <div key={submenu.key}>
                                      <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-content font-pregular">
                                          {submenu.label}
                                          {submenu.tabs?.length && allTabsGranted ? (
                                            <span className="ml-1.5 text-[10px] font-pregular text-gray-400">
                                              (all tabs)
                                            </span>
                                          ) : null}
                                        </span>
                                        <Switch
                                          checked={isEnabled}
                                          onChange={(e) =>
                                            setSubmenuFullAccess(
                                              submenu,
                                              e.target.checked,
                                            )
                                          }
                                        />
                                      </div>
                                      {submenu.tabs?.length ? (
                                        <div className="divide-y divide-gray-50 bg-gray-50/60">
                                          {submenu.tabs.map((tab) => {
                                            const tabKey = `${submenu.key}.${tab.key}`;
                                            return (
                                              <div
                                                key={tabKey}
                                                className="flex items-center justify-between pl-8 pr-4 py-2"
                                              >
                                                <span className="text-[11px] font-pregular text-gray-600">
                                                  {tab.label}
                                                </span>
                                                <Switch
                                                  size="small"
                                                  checked={isTabGranted(submenu, tabKey)}
                                                  onChange={(e) =>
                                                    toggleSubmenuTab(
                                                      submenu,
                                                      tabKey,
                                                      e.target.checked,
                                                    )
                                                  }
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

                <div className="flex w-full justify-end items-center pt-2 border-t border-borderGray">
                  <PrimaryButton
                    title="Save Access"
                    handleSubmit={() => mutation.mutate()}
                    isLoading={mutation.isPending}
                    disabled={mutation.isPending || !isDirty}
                    externalStyles="mt-4"
                  />
                </div>
              </div>
            </PageFrame>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessPages;
