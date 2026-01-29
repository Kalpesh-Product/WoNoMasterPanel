import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { TextField, Avatar, Chip, CircularProgress } from "@mui/material";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import useAuth from "../../hooks/useAuth";
import { toast } from "sonner";
import PageFrame from "../../components/Pages/PageFrame";
import PrimaryButton from "../../components/PrimaryButton";
import SecondaryButton from "../../components/SecondaryButton";
import {
  isAlphanumeric,
  isValidEmail,
  noOnlyWhitespace,
} from "../../utils/validators";

const UserDetails = () => {
  const axios = useAxiosPrivate();
  const { auth, setAuth } = useAuth();
  const user = auth?.user;
  const userId = user?._id;
  const [editMode, setEditMode] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: {},
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: async (updatedData) => {
      return axios.patch(`/api/admin/update-profile/${userId}`, updatedData);
    },
    onSuccess: (res) => {
      toast.success(res.data.message || "Profile updated successfully!");
      setAuth((prev) => ({
        ...prev,
        user: { ...prev.user, ...res.data.user },
      }));
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update profile");
    },
  });

  // ✅ Guard submit so it only saves when in edit mode
  const onSubmit = (data, event) => {
    if (!editMode) {
      event?.preventDefault();
      return;
    }
    const { firstName, lastName } = data;
    mutation.mutate({ firstName, lastName });
  };

  if (!user)
    return (
      <div className="h-72 flex items-center justify-center">
        <CircularProgress />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <span className="text-title font-pmedium text-primary uppercase">
        My Profile
      </span>

      {/* Header Card */}
      <div className="flex flex-col md:flex-row items-center gap-8 w-full border-2 border-gray-200 p-4 rounded-xl ">
        <div className="">
          <Avatar
            style={{
              backgroundColor: "#1976d2",
              width: "100px",
              height: "100px",
              fontSize: "2rem",
            }}
          >
            {user.firstName?.charAt(0) || "U"}
          </Avatar>
        </div>

        <div className="flex flex-col gap-1 ">
          <span className="text-title">
            {user.firstName} {user.lastName}
          </span>
          <span className="text-subtitle text-gray-500">{user.email}</span>
        </div>

        {/* <div className="ml-auto">
          <Chip
            label={"Active"}
            sx={{ backgroundColor: "green", color: "white" }}
          />
        </div> */}
      </div>

      {/* Editable Form */}
      <PageFrame>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* First Name */}
            <Controller
              name="firstName"
              control={control}
              rules={{
                required: "First Name is required",
                validate: { isAlphanumeric, noOnlyWhitespace },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="First Name"
                  size="small"
                  fullWidth
                  disabled={!editMode}
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
                />
              )}
            />

            {/* Last Name */}
            <Controller
              name="lastName"
              control={control}
              rules={{
                required: "Last Name is required",
                validate: { isAlphanumeric, noOnlyWhitespace },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Last Name"
                  size="small"
                  fullWidth
                  disabled={!editMode}
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
                />
              )}
            />

            {/* Email (readonly) */}
            <Controller
              name="email"
              control={control}
              rules={{
                required: "Email is required",
                validate: { isValidEmail },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Email"
                  size="small"
                  fullWidth
                  disabled
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              )}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            {!editMode ? (
              // ✅ Make Edit a non-submit action
              <PrimaryButton
                title={"Edit"}
                // if your PrimaryButton supports type, pass type="button"
                // otherwise, prevent default here:
                handleSubmit={(e) => {
                  e?.preventDefault?.();
                  setEditMode(true);
                }}
              />
            ) : (
              <>
                {/* Save remains the actual submit */}
                <PrimaryButton title={"Save"} />
                {/* ✅ Cancel is non-submit and resets */}
                <SecondaryButton
                  title={"Cancel"}
                  handleSubmit={(e) => {
                    e?.preventDefault?.();
                    reset({
                      firstName: user.firstName || "",
                      lastName: user.lastName || "",
                      email: user.email || "",
                    });
                    setEditMode(false);
                  }}
                />
              </>
            )}
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default UserDetails;
