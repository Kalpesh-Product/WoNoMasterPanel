import React, { useEffect, useRef, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Typography } from "@mui/material";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Textarea from "@mui/joy/Textarea";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import SecondaryButton from "../../../components/SecondaryButton";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const defaultValues = {
  serialNumber: "",
  link: "",
  mainImage: "",
  mainTitle: "",
  mainContent: "",
  eventName: "",
  placeName: "",
  restaurantName: "",
  shortDescription: "",
  address: "",
  contact: "",
  timeAvailability: "",
  googleMapsLink: "",
  rating: "",
  category: "",
  month: "",
  venue: "",
  destination: "",
  eventType: "",
  placeType: "",
  restaurantType: "",
  author: "",
  source: "",
  date: "",
  sections: [],
  isActive: true,
};

const stripGeneratedFields = (payload, { omitStatus = false } = {}) => {
  const { _id, id, __v, createdAt, updatedAt, isActive, ...rest } = payload;
  return omitStatus ? rest : { ...rest, isActive };
};

const stripSectionIds = (sections = []) =>
  sections.map((section) => {
    const { id, _id, ...rest } = section;
    return rest;
  });

const openImagePreview = (event, src) => {
  event.preventDefault();
  let imageUrl;
  try {
    imageUrl = new URL(src, window.location.href);
    if (!["http:", "https:", "blob:"].includes(imageUrl.protocol)) {
      throw new Error("Invalid image URL");
    }
  } catch {
    toast.error("Enter a valid image URL to preview.");
    return;
  }

  // Embed the image so attachment headers cannot trigger a navigation download.
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    toast.error("Allow pop-ups to open the image preview.");
    return;
  }
  previewWindow.opener = null;
  previewWindow.document.title = "Image preview";
  const image = previewWindow.document.createElement("img");
  image.src = imageUrl.href;
  image.alt = "Image preview";
  image.style.cssText = "max-width:100%;max-height:100vh;object-fit:contain";
  previewWindow.document.body.style.cssText = "margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111";
  previewWindow.document.body.appendChild(image);
};

const ContentSectionImageInput = ({ field, file, onFileChange, id, disabled }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-2 w-full mb-3">
      <label className="text-sm text-slate-700">Section Image URL</label>
      <Input {...field} placeholder="Section Image URL" variant="outlined" color="neutral" disabled={disabled || !!file} />
      <label htmlFor={id} className="text-sm text-slate-700">Or upload a section image</label>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
            toast.error("Choose a JPEG, PNG, or WebP image.");
            event.target.value = "";
            return;
          }
          if (selected.size > 15 * 1024 * 1024) {
            toast.error("The image must be 15 MB or smaller.");
            event.target.value = "";
            return;
          }
          onFileChange(selected);
        }}
      />
      <p className="text-xs text-slate-500">JPEG, PNG, or WebP, up to 15 MB. The selected file replaces this section's image when you save.</p>
      {(preview || field.value) && <img src={preview || field.value} alt="Section image preview" className="max-h-48 w-full rounded-lg object-contain" />}
      {file && (
        <button type="button" disabled={disabled} className="self-start text-sm text-red-600 hover:underline" onClick={() => {
          onFileChange(null);
          if (inputRef.current) inputRef.current.value = "";
        }}>Remove selected image</button>
      )}
    </div>
  );
};

