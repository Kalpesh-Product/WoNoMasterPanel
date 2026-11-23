// Copy of EditNomadListing.jsx for use inside the Destinations Data flow —
// hits the same /api/hosts/edit-company-listing endpoint, so edits stay in
// sync with the Companies > Nomad Listings page, but invalidates this
// page's own queries and navigates back here on save instead of there.
import { useEffect, useRef, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Country, State, City } from "country-state-city";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import UploadMultipleFilesInput from "../../../components/UploadMultipleFilesInput";
import WebsiteFormField from "../../../components/WebsiteFormField";
import WebsiteMultiSelectField from "../../../components/WebsiteMultiSelectField";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const companyTypes = [
  "Coworking",
  "Meeting Room",
  "Cafe",
  "Workation",
  "Coliving",
  "Hostel",
];

const AMENITIES_BY_TYPE = {
  coworking: [
    "Private Desk", "Private Storage", "Air Conditioning", "High Speed Wi-Fi", "Wi-Fi",
    "IT Support", "Tea & Coffee", "Reception Support", "Admin Support", "Housekeeping",
    "Community", "Maintenance", "Power Backup", "Meeting Room", "Cafeteria",
    "Printing Services", "CCTV Secure", "Purified Water", "Custom Solutions",
  ],
  coliving: [
    "Shared Space", "Private Space", "Private Storage", "Air Conditioning", "Wi-Fi",
    "High Speed Wi-Fi", "IT Support", "Tea & Coffee", "Reception Support", "Admin Support",
    "Housekeeping", "Community", "Maintenance", "Power Backup", "Cafeteria",
    "Printing Services", "Laundry Facilities", "CCTV Secure", "Swimming Pool",
  ],
  workation: [
    "Shared Space", "Private Space", "Private Storage", "Air Conditioning", "Wi-Fi",
    "High Speed Wi-Fi", "IT Support", "Tea & Coffee", "Reception Support", "Admin Support",
    "Housekeeping", "Community", "Maintenance", "Power Backup", "Cafeteria",
    "Printing Services", "Laundry Facilities", "CCTV Secure", "Swimming Pool",
  ],
  privatestay: [
    "Private Space", "Private Storage", "Television", "Air Conditioning", "Wi-Fi",
    "High Speed Wi-Fi", "IT Support", "Tea & Coffee", "Reception Support", "Admin Support",
    "Housekeeping", "Community", "Maintenance", "Power Backup", "Cafeteria",
    "Printing Services", "Washing Machine", "CCTV Secure", "Swimming Pool",
  ],
  hostel: [
    "Shared Space", "Private Space", "Private Storage", "Air Conditioning", "Wi-Fi",
    "High Speed Wi-Fi", "IT Support", "Tea & Coffee", "Reception Support", "Admin Support",
    "Housekeeping", "Community", "Maintenance", "Power Backup", "Cafeteria",
    "Printing Services", "Laundry Facilities", "CCTV Secure", "Swimming Pool",
  ],
  cafe: [
    "Private Desk", "Private Storage", "Air Conditioning", "High Speed Wi-Fi", "Wi-Fi",
    "IT Support", "Tea & Coffee", "Reception Support", "Admin Support", "Housekeeping",
    "Community", "Maintenance", "Power Backup", "Visitor allowed", "Cafeteria",
    "Printing Services", "CCTV Secure", "Water Purifier", "Custom Solutions",
  ],
  meetingroom: [
    "Private Meeting Room", "Smart Television", "Air Conditioning", "High Speed Wi-Fi", "Wi-Fi",
    "IT Support", "Tea & Coffee", "Reception Support", "Admin Support", "Housekeeping",
    "Community", "Maintenance", "Power Backup", "Visitor allowed", "Cafeteria",
    "Printing Services", "CCTV Secure", "Water Purifier", "Custom Solutions",
  ],
};

const extractLatLngFromMapUrl = (url) => {
  const v = String(url || "");
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const m = v.match(pattern);
    if (m) return { lat: m[1], lng: m[2] };
  }
  return null;
};

const normalizeCompanyType = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const getListingCompanyTitle = (listing) =>
  String(
    listing?.companyTitle ||
    listing?.registeredEntityName ||
    listing?.companyName ||
    "",
  ).trim();

