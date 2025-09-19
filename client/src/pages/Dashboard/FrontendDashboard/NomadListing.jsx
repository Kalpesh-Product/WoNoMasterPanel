import { useRef } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import {
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Select,
  Checkbox,
  ListItemText,
} from "@mui/material";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import SecondaryButton from "../../../components/SecondaryButton";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import UploadMultipleFilesInput from "../../../components/UploadMultipleFilesInput";

// Dummy inclusions
const inclusionOptions = [
  "Private Desk",
  "Private Storage",
  "Air Conditioning",
  "High Speed Wi-Fi",
  "IT Support",
  "Tea & Coffee",
  "Reception Support",
  "Housekeeping",
  "Community",
  "Meeting Room",
];

// Dummy company types
const companyTypes = ["Coworking", "Meeting Room", "Cafe", "Private Stay"];

// ✅ Default review structure
const defaultReview = {
  name: "",
  review: "",
  rating: 5,
};

const NomadListing = () => {
  const axios = useAxiosPrivate();
  const formRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      businessId: `BIZ_${Date.now()}`,
      companyType: "",
      ratings: "",
      totalReviews: "",
      latitude: "",
      longitude: "",
      inclusions: [],
      about: "",
      address: "",
      images: [],
      reviews: [defaultReview], // ✅ initialize with one review
    },
  });

  // ✅ Field Array for reviews
  const {
    fields: reviewFields,
    append: appendReview,
    remove: removeReview,
  } = useFieldArray({ control, name: "reviews" });

  const { mutate: createCompany, isLoading } = useMutation({
    mutationFn: async (fd) => {
      const res = await axios.post("/api/companies/create", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Company added successfully!");
      reset();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to add company");
    },
  });

  const onSubmit = (values, e) => {
    const formEl = e?.target || formRef.current;
    const fd = new FormData(formEl);

    fd.set("businessId", values.businessId);
    fd.set("inclusions", JSON.stringify(values.inclusions));
    fd.set("reviews", JSON.stringify(values.reviews)); // ✅ add reviews to payload

    if (values.images?.length) {
      values.images.forEach((file) => fd.append("images", file));
    }

    createCompany(fd);
  };

  const handleReset = () => {
    const node = formRef.current;
    node && node.reset();
    reset();
  };

  return (
    <div className="p-4">
      <PageFrame>
        <form
          ref={formRef}
          encType="multipart/form-data"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-4">
          {/* Company Type */}
          <Controller
            name="companyType"
            control={control}
            rules={{ required: "Company Type is required" }}
            render={({ field }) => (
              <TextField {...field} select size="small" label="Company Type">
                {companyTypes.map((type) => (
                  <MenuItem key={type} value={type.toLowerCase()}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* Ratings */}
          <Controller
            name="ratings"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Ratings"
                type="number"
              />
            )}
          />

          {/* Total Reviews */}
          <Controller
            name="totalReviews"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Total Reviews"
                type="number"
              />
            )}
          />

          {/* Latitude */}
          <Controller
            name="latitude"
            control={control}
            render={({ field }) => (
              <TextField {...field} size="small" label="Latitude" />
            )}
          />

          {/* Longitude */}
          <Controller
            name="longitude"
            control={control}
            render={({ field }) => (
              <TextField {...field} size="small" label="Longitude" />
            )}
          />

          {/* Inclusions - Multi select */}
          <Controller
            name="inclusions"
            control={control}
            render={({ field }) => (
              <FormControl size="small">
                <InputLabel>Inclusions</InputLabel>
                <Select
                  {...field}
                  multiple
                  input={<OutlinedInput label="Inclusions" />}
                  renderValue={(selected) => selected.join(", ")}>
                  {inclusionOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      <Checkbox checked={field.value.indexOf(option) > -1} />
                      <ListItemText primary={option} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          {/* About */}
          <div className="col-span-2">
            <Controller
              name="about"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="About"
                  multiline
                  minRows={3}
                  fullWidth
                />
              )}
            />
          </div>

          {/* Address */}
          <div className="col-span-2">
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Address"
                  multiline
                  minRows={2}
                  fullWidth
                />
              )}
            />
          </div>

          {/* Images Upload */}
          <div className="col-span-2">
            <Controller
              name="images"
              control={control}
              render={({ field }) => (
                <UploadMultipleFilesInput
                  {...field}
                  label="Product Images"
                  maxFiles={5}
                  allowedExtensions={["jpg", "jpeg", "png", "webp"]}
                  id="images"
                />
              )}
            />
          </div>

          {/* ✅ Reviews Section */}
          <div className="col-span-2">
            <div className="py-4 border-b border-gray-300">
              <span className="text-lg font-medium text-primary">Reviews</span>
            </div>

            {reviewFields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-gray-300 p-4 my-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Review {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeReview(index)}
                    className="text-sm text-red-500">
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <Controller
                    name={`reviews.${index}.name`}
                    control={control}
                    rules={{ required: "Name is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        size="small"
                        label="Reviewer Name"
                        fullWidth
                        helperText={errors?.reviews?.[index]?.name?.message}
                        error={!!errors?.reviews?.[index]?.name}
                      />
                    )}
                  />

                  {/* Rating */}
                  <Controller
                    name={`reviews.${index}.rating`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="number"
                        size="small"
                        label="Rating (1-5)"
                        fullWidth
                        inputProps={{ min: 1, max: 5 }}
                      />
                    )}
                  />
                </div>

                {/* Review text */}
                <Controller
                  name={`reviews.${index}.review`}
                  control={control}
                  rules={{ required: "Review is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      size="small"
                      label="Review"
                      fullWidth
                      multiline
                      minRows={3}
                      helperText={errors?.reviews?.[index]?.review?.message}
                      error={!!errors?.reviews?.[index]?.review}
                      sx={{ mt: 2 }} // ✅ adds spacing above this input
                    />
                  )}
                />
              </div>
            ))}

            {/* Add Review button */}
            <div>
              <button
                type="button"
                onClick={() => appendReview({ ...defaultReview })}
                className="text-sm text-primary">
                + Add Review
              </button>
            </div>
          </div>

          {/* Submit / Reset */}
          <div className="col-span-2 flex items-center justify-center gap-4">
            <PrimaryButton type="submit" title="Submit" isLoading={isLoading} />
            <SecondaryButton handleSubmit={handleReset} title="Reset" />
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default NomadListing;
