import React, { useEffect, useState } from "react";
import {
  LuShieldCheck,
  LuUserPlus,
  LuUser,
  LuMail,
  LuLock,
  LuEye,
  LuEyeOff,
  LuInfo,
  LuCheck,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../components/Pages/PageFrame";
import PrimaryButton from "../../components/PrimaryButton";
import ToggleSwitch from "../../components/ui/ToggleSwitch";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import useAuth from "../../hooks/useAuth";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const FieldLabel = ({ icon: Icon, children }) => (
  <label className="flex items-center gap-1.5 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
    <Icon size={12} className="text-slate-400" />
    {children}
  </label>
);

const inputClass =
  "mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-200/60 rounded-xl text-[13px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400";

const PasswordField = ({ label, value, onChange, placeholder, error }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col">
      <FieldLabel icon={LuLock}>{label}</FieldLabel>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} pr-10 ${
            error
              ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-400/20"
              : ""
          }`}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <LuEyeOff size={15} /> : <LuEye size={15} />}
        </button>
      </div>
      {error && <span className="mt-1 text-[10px] font-pmedium text-red-500">{error}</span>}
    </div>
  );
};

const AddMasterUser = () => {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();

  const isSuperAdmin = Boolean(auth?.user?.isSuperAdmin);
  const hasAccess =
    isSuperAdmin ||
    (auth?.user?.allowedModules || []).includes("dashboard.add-master-user");

  const [form, setForm] = useState(emptyForm);
  const [grantSuperAdmin, setGrantSuperAdmin] = useState(false);

  useEffect(() => {
    if (auth?.user && !hasAccess) {
      navigate("/unauthorized");
    }
  }, [auth, hasAccess, navigate]);

  const updateField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { confirmPassword, ...payload } = form;
      const res = await axios.post("/api/admin-access/users", {
        ...payload,
        isSuperAdmin: grantSuperAdmin,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-access-users"] });
      setForm(emptyForm);
      setGrantSuperAdmin(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });

  const passwordsMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const isValid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    form.confirmPassword.trim() &&
    !passwordsMismatch;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isValid) mutation.mutate();
  };

  const initials =
    `${form.firstName[0] || ""}${form.lastName[0] || ""}`.toUpperCase() || "?";
  const fullName =
    `${form.firstName} ${form.lastName}`.trim() || "New User";

  if (!hasAccess) return null;

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-2">
              <LuUserPlus size={20} className="shrink-0" />
              Add Master User
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Create a new Master Panel login. Sidebar module access can be set
              afterwards from User Access.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit}>
                  <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-blue-50/30 flex items-center gap-2">
                    <LuUserPlus size={15} className="text-[#2563EB]" />
                    <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-600">
                      Personal Details
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <FieldLabel icon={LuUser}>First Name</FieldLabel>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={updateField("firstName")}
                          placeholder="Jane"
                          className={inputClass}
                          required
                        />
                      </div>
                      <div className="flex flex-col">
                        <FieldLabel icon={LuUser}>Last Name</FieldLabel>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={updateField("lastName")}
                          placeholder="Doe"
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <FieldLabel icon={LuMail}>Email</FieldLabel>
                      <input
                        type="email"
                        value={form.email}
                        onChange={updateField("email")}
                        placeholder="jane.doe@wono.com"
                        className={inputClass}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <PasswordField
                        label="Password"
                        value={form.password}
                        onChange={updateField("password")}
                        placeholder="Set a login password"
                      />
                      <PasswordField
                        label="Confirm Password"
                        value={form.confirmPassword}
                        onChange={updateField("confirmPassword")}
                        placeholder="Re-enter the password"
                        error={
                          passwordsMismatch ? "Passwords don't match" : ""
                        }
                      />
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 py-4 border-y border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <LuShieldCheck size={15} className="text-[#2563EB]" />
                    <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-600">
                      Access Level
                    </span>
                  </div>

                  <div className="p-4 sm:p-5">
                    {isSuperAdmin ? (
                      <div
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                          grantSuperAdmin
                            ? "border-blue-200 bg-blue-50/40"
                            : "border-slate-100 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                              grantSuperAdmin
                                ? "bg-[#2563EB] text-white"
                                : "bg-slate-50 border border-slate-100 text-slate-400"
                            }`}
                          >
                            <LuShieldCheck size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[12px] font-pmedium text-slate-800">
                              Grant superadmin access
                            </span>
                            <span className="block text-[10px] font-pmedium text-slate-400">
                              Full access to every module, right away
                            </span>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={grantSuperAdmin}
                          onChange={setGrantSuperAdmin}
                          label="Toggle superadmin access"
                        />
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <LuInfo size={15} className="text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-pmedium text-slate-500">
                          This user will be created with no sidebar access. A
                          superadmin can grant access from the User Access page.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-pmedium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <PrimaryButton
                      title="Create User"
                      type="submit"
                      isLoading={mutation.isPending}
                      disabled={mutation.isPending || !isValid}
                    />
                  </div>
                </form>
              </div>
            </div>

            {/* Preview / info panel */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    Preview
                  </span>
                </div>
                <div className="flex flex-col items-center gap-3 px-4 py-6">
                  <div
                    className={`h-16 w-16 rounded-full flex items-center justify-center text-[17px] font-pmedium ${
                      grantSuperAdmin
                        ? "bg-[#2563EB] text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="text-center">
                    <span className="block text-[13px] font-pmedium text-slate-800">
                      {fullName}
                    </span>
                    <span className="block text-[11px] font-pmedium text-slate-400 mt-0.5">
                      {form.email || "email@wono.com"}
                    </span>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[9px] font-pmedium uppercase tracking-widest ${
                      grantSuperAdmin
                        ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {grantSuperAdmin ? "Superadmin" : "No access yet"}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    What happens next
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 px-4 py-4">
                  {[
                    "New users can log in immediately with the password set here.",
                    "Unless made superadmin, they won't see any sidebar module until access is granted from the User Access page.",
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                        <LuCheck size={10} />
                      </span>
                      <p className="text-[11px] font-pmedium text-slate-500">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default AddMasterUser;