const EditBlogNews = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const axiosPrivate = useAxiosPrivate();

  const { type: typeParam, locationType } = useParams();

  let type = location.state?.type || typeParam;
  if (!type && locationType) {
    const dashIndex = locationType.lastIndexOf("-");
    if (dashIndex !== -1) {
      type = locationType.substring(dashIndex + 1);
    }
  }

  const stateItem = location.state?.item || null;
  const destinations = location.state?.destinations || [];
  const isEvent = type === "event";
  const isPlace = type === "place";
  const isRestaurant = type === "restaurant";
  const isEdit = !!stateItem?._id;
  const supportsImageUploads = ["blog", "news", "event", "place"].includes(type);
  const [mainImageFile, setMainImageFile] = useState(null);
  const [sectionImageFiles, setSectionImageFiles] = useState({});
  const [mainImagePreview, setMainImagePreview] = useState("");
  const mainImageInputRef = useRef(null);

  useEffect(() => {
    if (!mainImageFile) {
      setMainImagePreview("");
      return;
    }
    const preview = URL.createObjectURL(mainImageFile);
    setMainImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [mainImageFile]);

  const { data: fetchedItem, isFetching: isItemFetching } = useQuery({
    queryKey: [type, "detail", stateItem?._id],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${NOMADS_API_BASE_URL}/${isEvent ? "events" : isPlace ? "places" : "restaurants"}/${stateItem._id}`,
      );
      return response.data?.data || response.data;
    },
    enabled: (isEvent || isPlace || isRestaurant) && isEdit,
  });

  const item =
    (isEvent || isPlace || isRestaurant) && fetchedItem
      ? fetchedItem
      : stateItem;

  const { control, handleSubmit, reset } = useForm({ defaultValues });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sections",
  });

  useEffect(() => {
    setMainImageFile(null);
    setSectionImageFiles({});
    if (mainImageInputRef.current) mainImageInputRef.current.value = "";
    if (item) {
      reset({
        ...defaultValues,
        ...item,
        sections: (item.sections || []).map((section) => ({
          ...section,
          id: section._id || section.id,
        })),
        isActive: item.isActive !== undefined ? item.isActive : true,
      });
    } else {
      reset({
        ...defaultValues,
        destination: location.state?.selectedLocation || "",
      });
    }
  }, [item, location.state?.selectedLocation, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data) => {
      const cleanData = stripGeneratedFields(
        {
          ...data,
          sections: stripSectionIds(data.sections),
        },
        { omitStatus: !isEdit },
      );

      const resourceType =
        type === "blog"
          ? "blogs"
          : type === "event"
            ? "events"
          : type === "place"
            ? "places"
            : type === "restaurant"
              ? "restaurants"
              : "news";
      const baseUrl = isEvent || isPlace
        ? `/api/destination-content/${type}`
        : isRestaurant
          ? `${NOMADS_API_BASE_URL}/${resourceType}`
          : `/api/${resourceType}`;
      const url = `${baseUrl}${isEdit ? `/${item._id}` : ""}`;
      const method = isEdit ? "PATCH" : "POST";

      let payload = cleanData;
      const sectionUploads = fields
        .map((section, index) => ({ index, file: sectionImageFiles[section.id] }))
        .filter(({ file }) => file);
      if (supportsImageUploads && (mainImageFile || sectionUploads.length)) {
        payload = new FormData();
        Object.entries(cleanData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            payload.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
          }
        });
        if (mainImageFile) payload.append("mainImageFile", mainImageFile);
        sectionUploads.forEach(({ index, file }) => {
          payload.append(`sectionImageFiles[${index}]`, file);
        });
      }

      const response = await axiosPrivate({ method, url, data: payload });
      return response.data;
    },
    onSuccess: () => {
      toast.success(`${type} ${isEdit ? "updated" : "created"} successfully`);
      queryClient.invalidateQueries({
        queryKey: ["country-content-stats", "blogs-news-comprehensive"],
      });
      queryClient.invalidateQueries({ queryKey: ["destination-events"] });
      queryClient.invalidateQueries({ queryKey: ["destination-places"] });
      queryClient.invalidateQueries({ queryKey: ["destination-restaurants"] });
      navigate(-1);
    },
    onError: (err) => {
      console.error("Error:", err);
      toast.error(
        err.response?.data?.message || err.message || "Something went wrong",
      );
    },
  });

  const onSubmit = (data) => mutate(data);

  const titleFieldName = isEvent
    ? "eventName"
    : isPlace
      ? "placeName"
      : isRestaurant
        ? "restaurantName"
        : "mainTitle";
  const contentFieldName =
    isEvent || isPlace || isRestaurant ? "shortDescription" : "mainContent";

  return (
    <div className="p-4">
      <PageFrame>
        <Typography
          variant="h5"
          className="mb-6 font-semibold uppercase p-4 my-3"
        >
          {isEdit ? "Edit" : "Add"} {type}
        </Typography>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className={`grid grid-cols-1 gap-4 ${supportsImageUploads ? "md:grid-cols-3" : "md:grid-cols-2"}`}
        >
          <Controller
            name="destination"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Destination</label>
                <Select
                  value={field.value || null}
                  placeholder="Select Destination"
                  variant="outlined"
                  color="neutral"
                  onChange={(_, val) => field.onChange(val)}
                >
                  {destinations.map((dest) => (
                    <Option key={dest} value={dest}>
                      {dest}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
          />

          {isRestaurant ? (
            <Controller
              name="serialNumber"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">
                    Serial Number
                  </label>
                  <Input
                    {...field}
                    placeholder="Serial number"
                    variant="outlined"
                    color="neutral"
                  />
                </div>
              )}
            />
          ) : null}

          <Controller
            name="link"
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Link</label>
                <Input
                  {...field}
                  placeholder="Type URL here"
                  variant="outlined"
                  color="neutral"
                />

              </div>
            )}
          />

          <Controller
            name={titleFieldName}
            control={control}
            render={({ field }) => (
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">
                  {isEvent
                    ? "Event Name"
                    : isPlace
                      ? "Place Name"
                      : isRestaurant
                        ? "Restaurant Name"
                        : "Main Title"}
                </label>
                <Input
                  {...field}
                  placeholder="Type title here"
                  variant="outlined"
                  color="neutral"
                />
              </div>
            )}
          />

          <Controller
            name="mainImage"
            control={control}
            render={({ field }) => (
              <div className={`grid gap-4 w-full mt-4 ${supportsImageUploads ? "col-span-full md:grid-cols-2" : "grid-cols-1"}`}>
                <div className="flex min-w-0 flex-col gap-2">
                  <label className="text-sm text-slate-700">Main Image URL</label>
                  <Input
                    {...field}
                    placeholder="Type URL here"
                    variant="outlined"
                    color="neutral"
                    disabled={supportsImageUploads && !!mainImageFile}
                  />
                  {supportsImageUploads && (mainImagePreview || field.value) && (
                    <a
                      href={mainImagePreview || field.value}
                      onClick={(event) => openImagePreview(event, mainImagePreview || field.value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start text-sm text-primary underline"
                    >
                      Preview
                    </a>
                  )}
                </div>
                {supportsImageUploads && (
                  <div className="flex min-w-0 flex-col gap-2">
                    <label htmlFor="blog-main-image-file" className="text-sm text-slate-700">
                      Or upload a main image
                    </label>
                    <input
                      id="blog-main-image-file"
                      ref={mainImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isPending}
                      className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                          toast.error("Choose a JPEG, PNG, or WebP image.");
                          event.target.value = "";
                          return;
                        }
                        if (file.size > 15 * 1024 * 1024) {
                          toast.error("The image must be 15 MB or smaller.");
                          event.target.value = "";
                          return;
                        }
                        setMainImageFile(file);
                      }}
                    />
                    <p className="text-xs text-slate-500">
                      JPEG, PNG, or WebP, up to 15 MB. The selected file replaces the URL image when you save.
                    </p>
                    {mainImageFile && (
                      <button
                        type="button"
                        disabled={isPending}
                        className="self-start text-sm text-red-600 hover:underline"
                        onClick={() => {
                          setMainImageFile(null);
                          if (mainImageInputRef.current) mainImageInputRef.current.value = "";
                        }}
                      >
                        Remove selected image
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          />

          {isEvent || isPlace || isRestaurant ? (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-4">
          {isEvent || isPlace ? (
            <Controller
              name="serialNumber"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">
                    Serial Number
                  </label>
                  <Input
                    {...field}
                    placeholder="Serial number"
                    variant="outlined"
                    color="neutral"
                  />
                </div>
              )}
            />
          ) : null}
              {(isRestaurant
                ? [
                    "category",
                    "restaurantType",
                    "rating",
                    "address",
                    "contact",
                    "timeAvailability",
                    "googleMapsLink",
                    "month",
                    "venue",
                  ]
                : isPlace
                  ? [
                      "category",
                      "rating",
                      "address",
                      "googleMapsLink",
                      "month",
                      "venue",
                      "placeType",
                    ]
                  : ["category", "month", "venue", "eventType"]
              ).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 w-full mt-4">
                      <label className="text-sm text-slate-700">
                        {name === "eventType"
                          ? "Event Type"
                          : name === "placeType"
                            ? "Place Type"
                            : name === "restaurantType"
                              ? "Restaurant Type"
                              : name === "googleMapsLink"
                                ? "Google Maps Link"
                                : name === "timeAvailability"
                                  ? "Time Availability"
                                  : name.charAt(0).toUpperCase() +
                                    name.slice(1)}
                      </label>
                      <Input
                        {...field}
                        placeholder={name}
                        variant="outlined"
                        color="neutral"
                      />
                    </div>
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="col-span-full grid grid-cols-1 md:grid-cols-4 gap-4">
              {["author", "source"].map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 w-full mt-4">
                      <label className="text-sm text-slate-700">
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </label>
                      <Input
                        {...field}
                        placeholder={name}
                        variant="outlined"
                        color="neutral"
                      />
                    </div>
                  )}
                />
              ))}
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-2 w-full mt-4">
                    <label className="text-sm text-slate-700">Date</label>
                    <Input
                      {...field}
                      type="date"
                      variant="outlined"
                      color="neutral"
                    />
                  </div>
                )}
              />
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-2 w-full mt-4">
                    <label className="text-sm text-slate-700">Status</label>
                    <Select
                      value={field.value !== undefined ? field.value : true}
                      placeholder="Select status"
                      variant="outlined"
                      color="neutral"
                      onChange={(_, val) => field.onChange(val)}
                    >
                      <Option value={true}>Active</Option>
                      <Option value={false}>Inactive</Option>
                    </Select>
                  </div>
                )}
              />
            </div>
          )}

          <div className="col-span-full">
            <Controller
              name={contentFieldName}
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">
                    {isEvent || isPlace || isRestaurant
                      ? "Short Description"
                      : "Main Content"}
                  </label>
                  <Textarea
                    {...field}
                    placeholder="Type content here..."
                    minRows={4}
                    variant="outlined"
                    color="neutral"
                  />
                </div>
              )}
            />
          </div>

          <div className="col-span-full">
            <div className="py-4 border-b border-gray-300">
              <span className="text-lg font-medium text-primary">Sections</span>
            </div>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-gray-300 p-4 my-3"
              >
                <div className="flex justify-between mb-2">
                  <span>Section {index + 1}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setSectionImageFiles((current) => {
                        const next = { ...current };
                        delete next[field.id];
                        return next;
                      });
                      remove(index);
                    }}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <Controller
                  name={`sections.${index}.title`}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 w-full mb-3">
                      <label className="text-sm text-slate-700">
                        Section Title
                      </label>
                      <Input
                        {...field}
                        placeholder="Section Title"
                        variant="outlined"
                        color="neutral"
                      />
                    </div>
                  )}
                />
                <Controller
                  name={`sections.${index}.image`}
                  control={control}
                  render={({ field }) => supportsImageUploads ? (
                    <ContentSectionImageInput
                      field={field}
                      file={sectionImageFiles[fields[index].id]}
                      id={`blog-section-image-${fields[index].id}`}
                      disabled={isPending}
                      onFileChange={(file) => setSectionImageFiles((current) => ({
                        ...current,
                        [fields[index].id]: file,
                      }))}
                    />
                  ) : (
                    <div className="flex flex-col gap-2 w-full mb-3">
                      <label className="text-sm text-slate-700">
                        Section Image URL
                      </label>
                      <Input
                        {...field}
                        placeholder="Section Image URL"
                        variant="outlined"
                        color="neutral"
                      />
                    </div>
                  )}
                />
                <Controller
                  name={`sections.${index}.content`}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 w-full mb-3">
                      <label className="text-sm text-slate-700">
                        Section Content
                      </label>
                      <Textarea
                        {...field}
                        placeholder="Type section content here..."
                        minRows={3}
                        variant="outlined"
                        color="neutral"
                      />
                    </div>
                  )}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ title: "", image: "", content: "" })}
              disabled={isPending}
              className="text-primary text-sm"
            >
              + Add Section
            </button>
          </div>

          <div className="col-span-full flex gap-4 mt-6 justify-center">
            <PrimaryButton
              type="submit"
              title={isPending ? "Saving..." : "Save"}
              isLoading={isPending}
              disabled={isPending || isItemFetching}
            />
            <SecondaryButton
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              title="Cancel"
              isLoading={isPending}
              disabled={isPending}
            />
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default EditBlogNews;
