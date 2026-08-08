import { useEffect, useRef, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Country, State, City } from "country-state-city";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import UploadMultipleFilesInput from "../../../components/UploadMultipleFilesInput";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

// Company types
const companyTypes = [
  "Coworking",
  "Meeting Room",
  "Cafe",
  // "Private Stay",
  "Workation",
  "Coliving",
  "Hostel",
];

// Fixed amenities per company type — mirrors Nomads' own public site
// (frontend/src/components/AmenitiesList.jsx). Kept as a local constant
// (like companyTypes above) instead of fetched, so it always works
// regardless of whether the Nomads backend serving this environment has
// been redeployed with the newer /api/company/amenities endpoint.
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

// Best-effort extraction of coordinates from a pasted Google Maps URL.
// Handles the common "@lat,lng", "q=lat,lng", "ll=lat,lng" and embed
// "!3dlat!4dlng" formats. Short goo.gl links don't carry coordinates in
// the URL itself (they redirect), so those can't be auto-filled this way.
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

// ✅ Default review structure
const defaultReview = {
  name: "",
  review: "",
  rating: 5,
};

const EditNomadListing = () => {
  const axiosPriv = useAxiosPrivate();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const location = useLocation();
  const navState = location?.state || {};
  console.log("navState", navState.website?.companyType);
  const isViewMode = navState.mode === "view";

  // Pull IDs from state or sessionStorage (works after refresh/back)
  const companyId =
    navState.companyId || sessionStorage.getItem("companyId") || "";
  const companyType =
    navState.website?.companyType ||
    sessionStorage.getItem("companyType") ||
    "";
  const businessId =
    navState.website?.businessId || sessionStorage.getItem("businessId") || "";

  // Removed: Services/Units field options no longer needed
  // const { data: serviceOptions = [] } = useQuery({
  //   queryKey: ["nomad-field-options", "services"],
  //   queryFn: async () => {
  //     const res = await axios.get(`${NOMADS_API_BASE_URL}/company/field-options`, {
  //       params: { field: "services" },
  //     });
  //     return Array.isArray(res.data) ? res.data : [];
  //   },
  // });
  // const { data: unitOptions = [] } = useQuery({
  //   queryKey: ["nomad-field-options", "units"],
  //   queryFn: async () => {
  //     const res = await axios.get(`${NOMADS_API_BASE_URL}/company/field-options`, {
  //       params: { field: "units" },
  //     });
  //     return Array.isArray(res.data) ? res.data : [];
  //   },
  // });
  // Fallback preview when the listing has no logo of its own — it then
  // just uses this, the Host Company's own profile logo.
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
      // totalSeats: "",
      latitude: "",
      longitude: "",
      country: "",
      state: "",
      city: "",
      inclusions: [],
      // services: [],
      // units: [],
      about: "",
      address: "",
      googleMap: "",
      images: [],
      logo: [],
      // reviews: [defaultReview],
      companyTitle: "",
      companyName: "",
      reviews: [],
    },
  });

  // Removed: "Add new" boxes beside the Services/Units dropdowns no longer needed
  // const [newServiceText, setNewServiceText] = useState("");
  // const [newUnitText, setNewUnitText] = useState("");
  // const handleAddService = () => {
  //   const trimmed = newServiceText.trim();
  //   if (!trimmed) return;
  //   const current = getValues("services") || [];
  //   if (!current.includes(trimmed)) setValue("services", [...current, trimmed]);
  //   setNewServiceText("");
  // };
  // const handleAddUnit = () => {
  //   const trimmed = newUnitText.trim();
  //   if (!trimmed) return;
  //   const current = getValues("units") || [];
  //   if (!current.includes(trimmed)) setValue("units", [...current, trimmed]);
  //   setNewUnitText("");
  // };

  // ✅ Field Array for reviews
  const {
    fields: reviewFields,
    append: appendReview,
    remove: removeReview,
  } = useFieldArray({ control, name: "reviews" });

  // ---- Prefill logic -------------------------------------------------

  // 1) Always fetch the full listing (don't gate on navState.website)

  useEffect(() => {
    if (navState.website?.companyType) {
      sessionStorage.setItem("companyType", navState.website.companyType);
    }
  }, [navState.website?.companyType]);

  const { data: fetchedListing } = useQuery({
    queryKey: ["nomad-listing-detail", companyId, businessId],
    enabled: !!companyId && !!businessId, // <- changed
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

  // 2) Prefer fetchedListing (richer) over navState.website, normalize fields
  useEffect(() => {
    // prefer the fully-fetched record when available
    const src = fetchedListing || navState.website;
    if (!src) return;

    // const reviews =
    //   Array.isArray(src.reviews) && src.reviews.length
    //     ? src.reviews.map((r) => ({
    //         name: r.name || "",
    //         review: r.review || r.testimony || "",
    //         rating: Number(r.rating ?? 5),
    //       }))
    //     : [defaultReview];

    // The above code is to set to zero reviews temporarily. change it back to 1 by commenting it

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
      // totalSeats: src.totalSeats ?? "",
      latitude: src.latitude != null ? String(src.latitude) : "",
      longitude: src.longitude != null ? String(src.longitude) : "",
      country: src.country || "",
      state: src.state || "",
      city: src.city || "",
      inclusions: splitCommaList(src.inclusions),
      // services: splitCommaList(src.services),
      // units: splitCommaList(src.units),
      about: src.about || "",
      address: src.address || "",
      googleMap: src.googleMap || "",
      images: [], // cannot prefill file inputs
      logo: [],
      companyTitle: resolvedCompanyTitle,
      companyName: src.companyName || "",
      reviews,
    });
  }, [navState.website, fetchedListing, businessId, reset]);

  // The listing's own logo (if it has one) — otherwise the form falls back
  // to the Host Company's profile logo, shown separately below the upload
  // control.
  const existingLogoUrl = (fetchedListing || navState.website)?.logo?.url || "";

  // --------------------------------------------------------------------

  const { mutate: createCompany, isLoading } = useMutation({
    mutationFn: async (fd) => {
      const res = await axiosPriv.patch("/api/hosts/edit-company-listing", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Company updated successfully!");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update company");
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
    // fd.set("totalSeats", values.totalSeats);
    fd.set("latitude", values.latitude);
    fd.set("longitude", values.longitude);
    fd.set("about", values.about);
    // Falls back to "city, state, country" when left blank.
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

    // ✅ inclusions/services/units always strings
    const toCommaString = (value) =>
      (Array.isArray(value)
        ? value
        : typeof value === "string"
          ? value.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      ).join(", ");
    fd.set("inclusions", toCommaString(values.inclusions));
    // fd.set("services", toCommaString(values.services));
    // fd.set("units", toCommaString(values.units));

    // ✅ reviews: rating → starCount
    const mappedReviews = (values.reviews || []).map((r) => ({
      ...r,
      name: r.name || "",
      review: r.review || r.description || r.testimony || "",
      description: r.description || r.review || r.testimony || "",
      starCount: Number(r.starCount ?? r.rating ?? 5),
    }));
    fd.set("reviews", JSON.stringify(mappedReviews));

    // cleanup RHF noise
    for (const key of Array.from(fd.keys())) {
      if (/^reviews\.\d+\./.test(key)) fd.delete(key);
    }

    fd.delete("images");
    if (values.images?.length) {
      values.images.forEach((file) => fd.append("images", file));
    }

    // Optional per-listing logo replacement — omitted when unchanged, so
    // the server keeps whatever logo the listing already had.
    fd.delete("logo");
    if (values.logo?.[0] instanceof File) {
      fd.append("logo", values.logo[0]);
    }

    createCompany(fd);
  };

  const handleReset = () => {
    const node = formRef.current;
    node && node.reset();
    reset();
  };

  const resetFormToEmpty = () => {
    formRef.current?.reset(); // clears native inputs like file upload

    reset({
      businessId: "",
      companyType: "",
      website: "",
      ratings: "",
      totalReviews: "",
      // totalSeats: "",
      latitude: "",
      longitude: "",
      country: "",
      state: "",
      city: "",
      inclusions: [],
      // services: [],
      // units: [],
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
              {isViewMode ? "View Product" : "Edit Product"}
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              {isViewMode
                ? "Viewing the details of this Wono Nomads listing."
                : "Update the details of your Wono Nomads listing."}
            </p>
          </div>
        </div>
        <form
          ref={formRef}
          encType="multipart/form-data"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-2 gap-4"
        >
          {/* Company Type */}
          <Controller
            name="companyType"
            control={control}
            rules={{ required: "Company Type is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Company Type"
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
                onChange={(e) => {
                  field.onChange(e);
                  // Inclusions are fixed per company type — drop any
                  // selected ones that don't apply to the new type.
                  const allowed = new Set(AMENITIES_BY_TYPE[e.target.value] || []);
                  const current = getValues("inclusions") || [];
                  setValue("inclusions", current.filter((v) => allowed.has(v)));
                }}
              >
                {companyTypes.map((type) => {
                  const normalizedType = normalizeCompanyType(type);
                  const alreadyAdded =
                    normalizedType !== originalType &&
                    addedTypes.has(normalizedType);
                  return (
                    <MenuItem
                      key={type}
                      value={type.toLowerCase().replace(/\s+/g, "")}
                    >
                      <span className="flex w-full items-center justify-between gap-4 font-pmedium">
                        <span>{type}</span>
                        {alreadyAdded && (
                          <span className="text-[10px] font-pmedium uppercase tracking-wide text-emerald-600">
                            Added
                          </span>
                        )}
                      </span>
                    </MenuItem>
                  );
                })}
              </TextField>
            )}
          />

          {/* Inclusions — fixed list per company type, curated on Nomads;
              can be picked but not added to. */}
          <Controller
            name="inclusions"
            control={control}
            render={({ field }) => {
              const selectedType = watch("companyType");
              const options = AMENITIES_BY_TYPE[selectedType] || [];
              return (
                <FormControl size="small" className="col-span-2 md:col-span-1" disabled={isViewMode || !selectedType}>
                  <InputLabel>Inclusions</InputLabel>
                  <Select
                    {...field}
                    multiple
                    input={<OutlinedInput label="Inclusions" />}
                    renderValue={(selected) => selected.join(", ")}
                  >
                    {options.map((option) => (
                      <MenuItem key={option} value={option}>
                        <Checkbox checked={field.value.indexOf(option) > -1} />
                        <ListItemText primary={option} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }}
          />

          {/* ===== Services / Units / Total Seats (removed — not needed) =====
          Services — pick from what other hosts have already used, or
          type a new one below and click Add.
          <div className="col-span-2 md:col-span-1">
            <Controller
              name="services"
              control={control}
              render={({ field }) => {
                const options = Array.from(
                  new Set([...(serviceOptions || []), ...(field.value || [])]),
                ).sort((a, b) => a.localeCompare(b));
                return (
                  <FormControl size="small" fullWidth disabled={isViewMode}>
                    <InputLabel>Services</InputLabel>
                    <Select
                      {...field}
                      multiple
                      value={field.value || []}
                      input={<OutlinedInput label="Services" />}
                      renderValue={(selected) =>
                        Array.isArray(selected) ? selected.join(", ") : ""
                      }
                    >
                      {options.map((option) => (
                        <MenuItem key={option} value={option}>
                          <Checkbox checked={field.value?.includes(option)} />
                          <ListItemText primary={option} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }}
            />
            {!isViewMode && (
              <div className="mt-1.5 flex items-center gap-2">
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Type a new service, then click Add"
                  value={newServiceText}
                  onChange={(e) => setNewServiceText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddService();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddService}
                  className="shrink-0 px-3 py-2 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-[11px] font-pmedium uppercase tracking-wide"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          Units — same dropdown + add-new pattern as Services.
          <div className="col-span-2 md:col-span-1">
            <Controller
              name="units"
              control={control}
              render={({ field }) => {
                const options = Array.from(
                  new Set([...(unitOptions || []), ...(field.value || [])]),
                ).sort((a, b) => a.localeCompare(b));
                return (
                  <FormControl size="small" fullWidth disabled={isViewMode}>
                    <InputLabel>Units</InputLabel>
                    <Select
                      {...field}
                      multiple
                      value={field.value || []}
                      input={<OutlinedInput label="Units" />}
                      renderValue={(selected) =>
                        Array.isArray(selected) ? selected.join(", ") : ""
                      }
                    >
                      {options.map((option) => (
                        <MenuItem key={option} value={option}>
                          <Checkbox checked={field.value?.includes(option)} />
                          <ListItemText primary={option} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }}
            />
            {!isViewMode && (
              <div className="mt-1.5 flex items-center gap-2">
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Type a new unit, then click Add"
                  value={newUnitText}
                  onChange={(e) => setNewUnitText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUnit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="shrink-0 px-3 py-2 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-[11px] font-pmedium uppercase tracking-wide"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          Total Seats
          <Controller
            name="totalSeats"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Total Seats"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                disabled={isViewMode}
                className="col-span-2 md:col-span-1"
              />
            )}
          />
          */}

          <div className="col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Title */}
            <Controller
              name="companyName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Company Name"
                  className="col-span-2 md:col-span-1"
                  disabled
                />
              )}
            />
            {/* Title */}
            <Controller
              name="companyTitle"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Company Title"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode}
                />
              )}
            />

            {/* Website URL */}
            <Controller
              name="website"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Website URL"
                  helperText="Defaults to the company's registered website if left blank"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode}
                />
              )}
            />

            {/* Address */}
            <Controller
              name="address"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Address"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode}
                />
              )}
            />

          </div>

          {/* About */}
          {/* <div className="col-span-2"> */}
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
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
              />
            )}
          />
          {/* </div> */}

          {/* Ratings */}
          {/* <div className="col-span-2"> */}
          <div className="grid grid-row-2 gap-2">
            <Controller
              name="ratings"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Ratings"
                  type="number"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode}
                />
              )}
            />
            <Controller
              name="googleMap"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    const coords = extractLatLngFromMapUrl(e.target.value);
                    if (coords) {
                      setValue("latitude", coords.lat);
                      setValue("longitude", coords.lng);
                    }
                  }}
                  size="small"
                  label="Google Map Url"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode}
                />
              )}
            />
          </div>

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
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
              />
            )}
          />

          {/* Latitude — auto-filled from the Google Map URL above when possible */}
          <Controller
            name="latitude"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Latitude"
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
              />
            )}
          />

          {/* Longitude — auto-filled from the Google Map URL above when possible */}
          <Controller
            name="longitude"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                size="small"
                label="Longitude"
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
              />
            )}
          />
          {/* </div> */}

          {/* Country — each listing has its own location, independent of
              the Host Company's registered address. */}
          <Controller
            name="country"
            control={control}
            rules={{ required: "Country is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Country"
                className="col-span-2 md:col-span-1"
                disabled={isViewMode}
                error={!!errors.country}
                helperText={errors?.country?.message}
                onChange={(e) => {
                  field.onChange(e);
                  setValue("state", "");
                  setValue("city", "");
                }}
              >
                {Country.getAllCountries().map((c) => (
                  <MenuItem key={c.isoCode} value={c.name}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {/* State */}
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
                <TextField
                  {...field}
                  select
                  size="small"
                  label="State"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode || !countryObj}
                  error={!!errors.state}
                  helperText={errors?.state?.message}
                  onChange={(e) => {
                    field.onChange(e);
                    setValue("city", "");
                  }}
                >
                  {states.map((s) => (
                    <MenuItem key={s.isoCode} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }}
          />

          {/* City */}
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
                <TextField
                  {...field}
                  select
                  size="small"
                  label="City"
                  className="col-span-2 md:col-span-1"
                  disabled={isViewMode || !stateObj}
                  error={!!errors.city}
                  helperText={errors?.city?.message}
                >
                  {cities.map((c) => (
                    <MenuItem key={c.name} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              );
            }}
          />

          {/* Images Upload */}
          {/* <div className="col-span-2">
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
          </div> */}

          {/* Images Upload */}
          <div className="col-span-2">
            {/* Existing images preview (from API) */}
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

            {/* Upload new images (will be added on top of existing ones) */}
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

          {/* Logo — optional; falls back to the Host Company's profile logo */}
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

          {/* ✅ Reviews Section */}
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
                      <TextField
                        {...field}
                        size="small"
                        label="Reviewer Name"
                        fullWidth
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
                      <TextField
                        {...field}
                        type="number"
                        size="small"
                        label="Rating (1-5)"
                        fullWidth
                        disabled={isViewMode}
                        inputProps={{ min: 1, max: 5 }}
                      />
                    )}
                  />
                </div>

                <Controller
                  name={`reviews.${index}.review`}
                  control={control}
                  // rules={{ required: "Review is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      size="small"
                      label="Review"
                      fullWidth
                      multiline
                      minRows={3}
                      disabled={isViewMode}
                      helperText={errors?.reviews?.[index]?.review?.message}
                      error={!!errors?.reviews?.[index]?.review}
                      sx={{ mt: 2 }}
                    />
                  )}
                />
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

          {/* Submit / Reset */}
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
                {/* <SecondaryButton handleSubmit={handleReset} title="Reset" /> */}
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
    </div >
  );
};

export default EditNomadListing;
