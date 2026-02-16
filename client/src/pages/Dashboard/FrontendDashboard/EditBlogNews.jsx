import React, { useEffect } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { TextField, MenuItem, Typography } from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const VITE_DEV_LINK = "http://localhost:5007/api";

const EditBlogNews = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const axiosPrivate = useAxiosPrivate();

    const { type: typeParam, locationType } = useParams();

    let type = typeParam;
    if (locationType) {
        const dashIndex = locationType.lastIndexOf("-");
        if (dashIndex !== -1) {
            type = locationType.substring(dashIndex + 1);
        }
    }

    const item = location.state?.item || null;
    const destinations = location.state?.destinations || [];
    const isEdit = !!item?._id;

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        defaultValues: {
            link: "",
            mainImage: "",
            mainTitle: "",
            mainContent: "",
            author: "",
            source: "",
            date: "",
            destination: "",
            sections: [],
            isActive: true,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "sections",
    });

    useEffect(() => {
        if (item) {
            reset({
                ...item,
                sections: (item.sections || []).map((section) => ({
                    ...section,
                    id: section._id || section.id,
                })),
                isActive: item.isActive !== undefined ? item.isActive : true,
            });
        } else {
            reset({
                link: "",
                mainImage: "",
                mainTitle: "",
                mainContent: "",
                author: "",
                source: "",
                date: "",
                destination: "",
                sections: [],
                isActive: true,
            });
        }
    }, [item, reset]);

    const { mutate, isPending } = useMutation({
        mutationFn: async (data) => {
            const resourceType = type === "blog" ? "blogs" : "news";

            const url = isEdit
                ? `${VITE_DEV_LINK}/${resourceType}/${item._id}`
                : `${VITE_DEV_LINK}/${resourceType}`;

            const method = isEdit ? "PATCH" : "POST";

            const cleanData = {
                ...data,
                sections: data.sections.map((section) => {
                    const { id, ...rest } = section;
                    return rest;
                }),
            };

            const response = await axiosPrivate({
                method,
                url,
                data: cleanData,
                baseURL: VITE_DEV_LINK,
            });

            return response.data;
        },
        onSuccess: () => {
            toast.success(`${type} ${isEdit ? "updated" : "created"} successfully`);
            queryClient.invalidateQueries(["country-content-stats", "blogs-news-comprehensive"]);
            navigate("/dashboard/BlogsAndNews");
        },
        onError: (err) => {
            console.error("Error:", err);
            toast.error(err.response?.data?.message || err.message || "Something went wrong");
        },
    });

    const onSubmit = (data) => {
        mutate(data);
    };

    return (
        <div className="p-4">
            <PageFrame>
                <Typography variant="h5" className="mb-6 font-semibold uppercase p-4 my-3">
                    {isEdit ? "Edit" : "Add"} {type}
                </Typography>

                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Destination */}
                    <Controller
                        name="destination"
                        control={control}
                        rules={{ required: "Destination is required" }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                select
                                label="Destination"
                                size="small"
                                fullWidth
                                error={!!errors.destination}
                                helperText={errors.destination?.message}
                            >
                                <MenuItem value="">Select Destination</MenuItem>
                                {destinations.map((dest) => (
                                    <MenuItem key={dest} value={dest}>{dest}</MenuItem>
                                ))}
                            </TextField>
                        )}
                    />

                    {/* Link */}
                    <Controller
                        name="link"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} label="Link" size="small" fullWidth />
                        )}
                    />

                    {/* Title */}
                    <Controller
                        name="mainTitle"
                        control={control}
                        rules={{
                            required: "Title is required",
                            minLength: { value: 5, message: "Title must be at least 5 characters" }
                        }}
                        render={({ field }) => (
                            <TextField
                                {...field}
                                label="Main Title"
                                size="small"
                                fullWidth
                                error={!!errors.mainTitle}
                                helperText={errors.mainTitle?.message}
                            />
                        )}
                    />

                    {/* Image */}
                    <Controller
                        name="mainImage"
                        control={control}
                        render={({ field }) => (
                            <TextField {...field} label="Main Image URL" size="small" fullWidth />
                        )}
                    />

                    {/* Author, Source, Date, and Status */}
                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Controller
                            name="author"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} label="Author" size="small" fullWidth />
                            )}
                        />
                        <Controller
                            name="source"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} label="Source" size="small" fullWidth />
                            )}
                        />
                        <Controller
                            name="date"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Date"
                                    size="small"
                                    fullWidth
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                />
                            )}
                        />
                        <Controller
                            name="isActive"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    select
                                    label="Status"
                                    size="small"
                                    fullWidth
                                    value={field.value ?? true}
                                    onChange={(e) => field.onChange(e.target.value === "true" || e.target.value === true)}
                                >
                                    <MenuItem value={true}>Active</MenuItem>
                                    <MenuItem value={false}>Inactive</MenuItem>
                                </TextField>
                            )}
                        />
                    </div>

                    {/* Content */}
                    <div className="col-span-2">
                        <Controller
                            name="mainContent"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Main Content"
                                    size="small"
                                    fullWidth
                                    multiline
                                    minRows={3}
                                />
                            )}
                        />
                    </div>

                    {/* Sections */}
                    <div className="col-span-2">
                        <div className="py-4 border-b border-gray-300">
                            <span className="text-lg font-medium text-primary">Sections</span>
                        </div>

                        {fields.map((field, index) => (
                            <div key={field.id} className="rounded-lg border border-gray-300 p-4 my-3">
                                <div className="flex justify-between mb-2">
                                    <span>Section {index + 1}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
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
                                        <TextField {...field} label="Section Title" size="small" fullWidth sx={{ mb: 2 }} />
                                    )}
                                />

                                <Controller
                                    name={`sections.${index}.image`}
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} label="Section Image URL" size="small" fullWidth sx={{ mb: 2 }} />
                                    )}
                                />

                                <Controller
                                    name={`sections.${index}.content`}
                                    control={control}
                                    render={({ field }) => (
                                        <TextField {...field} label="Section Content" size="small" fullWidth multiline minRows={3} />
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

                    {/* Buttons */}
                    <div className="col-span-2 flex gap-4 mt-6 justify-center">
                        <PrimaryButton
                            type="submit"
                            title={isPending ? "Saving..." : "Save"}
                            isLoading={isPending}
                            disabled={isPending}
                        />
                        <button
                            type="button"
                            onClick={() => navigate("/dashboard/BlogsAndNews")}
                            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </PageFrame>
        </div>
    );
};

export default EditBlogNews;