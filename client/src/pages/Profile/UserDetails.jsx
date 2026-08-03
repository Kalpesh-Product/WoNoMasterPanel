import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { TextField } from "@mui/material";
import {
  Camera,
  CheckCircle2,
  ImageUp,
  Mail,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import useAxiosPrivate from "../../hooks/useAxiosPrivate";
import useAuth from "../../hooks/useAuth";
import { toast } from "sonner";
import {
  isAlphanumeric,
  isValidEmail,
  noOnlyWhitespace,
} from "../../utils/validators";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

const fieldStyles = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "1rem",
    backgroundColor: "#f8fafc",
    "& fieldset": { borderColor: "#e2e8f0" },
    "&:hover fieldset": { borderColor: "#cbd5e1" },
    "&.Mui-focused fieldset": { borderColor: "#2563EB" },
    "&.Mui-disabled": { backgroundColor: "#f1f5f9" },
  },
};

const ProfileSkeleton = () => (
  <div className="space-y-5">
    <div className="h-7 w-36 animate-pulse rounded-lg bg-slate-200" />
    <div className="h-48 animate-pulse rounded-[2.5rem] border border-slate-100 bg-white shadow-sm" />
    <div className="h-64 animate-pulse rounded-[2rem] border border-slate-100 bg-white shadow-sm" />
  </div>
);

const UserDetails = () => {
  const axios = useAxiosPrivate();
  const { auth, setAuth } = useAuth();
  const user = auth?.user;
  const userId = user?._id;
  const fileInputRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    defaultValues: { firstName: "", lastName: "", email: "" },
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

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const profileMutation = useMutation({
    mutationFn: async (updatedData) =>
      axios.patch(`/api/admin/update-profile/${userId}`, updatedData),
    onSuccess: (res) => {
      const updatedUser = res.data?.user || {};
      toast.success(res.data?.message || "Profile updated successfully.");
      setAuth((previous) => ({
        ...previous,
        user: { ...previous.user, ...updatedUser },
      }));
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update profile.");
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (image) => {
      const formData = new FormData();
      formData.append("profilePic", image);
      return axios.patch(`/api/admin/update-profile/${userId}`, formData);
    },
    onSuccess: (res) => {
      const updatedUser = res.data?.user || {};
      setAuth((previous) => ({
        ...previous,
        user: { ...previous.user, ...updatedUser },
      }));
      setSelectedImage(null);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Profile photo updated successfully.");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update profile photo.",
      );
    },
  });

  const onSubmit = (data) => {
    if (!editMode || profileMutation.isPending) return;
    profileMutation.mutate({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
    });
  };

  const cancelEdit = () => {
    reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
    });
    setEditMode(false);
  };

  const handleImageChange = (event) => {
    const image = event.target.files?.[0];
    if (!image) return;

    if (!acceptedImageTypes.includes(image.type)) {
      toast.error("Choose a PNG, JPG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (image.size > MAX_PROFILE_IMAGE_SIZE) {
      toast.error("Profile photo must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(image);
    setPreviewUrl(URL.createObjectURL(image));
  };

  const cancelPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(null);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!user) return <ProfileSkeleton />;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Admin User";
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((name) => name.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const currentPhoto = previewUrl || user.profilePicture?.url || "";

  return (
    <div className="rounded-xl border-default border-borderGray bg-white p-4">
      <div className="flex items-center justify-between pb-4">
        <span className="text-title font-pmedium uppercase text-primary">
          My Profile
        </span>
      </div>

      <div className="space-y-5">
        <section className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col items-start gap-5 sm:flex-row">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#2563EB] to-[#1d4ed8] text-2xl font-pmedium text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition hover:brightness-95"
                  title="Change profile photo"
                  aria-label="Change profile photo"
                >
                  {currentPhoto ? (
                    <img
                      src={currentPhoto}
                      alt={`${displayName} profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:bg-slate-700"
                  title="Upload profile photo"
                  aria-label="Upload profile photo"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-pmedium tracking-tight text-slate-900 sm:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <Mail size={15} className="text-slate-400" />
                  <span className="truncate">{user.email}</span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-pmedium text-blue-700">
                    <ShieldCheck size={14} />
                    {user.isSuperAdmin ? "Super Admin" : "Admin"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-pmedium text-emerald-700">
                    <CheckCircle2 size={14} />
                    Active
                  </span>
                </div>

                {selectedImage && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-pmedium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                    >
                      <ImageUp size={13} />
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => photoMutation.mutate(selectedImage)}
                      disabled={photoMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-3 py-1.5 text-[11px] font-pmedium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Save size={13} />
                      {photoMutation.isPending ? "Uploading..." : "Save Photo"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPhoto}
                      disabled={photoMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-pmedium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X size={13} />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <UserRound size={19} />
              </div>
              <div>
                <h2 className="text-[15px] font-pmedium text-slate-900">
                  Personal Details
                </h2>
                <p className="text-[11px] text-slate-500">
                  Update your display name and account information.
                </p>
              </div>
            </div>

            {!editMode && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-[11px] font-pmedium text-blue-700 transition hover:bg-blue-100"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    sx={fieldStyles}
                  />
                )}
              />

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
                    sx={fieldStyles}
                  />
                )}
              />

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
                    sx={fieldStyles}
                  />
                )}
              />
            </div>

            {editMode && (
              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={profileMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <X size={13} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Save
                    size={13}
                    className={profileMutation.isPending ? "animate-pulse" : ""}
                  />
                  {profileMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default UserDetails;
