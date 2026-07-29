import React, { useEffect, useMemo, useState } from "react";
import { Switch } from "@mui/material";
import { LuShieldCheck, LuUser, LuSearch, LuUserX, LuUserCheck } from "react-icons/lu";
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
      JSON.stringify([...draftAllowedModules].sort()) !==
        JSON.stringify([...(selectedUser.allowedModules || [])].sort()));

  const handleSelectUser = (user) => {
    setSelectedUserId(user._id);
    setDraftIsSuperAdmin(Boolean(user.isSuperAdmin));
    setDraftAllowedModules(user.allowedModules || []);
    setDraftIsActive(user.isActive ?? true);
  };

  const handleSuperAdminToggle = (checked) => {
    setDraftIsSuperAdmin(checked);
    // Superadmins can never be disabled, so flipping this on re-enables login.
    if (checked) setDraftIsActive(true);
  };

  const toggleModuleKey = (key) => {
    setDraftAllowedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleAllInModule = (module, checked) => {
    const keys = module.submenus.map((s) => s.key);
    setDraftAllowedModules((prev) =>
      checked
        ? [...new Set([...prev, ...keys])]
        : prev.filter((k) => !keys.includes(k)),
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await axios.patch(
        `/api/admin-access/users/${selectedUserId}`,
        {
          isSuperAdmin: draftIsSuperAdmin,
          allowedModules: draftAllowedModules,
          isActive: draftIsActive,
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
                          const keys = module.submenus.map((s) => s.key);
                          const allChecked = keys.every((k) =>
                            draftAllowedModules.includes(k),
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
                                {module.submenus.map((submenu) => (
                                  <div
                                    key={submenu.key}
                                    className="flex items-center justify-between px-4 py-2.5"
                                  >
                                    <span className="text-content font-pregular">
                                      {submenu.label}
                                    </span>
                                    <Switch
                                      checked={draftAllowedModules.includes(
                                        submenu.key,
                                      )}
                                      onChange={() =>
                                        toggleModuleKey(submenu.key)
                                      }
                                    />
                                  </div>
                                ))}
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