const defaultReview = {
  name: "",
  review: "",
  rating: 5,
};

const DestinationsDataNomadListingEdit = () => {
  const axiosPriv = useAxiosPrivate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const location = useLocation();
  const navState = location?.state || {};
  const isViewMode = navState.mode === "view";

  const companyId =
    navState.companyId || sessionStorage.getItem("companyId") || "";
  const companyType =
    navState.website?.companyType ||
    sessionStorage.getItem("companyType") ||
    "";
  const businessId =
    navState.website?.businessId || sessionStorage.getItem("businessId") || "";

  const { data: hostCompanies = [] } = useQuery({
    queryKey: ["hostCompaniesList"],
    queryFn: async () => {
      const res = await axiosPriv.get("/api/hosts/host-companies");
      return res.data || [];
    },
  });
  const profileLogoUrl =
    hostCompanies.find((c) => c.companyId === companyId)?.logo?.url || "";

  const {
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      businessId: `BIZ_${Date.now()}`,
      companyType: "",
      website: "",
      ratings: "",
      totalReviews: "",
      latitude: "",
      longitude: "",
      country: "",
      state: "",
      city: "",
      inclusions: [],
      about: "",
      address: "",
      googleMap: "",
      images: [],
      logo: [],
      companyTitle: "",
      companyName: "",
      reviews: [],
    },
  });

  const {
    fields: reviewFields,
    append: appendReview,
    remove: removeReview,
  } = useFieldArray({ control, name: "reviews" });

  useEffect(() => {
    if (navState.website?.companyType) {
      sessionStorage.setItem("companyType", navState.website.companyType);
    }
  }, [navState.website?.companyType]);

  const { data: fetchedListing } = useQuery({
    queryKey: ["nomad-listing-detail", companyId, businessId],
    enabled: !!companyId && !!businessId,
    queryFn: async () => {
      const res = await axios.get(
        `${NOMADS_API_BASE_URL}/company/get-listings/${companyId}?companyType=${companyType}`,
      );
      const all = Array.isArray(res.data) ? res.data : [];
      return all.find((x) => x.businessId === businessId) || null;
    },
  });

  const { data: existingListings = [] } = useQuery({
    queryKey: ["nomad-listing-types", companyId],
    enabled: !!companyId,
    retry: false,
    queryFn: async () => {
      try {
        const response = await axios.get(
          `${NOMADS_API_BASE_URL}/company/get-listings/${companyId}`,
        );
        return Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        if (error?.response?.status === 404) return [];
        throw error;
      }
    },
  });

  const originalType = normalizeCompanyType(
    fetchedListing?.companyType || navState.website?.companyType || companyType,
  );
  const addedTypes = new Set(
    existingListings
      .map((listing) => normalizeCompanyType(listing.companyType))
      .filter(Boolean),
  );

  useEffect(() => {
    const src = fetchedListing || navState.website;
    if (!src) return;

    const reviews = Array.isArray(src.reviews)
      ? src.reviews.length
        ? src.reviews.map((r) => ({
          name: r.name || "",
          review: r.review || r.description || r.testimony || "",
          rating: Number(r.starCount ?? r.rating ?? 5),
        }))
        : []
      : [];

    const splitCommaList = (value) =>
      Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim()
          ? value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          : [];

    const resolvedCompanyTitle = getListingCompanyTitle(src);

    reset({
      businessId: src.businessId || businessId || `BIZ_${Date.now()}`,
      companyType: src.companyType || "",
      website: src.website || "",
      ratings: src.ratings ?? "",
      totalReviews: src.totalReviews ?? "",
      latitude: src.latitude != null ? String(src.latitude) : "",
      longitude: src.longitude != null ? String(src.longitude) : "",
      country: src.country || "",
      state: src.state || "",
      city: src.city || "",
      inclusions: splitCommaList(src.inclusions),
      about: src.about || "",
      address: src.address || "",
      googleMap: src.googleMap || "",
      images: [],
      logo: [],
      companyTitle: resolvedCompanyTitle,
      companyName: src.companyName || "",
      reviews,
    });
  }, [navState.website, fetchedListing, businessId, reset]);

  const existingLogoUrl = (fetchedListing || navState.website)?.logo?.url || "";

  const { mutate: createCompany, isLoading } = useMutation({
    mutationFn: async (fd) => {
      const res = await axiosPriv.patch("/api/hosts/edit-company-listing", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Listing updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["destination-listings"] });
      queryClient.invalidateQueries({ queryKey: ["destinations-data-summary"] });
      navigate(-1);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update listing");
    },
  });

  const onSubmit = (values, e) => {
    const formEl = e?.target || formRef.current;
    const fd = new FormData(formEl);

    fd.set("companyId", companyId);
    fd.set("businessId", values.businessId);
    fd.set("companyType", values.companyType);
    fd.set("website", values.website);
    fd.set("ratings", values.ratings);
    fd.set("totalReviews", values.totalReviews);
    fd.set("latitude", values.latitude);
    fd.set("longitude", values.longitude);
    fd.set("about", values.about);
    fd.set(
      "address",
      values.address?.trim() ||
        [values.city, values.state, values.country].filter(Boolean).join(", "),
    );
    fd.set("googleMap", values.googleMap);
    fd.set("companyTitle", values.companyTitle);
    fd.set("companyName", values.companyName);
    fd.set("existingImages", JSON.stringify(fetchedListing?.images || []));
    fd.set("country", values.country);
    fd.set("state", values.state);
    fd.set("city", values.city);

    const toCommaString = (value) =>
      (Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      ).join(", ");
    fd.set("inclusions", toCommaString(values.inclusions));

    const mappedReviews = (values.reviews || []).map((r) => ({
      ...r,
      name: r.name || "",
      review: r.review || r.description || r.testimony || "",
      description: r.description || r.review || r.testimony || "",
      starCount: Number(r.starCount ?? r.rating ?? 5),
    }));
    fd.set("reviews", JSON.stringify(mappedReviews));

    for (const key of Array.from(fd.keys())) {
      if (/^reviews\.\d+\./.test(key)) fd.delete(key);
    }

    fd.delete("images");
    if (values.images?.length) {
      values.images.forEach((file) => fd.append("images", file));
    }

    fd.delete("logo");
    if (values.logo?.[0] instanceof File) {
      fd.append("logo", values.logo[0]);
    }

    createCompany(fd);
  };

  const resetFormToEmpty = () => {
    formRef.current?.reset();

    reset({
      businessId: "",
      companyType: "",
      website: "",
      ratings: "",
      totalReviews: "",
      latitude: "",
      longitude: "",
      country: "",
      state: "",
      city: "",
      inclusions: [],
      about: "",
      address: "",
      googleMap: "",
      images: [],
      logo: [],
      reviews: [],
      companyTitle: "",
    });
  };

  return (
    <div className="p-4">
      <PageFrame>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5 mb-4">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
              {isViewMode ? "View Listing" : "Edit Listing"}
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              {isViewMode
                ? "Viewing the details of this Wono Nomads listing."
                : "Update the details of this Wono Nomads listing."}
            </p>
          </div>
        </div>
        <form
          ref={formRef}
          encType="multipart/form-data"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-4"
        >
          <Controller
            name="companyType"
            control={control}
            rules={{ required: "Company Type is required" }}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  select
                  label="Company Type"
                  disabled={isViewMode}
                  onChange={(e) => {
                    field.onChange(e);
                    const allowed = new Set(AMENITIES_BY_TYPE[e.target.value] || []);
                    const current = getValues("inclusions") || [];
                    setValue("inclusions", current.filter((v) => allowed.has(v)));
                  }}
                >
                  <option value="" disabled>
                    Select Company Type
                  </option>
                  {companyTypes.map((type) => {
                    const normalizedType = normalizeCompanyType(type);
                    const alreadyAdded =
                      normalizedType !== originalType &&
                      addedTypes.has(normalizedType);
                    return (
                      <option
                        key={type}
                        value={type.toLowerCase().replace(/\s+/g, "")}
                      >
                        {type}
                        {alreadyAdded ? " (Added)" : ""}
                      </option>
                    );
                  })}
                </WebsiteFormField>
              </div>
            )}
          />

          <Controller
            name="inclusions"
            control={control}
            render={({ field }) => {
              const selectedType = watch("companyType");
              const options = AMENITIES_BY_TYPE[selectedType] || [];
              return (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteMultiSelectField
                    label="Inclusions"
                    value={Array.isArray(field.value) ? field.value : []}
                    onChange={field.onChange}
                    options={options}
                    disabled={isViewMode || !selectedType}
                    placeholder="Select inclusions"
                  />
                </div>
              );
            }}
          />

          <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Controller
              name="companyName"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField field={field} label="Company Name" disabled />
                </div>
              )}
            />
            <Controller
              name="companyTitle"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    label="Company Title"
                    disabled={isViewMode}
                  />
                </div>
              )}
            />

            <Controller
              name="website"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    label="Website URL"
                    helperText="Defaults to the company's registered website if left blank"
                    disabled={isViewMode}
                  />
                </div>
              )}
            />

            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    label="Address"
                    disabled={isViewMode}
                  />
                </div>
              )}
            />
          </div>

          <Controller
            name="about"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="About"
                  multiline
                  minRows={3}
                  disabled={isViewMode}
                />
              </div>
            )}
          />

          <div className="grid grid-row-2 gap-2">
            <Controller
              name="ratings"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    label="Ratings"
                    type="number"
                    disabled={isViewMode}
                  />
                </div>
              )}
            />
            <Controller
              name="googleMap"
              control={control}
              render={({ field }) => (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => {
                      field.onChange(e);
                      const coords = extractLatLngFromMapUrl(e.target.value);
                      if (coords) {
                        setValue("latitude", coords.lat);
                        setValue("longitude", coords.lng);
                      }
                    }}
                    label="Google Map Url"
                    disabled={isViewMode}
                  />
                </div>
              )}
            />
          </div>

          <Controller
            name="totalReviews"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="Total Reviews"
                  type="number"
                  disabled={isViewMode}
                />
              </div>
            )}
          />

          <Controller
            name="latitude"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField field={field} label="Latitude" disabled={isViewMode} />
              </div>
            )}
          />

          <Controller
            name="longitude"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField field={field} label="Longitude" disabled={isViewMode} />
              </div>
            )}
          />

          <Controller
            name="country"
            control={control}
            rules={{ required: "Country is required" }}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  select
                  label="Country"
                  disabled={isViewMode}
                  error={!!errors.country}
                  helperText={errors?.country?.message}
                  onChange={(e) => {
                    field.onChange(e);
                    setValue("state", "");
                    setValue("city", "");
                  }}
                >
                  <option value="" disabled>
                    Select Country
                  </option>
                  {Country.getAllCountries().map((c) => (
                    <option key={c.isoCode} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </WebsiteFormField>
              </div>
            )}
          />

          <Controller
            name="state"
            control={control}
            rules={{ required: "State is required" }}
            render={({ field }) => {
              const countryName = watch("country");
              const countryObj = Country.getAllCountries().find(
                (c) => c.name === countryName,
              );
              const states = countryObj
                ? State.getStatesOfCountry(countryObj.isoCode)
                : [];
              return (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    name={field.name}
                    value={field.value}
                    onBlur={field.onBlur}
                    select
                    label="State"
                    disabled={isViewMode || !countryObj}
                    error={!!errors.state}
                    helperText={errors?.state?.message}
                    onChange={(e) => {
                      field.onChange(e);
                      setValue("city", "");
                    }}
                  >
                    <option value="" disabled>
                      Select State
                    </option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </WebsiteFormField>
                </div>
              );
            }}
          />

          <Controller
            name="city"
            control={control}
            rules={{ required: "City is required" }}
            render={({ field }) => {
              const countryName = watch("country");
              const stateName = watch("state");
              const countryObj = Country.getAllCountries().find(
                (c) => c.name === countryName,
              );
              const stateObj =
                countryObj &&
                State.getStatesOfCountry(countryObj.isoCode).find(
                  (s) => s.name === stateName,
                );
              const cities =
                countryObj && stateObj
                  ? City.getCitiesOfState(countryObj.isoCode, stateObj.isoCode)
                  : [];
              return (
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    select
                    label="City"
                    disabled={isViewMode || !stateObj}
                    error={!!errors.city}
                    helperText={errors?.city?.message}
                  >
                    <option value="" disabled>
                      Select City
                    </option>
                    {cities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </WebsiteFormField>
                </div>
              );
            }}
          />

          <div className="col-span-2">
            {fetchedListing?.images?.length > 0 && (
              <div className="flex gap-3 flex-wrap mb-3">
                {fetchedListing.images.map((img) => (
                  <div
                    key={img._id}
                    className="relative w-24 h-24 border rounded overflow-hidden"
                  >
                    <img
                      src={img.url}
                      alt={`Image ${img.index}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            {!isViewMode && (
              <Controller
                name="images"
                control={control}
                render={({ field }) => (
                  <UploadMultipleFilesInput
                    {...field}
                    label="Upload New Images"
                    maxFiles={10}
                    allowedExtensions={["jpg", "jpeg", "png", "webp"]}
                    id="images"
                  />
                )}
              />
            )}
          </div>

          <div className="col-span-2 md:col-span-1">
            {(existingLogoUrl || profileLogoUrl) && !watch("logo")?.length && (
              <div className="mb-2 flex items-center gap-3">
                <img
                  src={existingLogoUrl || profileLogoUrl}
                  alt="Listing logo"
                  className="h-24 w-24 rounded-lg object-contain border p-1"
                />
                <p className="text-[11px] font-pmedium text-slate-500">
                  {existingLogoUrl
                    ? "This listing's current logo."
                    : "Using this company's profile logo."}
                </p>
              </div>
            )}
            {!isViewMode && (
              <Controller
                name="logo"
                control={control}
                render={({ field }) => (
                  <UploadMultipleFilesInput
                    {...field}
                    label="Replace Company Logo (optional)"
                    maxFiles={1}
                    allowedExtensions={["jpg", "jpeg", "png", "webp"]}
                    id="logo"
                  />
                )}
              />
            )}
          </div>

          <div className="col-span-2">
            <div className="py-4 border-b border-gray-300">
              <span className="text-lg font-medium text-primary">Reviews</span>
            </div>

            {reviewFields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-gray-300 p-4 my-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Review {index + 1}</span>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => removeReview(index)}
                      className="text-sm text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Controller
                    name={`reviews.${index}.name`}
                    control={control}
                    rules={{ required: "Name is required" }}
                    render={({ field }) => (
                      <WebsiteFormField
                        field={field}
                        label="Reviewer Name"
                        disabled={isViewMode}
                        helperText={errors?.reviews?.[index]?.name?.message}
                        error={!!errors?.reviews?.[index]?.name}
                      />
                    )}
                  />

                  <Controller
                    name={`reviews.${index}.rating`}
                    control={control}
                    render={({ field }) => (
                      <WebsiteFormField
                        field={field}
                        type="number"
                        label="Rating (1-5)"
                        disabled={isViewMode}
                        min={1}
                        max={5}
                      />
                    )}
                  />
                </div>

                <div className="mt-4">
                  <Controller
                    name={`reviews.${index}.review`}
                    control={control}
                    render={({ field }) => (
                      <WebsiteFormField
                        field={field}
                        label="Review"
                        multiline
                        minRows={3}
                        disabled={isViewMode}
                        helperText={errors?.reviews?.[index]?.review?.message}
                        error={!!errors?.reviews?.[index]?.review}
                      />
                    )}
                  />
                </div>
              </div>
            ))}

            {!isViewMode && (
              <div>
                <button
                  type="button"
                  onClick={() => appendReview({ ...defaultReview })}
                  className="text-sm text-primary"
                >
                  + Add Review
                </button>
              </div>
            )}
          </div>

          <div className="col-span-2 flex items-center justify-center gap-4">
            {isViewMode ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-gray-200 text-black rounded-md"
              >
                Back
              </button>
            ) : (
              <>
                <PrimaryButton type="submit" title="Submit" isLoading={isLoading} />
                <button
                  type="button"
                  onClick={resetFormToEmpty}
                  className="px-6 py-2 bg-gray-200 text-black rounded-md"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </form>
      </PageFrame>
    </div>
  );
};

export default DestinationsDataNomadListingEdit;
