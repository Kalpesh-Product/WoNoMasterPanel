import React, { useEffect } from "react";
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

const defaultValues = {
  serialNumber: "",
  link: "",
  mainImage: "",
  mainTitle: "",
  mainContent: "",
  eventName: "",
  shortDescription: "",
  category: "",
  month: "",
  venue: "",
  destination: "",
  eventType: "",
  author: "",
  source: "",
  date: "",
  sections: [],
  isActive: true,
};

const stripSectionIds = (sections = []) =>
  sections.map((section) => {
    const { id, _id, ...rest } = section;
    return rest;
  });

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
  const isEdit = !!stateItem?._id;

  const { data: fetchedEvent, isPending: isEventLoading } = useQuery({
    queryKey: ["event-detail", stateItem?._id],
    queryFn: async () => {
      const response = await axiosPrivate.get(`/api/events/${stateItem._id}`);
      return response.data?.data || response.data;
    },
    enabled: isEvent && isEdit,
  });

  const item = isEvent && fetchedEvent ? fetchedEvent : stateItem;

  const { control, handleSubmit, reset } = useForm({ defaultValues });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sections",
  });

  useEffect(() => {
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
      const cleanData = {
        ...data,
        sections: stripSectionIds(data.sections),
      };

      const resourceType = type === "blog" ? "blogs" : "news";
      const url = isEvent
        ? `/api/events${isEdit ? `/${item._id}` : ""}`
        : `/api/${resourceType}${isEdit ? `/${item._id}` : ""}`;
      const method = isEdit ? "PATCH" : "POST";

      const response = await axiosPrivate({ method, url, data: cleanData });
      return response.data;
    },
    onSuccess: () => {
      toast.success(`${type} ${isEdit ? "updated" : "created"} successfully`);
      queryClient.invalidateQueries({
        queryKey: ["country-content-stats", "blogs-news-comprehensive"],
      });
      queryClient.invalidateQueries({ queryKey: ["destination-events"] });
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

  const titleFieldName = isEvent ? "eventName" : "mainTitle";
  const contentFieldName = isEvent ? "shortDescription" : "mainContent";

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
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
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

          {isEvent ? (
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
                  {isEvent ? "Event Name" : "Main Title"}
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
              <div className="flex flex-col gap-2 w-full mt-4">
                <label className="text-sm text-slate-700">Main Image URL</label>
                <Input
                  {...field}
                  placeholder="Type URL here"
                  variant="outlined"
                  color="neutral"
                />
              </div>
            )}
          />

          {isEvent ? (
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
              {["category", "month", "venue", "eventType"].map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2 w-full mt-4">
                      <label className="text-sm text-slate-700">
                        {name === "eventType"
                          ? "Event Type"
                          : name.charAt(0).toUpperCase() + name.slice(1)}
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
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <div className="col-span-2">
            <Controller
              name={contentFieldName}
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2 w-full mt-4">
                  <label className="text-sm text-slate-700">
                    {isEvent ? "Short Description" : "Main Content"}
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

          <div className="col-span-2">
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
                    onClick={() => remove(index)}
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
                  render={({ field }) => (
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
              className="text-primary text-sm"
            >
              + Add Section
            </button>
          </div>

          <div className="col-span-2 flex gap-4 mt-6 justify-center">
            <PrimaryButton
              type="submit"
              title={isPending || isEventLoading ? "Saving..." : "Save"}
              isLoading={isPending || isEventLoading}
              disabled={isPending || isEventLoading}
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
