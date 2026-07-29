import React, { useEffect, useState } from "react";
import { Switch } from "@mui/material";
import {
  LuShieldCheck,
  LuUserPlus,
  LuUser,
  LuMail,
  LuLock,
  LuInfo,
  LuEye,
  LuEyeOff,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../components/Pages/PageFrame";
import PrimaryButton from "../../components/PrimaryButton";
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
  <label className="flex items-center gap-1.5 text-[12px] font-pmedium text-gray-600">
    <Icon size={13} className="text-gray-400" />
    {children}
  </label>
);

const inputClass =
  "border border-borderGray rounded-lg px-3 py-2.5 text-content outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";

const PasswordField = ({ label, value, onChange, placeholder, error }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={LuLock}>{label}</FieldLabel>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} w-full pr-10 ${
            error ? "border-red-400 focus:border-red-400 focus:ring-red-400" : ""
          }`}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {visible ? <LuEyeOff size={16} /> : <LuEye size={16} />}
        </button>
      </div>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
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
    `${form.firstName[0] || ""}${form.lastName[0] || ""}`.toUpperCase() ||
    "?";
  const fullName =
    `${form.firstName} ${form.lastName}`.trim() || "New User";

  if (!hasAccess) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <span className="text-title font-pmedium text-primary uppercase">
          Add Master User
        </span>
        <p className="text-content font-pregular text-gray-500 mt-1">
          Create a new Master Panel login. Sidebar module access can be set
          afterwards from User Access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Form */}
        <div className="lg:col-span-2">
          <PageFrame>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex items-center gap-2 text-primary">
                <LuUserPlus size={18} />
                <span className="text-content font-pmedium uppercase tracking-wide">
                  Personal Details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-1.5">
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

              <div className="flex flex-col gap-1.5">
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
                  error={passwordsMismatch ? "Passwords don't match" : ""}
                />
              </div>

              <div className="h-px bg-gray-100" />

              <div className="flex items-center gap-2 text-primary">
                <LuShieldCheck size={18} />
                <span className="text-content font-pmedium uppercase tracking-wide">
                  Access Level
                </span>
              </div>

              {isSuperAdmin ? (
                <div
                  className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                    grantSuperAdmin
                      ? "border-primary bg-primary/5"
                      : "border-borderGray"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <LuShieldCheck
                      className={
                        grantSuperAdmin ? "text-primary" : "text-gray-400"
                      }
                      size={20}
                    />
                    <div>
                      <span className="block text-content font-pmedium">
                        Grant superadmin access
                      </span>
                      <span className="block text-[11px] font-pregular text-gray-500">
                        Full access to every module, right away
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={grantSuperAdmin}
                    onChange={(e) => setGrantSuperAdmin(e.target.checked)}
                  />
                </div>
              ) : (
                <p className="text-content font-pregular text-gray-500">
                  This user will be created with no sidebar access. A
                  superadmin can grant access from the User Access page.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-borderGray">
                <PrimaryButton
                  title="Cancel"
                  type="button"
                  handleSubmit={() => navigate(-1)}
                  externalStyles="mt-4 !bg-white !border-borderGray !text-gray-600 !shadow-none"
                />
                <PrimaryButton
                  title="Create User"
                  type="submit"
                  isLoading={mutation.isPending}
                  disabled={mutation.isPending || !isValid}
                  externalStyles="mt-4"
                />
              </div>
            </form>
          </PageFrame>
        </div>

        {/* Preview / info panel */}
        <div className="flex flex-col gap-4">
          <PageFrame>
            <div className="flex flex-col items-center gap-3 py-2">
              <div
                className={`h-16 w-16 rounded-full flex items-center justify-center text-lg font-pmedium ${
                  grantSuperAdmin
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {initials}
              </div>
              <div className="text-center">
                <span className="block text-content font-pmedium">
                  {fullName}
                </span>
                <span className="block text-[12px] font-pregular text-gray-500">
                  {form.email || "email@wono.com"}
                </span>
              </div>
              <span
                className={`text-[10px] font-pmedium uppercase rounded-full px-2.5 py-1 ${
                  grantSuperAdmin
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {grantSuperAdmin ? "Superadmin" : "No access yet"}
              </span>
            </div>
          </PageFrame>

          <PageFrame>
            <div className="flex gap-2.5">
              <LuInfo className="text-gray-400 shrink-0 mt-0.5" size={16} />
              <div className="flex flex-col gap-2 text-[12px] font-pregular text-gray-500">
                <p>New users can log in immediately with the password set here.</p>
                <p>
                  Unless made superadmin, they won't see any sidebar module
                  until access is granted from the User Access page.
                </p>
              </div>
            </div>
          </PageFrame>
        </div>
      </div>
    </div>
  );
};

export default AddMasterUser;
