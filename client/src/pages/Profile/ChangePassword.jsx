import { useState } from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import PrimaryButton from "../../components/PrimaryButton";
import useAuth from "../../hooks/useAuth";
import { toast } from "sonner";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";

const ChangePassword = () => {
  const [isChanging, setIsChanging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const { auth } = useAuth();
  const axios = useAxiosPrivate();
  const userId = auth?.user?._id;
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const passwordVisibilityAdornment = (field) => (
    <InputAdornment position="end">
      <IconButton
        edge="end"
        size="small"
        onClick={() => togglePasswordVisibility(field)}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={
          visiblePasswords[field] ? "Hide password" : "Show password"
        }
        title={visiblePasswords[field] ? "Hide password" : "Show password"}
      >
        {visiblePasswords[field] ? <EyeOff size={17} /> : <Eye size={17} />}
      </IconButton>
    </InputAdornment>
  );

  const handleChange = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setErrorMessage("");
    setSuccessMessage("");
    if (field === "currentPassword") setPasswordVerified(false);
  };

  const handlePasswordCheck = async () => {
    if (!formData.currentPassword) {
      setErrorMessage("Please provide your current password.");
      return;
    }
    if (!userId) {
      setErrorMessage("User not found. Please re-login.");
      return;
    }

    try {
      setIsVerifying(true);
      const response = await axios.patch(
        `/api/admin/verify-password/${userId}`,
        { currentPassword: formData.currentPassword },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Failed to verify password.");
      }

      toast.success(response.data?.message || "Password verified.");
      setPasswordVerified(true);
      setErrorMessage("");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to verify password. Please try again.";
      toast.error(message);
      setErrorMessage(message);
      setPasswordVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordChange = async () => {
    const { currentPassword, newPassword, confirmPassword } = formData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }
    if (!passwordVerified) {
      setErrorMessage("Please verify your current password first.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])/.test(newPassword)) {
      setErrorMessage(
        "New password must include both uppercase and lowercase letters.",
      );
      return;
    }
    if (!/(?=.*\d)(?=.*[^A-Za-z0-9])/.test(newPassword)) {
      setErrorMessage(
        "New password must include at least one number and one special character.",
      );
      return;
    }
    if (!userId) {
      setErrorMessage("User not found. Please re-login.");
      return;
    }

    try {
      setIsChanging(true);
      const response = await axios.patch(
        `/api/admin/change-password/${userId}`,
        { oldPassword: currentPassword, newPassword },
      );

      toast.success(
        response.data?.message || "Password changed successfully.",
      );
      setSuccessMessage("Password changed successfully.");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setVisiblePasswords({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setPasswordVerified(false);
      setErrorMessage("");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Failed to change password. Please try again.";
      toast.error(message);
      setErrorMessage(message);
    } finally {
      setIsChanging(false);
    }
  };

  const inputStyles = (verified = false) => ({
    borderRadius: "1rem",
    backgroundColor: verified ? "#f0fdf4" : "#f8fafc",
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: verified ? "#bbf7d0" : "#e2e8f0",
    },
  });

  return (
    <div className="rounded-xl border-default border-borderGray bg-white p-4">
      <div className="flex items-center justify-between pb-4">
        <span className="text-title font-pmedium uppercase text-primary">
          Change Password
        </span>
      </div>

      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-lg font-pmedium text-slate-900">
              Update Password
            </h2>
            <p className="text-[11px] text-slate-500">
              Verify your current password before choosing a new one.
            </p>
          </div>
        </div>

        <div className="mb-5 flex w-full flex-col items-stretch gap-3 md:flex-row md:items-center">
          <TextField
            size="small"
            label="Current Password"
            type={visiblePasswords.currentPassword ? "text" : "password"}
            disabled={passwordVerified}
            sx={{ width: { xs: "100%", md: "49.3%" } }}
            value={formData.currentPassword}
            onChange={(event) =>
              handleChange("currentPassword", event.target.value)
            }
            required
            fullWidth
            InputProps={{
              endAdornment: passwordVisibilityAdornment("currentPassword"),
              sx: inputStyles(passwordVerified),
            }}
          />
          {!passwordVerified ? (
            <PrimaryButton
              title={isVerifying ? "Verifying..." : "Verify"}
              type="button"
              disabled={!formData.currentPassword || isVerifying}
              isLoading={isVerifying}
              handleSubmit={handlePasswordCheck}
              className="font-pmedium"
            />
          ) : (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-pmedium text-green-700">
              <ShieldCheck size={14} />
              Verified
            </span>
          )}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            size="small"
            label="New Password"
            type={visiblePasswords.newPassword ? "text" : "password"}
            disabled={!passwordVerified}
            value={formData.newPassword}
            onChange={(event) =>
              handleChange("newPassword", event.target.value)
            }
            fullWidth
            required
            InputProps={{
              endAdornment: passwordVisibilityAdornment("newPassword"),
              sx: inputStyles(),
            }}
          />
          <TextField
            size="small"
            label="Confirm Password"
            type={visiblePasswords.confirmPassword ? "text" : "password"}
            disabled={!passwordVerified}
            value={formData.confirmPassword}
            onChange={(event) =>
              handleChange("confirmPassword", event.target.value)
            }
            fullWidth
            required
            InputProps={{
              endAdornment: passwordVisibilityAdornment("confirmPassword"),
              sx: inputStyles(),
            }}
          />
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-pmedium text-rose-700"
          >
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-pmedium text-emerald-700"
          >
            {successMessage}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-blue-600" />
            <span className="text-xs font-pmedium uppercase tracking-wider text-slate-600">
              Password Requirements
            </span>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>Must be at least 8 characters long.</li>
            <li>Must include uppercase and lowercase letters.</li>
            <li>Must contain at least one number and one special character.</li>
          </ul>
        </div>

        <div className="flex items-center justify-center">
          <PrimaryButton
            title={isChanging ? "Updating..." : "Update Password"}
            type="button"
            handleSubmit={handlePasswordChange}
            disabled={!passwordVerified || isChanging}
            isLoading={isChanging}
            className="font-pmedium"
          />
        </div>
      </section>
    </div>
  );
};

export default ChangePassword;
