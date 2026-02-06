import React, { useState } from "react";
import TextField from "@mui/material/TextField"; // Assuming you're using Material-UI for TextField
import PrimaryButton from "../../components/PrimaryButton";
import useAuth from "../../hooks/useAuth";
import { toast } from "sonner";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import PageFrame from "../../components/Pages/PageFrame";

const ChangePassword = ({ pageTitle }) => {
  const [isChanging, setIsChanging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
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

  const handleChange = (field, value) => {
    setFormData((prevData) => ({
      ...prevData,
      [field]: value,
    }));
    setErrorMessage(""); // Clear errors on input change
    setSuccessMessage(""); // Clear success message on input change
    if (field === "currentPassword") {
      setPasswordVerified(false);
    }
  };

  const handlePasswordCheck = async () => {
    try {
      setIsVerifying(true);
      if (!formData.currentPassword) {
        setErrorMessage("Please provide your current password");
        return;
      }
      if (!userId) {
        setErrorMessage("User not found. Please re-login.");
        return;
      }
      const response = await axios.patch(
        `/api/admin/verify-password/${userId}`,
        {
          currentPassword: formData.currentPassword,
        },
      );
      if (response.data?.success) {
        toast.success(response.data.message);
        setPasswordVerified(true);
      } else {
        const message = response.data?.message || "Failed to verify password.";
        toast.error(message);
        setErrorMessage(message);
        setPasswordVerified(false);
      }
      setErrorMessage("");
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Failed to verify password. Please try again.";
      toast.error(message);
      setErrorMessage(message);
      setPasswordVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setIsChanging(true);
      const { currentPassword, newPassword, confirmPassword } = formData;

      // Validate inputs
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
      if (!userId) {
        setErrorMessage("User not found. Please re-login.");
        return;
      }

      // Simulate password change success
      await axios.patch(`/api/admin/change-password/${userId}`, {
        oldPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      setSuccessMessage("Password changed successfully!");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
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

  return (
    <div>
      <PageFrame>
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <span className="text-title font-pmedium text-primary uppercase">
            Change password
          </span>
        </div>

        <div>
          {/* Current Password Field */}
          <div className="mb-4 w-full flex flex-col md:flex-row md:justify-start items-start md:items-center gap-2 md:gap-4">
            <TextField
              size="small"
              label="Current Password"
              type="password"
              disabled={passwordVerified}
              sx={{
                width: {
                  xs: "100%",
                  sm: "100%",
                  md: "49.3%",
                },
              }}
              value={formData.currentPassword}
              onChange={(e) => handleChange("currentPassword", e.target.value)}
              required
              fullWidth
            />
            {!passwordVerified && (
              <PrimaryButton
                title="Verify"
                type="button"
                disabled={!formData.currentPassword || isVerifying}
                isLoading={isVerifying}
                handleSubmit={handlePasswordCheck}
              />
            )}
          </div>

          {/* New Password and Confirm Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              size="small"
              label="New Password"
              disabled={!passwordVerified}
              type="password"
              value={formData.newPassword}
              onChange={(e) => handleChange("newPassword", e.target.value)}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="Confirm Password"
              type="password"
              disabled={!passwordVerified}
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              fullWidth
              required
            />
          </div>

          {/* Error and Success Messages */}
          <div className="mt-4">
            {errorMessage && <p className="text-red-500">{errorMessage}</p>}
            {successMessage && (
              <p className="text-green-500">{successMessage}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 text-gray-500">
            <span className="text-subtitle">Password Requirements</span>
            <ul className="text-content list-disc pl-5">
              <li>Must be at least 8 characters long.</li>
              <li>Should include both uppercase and lowercase letters.</li>
              <li>Must contain at least one number or special character.</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="mt-4 flex justify-center items-center">
            <PrimaryButton
              title={"Submit"}
              handleSubmit={handlePasswordChange}
              disabled={!passwordVerified || isChanging}
              isLoading={isChanging}
            >
              Change Password
            </PrimaryButton>
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default ChangePassword;
