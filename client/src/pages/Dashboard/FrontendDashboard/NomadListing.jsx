import { useMemo, useRef, useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Country, State, City } from "country-state-city";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import SecondaryButton from "../../../components/SecondaryButton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import publicAxios from "axios";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import UploadMultipleFilesInput from "../../../components/UploadMultipleFilesInput";
import WebsiteFormField from "../../../components/WebsiteFormField";
import WebsiteMultiSelectField from "../../../components/WebsiteMultiSelectField";
import { useLocation } from "react-router-dom";
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

// ✅ Default description structure
const defaultReview = {
  name: "",
  review: "",
  starCount: 5,
};

const NomadListing = () => {
  const location = useLocation();
  const navState = location?.state || {};
  const companyId =
    navState.companyId || sessionStorage.getItem("companyId") || "";
  const axios = useAxiosPrivate();
  const formRef = useRef(null);

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
  const addedTypes = useMemo(
    () =>
      new Set(
        existingListings
          .map((listing) => normalizeCompanyType(listing.companyType))
          .filter(Boolean),
      ),
    [existingListings],
  );

  // Removed: Services/Units field options no longer needed
  // const { data: serviceOptions = [] } = useQuery({
  //   queryKey: ["nomad-field-options", "services"],
  //   queryFn: async () => {
  //     const res = await publicAxios.get(`${NOMADS_API_BASE_URL}/company/field-options`, {
  //       params: { field: "services" },
  //     });
  //     return Array.isArray(res.data) ? res.data : [];
  //   },
  // });
  // const { data: unitOptions = [] } = useQuery({
  //   queryKey: ["nomad-field-options", "units"],
  //   queryFn: async () => {
  //     const res = await publicAxios.get(`${NOMADS_API_BASE_URL}/company/field-options`, {
  //       params: { field: "units" },
  //     });
  //     return Array.isArray(res.data) ? res.data : [];
  //   },
  // });
  // Fallback preview when no per-listing logo is uploaded — the listing
  // then just uses this, the Host Company's own profile logo.
  const { data: hostCompanies = [] } = useQuery({
    queryKey: ["hostCompaniesList"],
    queryFn: async () => {
      const res = await axios.get("/api/hosts/host-companies");
      return res.data || [];
    },
  });
  const profileLogoUrl = useMemo(
    () =>
      hostCompanies.find((c) => c.companyId === companyId)?.logo?.url || "",
    [hostCompanies, companyId],
  );

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      businessId: `BIZ_${Date.now()}`,
      companyType: "",
      companyTitle: "",
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
      images: [],
      logo: [],
      googleMap: "",
      reviews: [defaultReview], // ✅ initialize with one description
    },
  });

  const selectedCompanyType = watch("companyType");

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

  const { mutate: createCompany, isLoading } = useMutation({
    mutationFn: async (fd) => {
      const res = await axios.post("/api/hosts/add-company-listing", fd, {
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

  // const onSubmit = (values, e) => {
  //   const formEl = e?.target || formRef.current;
  //   const fd = new FormData(formEl);

  //   fd.set("businessId", values.businessId);
  //   fd.set("inclusions", JSON.stringify(values.inclusions));
  //   fd.set("reviews", JSON.stringify(values.reviews)); // ✅ add reviews to payload

  //   if (values.images?.length) {
  //     values.images.forEach((file) => fd.append("images", file));
  //   }

  //   createCompany(fd);
  // };

  // const onSubmit = (values, e) => {
  //   const formEl = e?.target || formRef.current;
  //   const fd = new FormData(formEl);
  const onSubmit = (values) => {
    const formEl = formRef.current;
    const fd = new FormData(formEl);

    fd.set("companyId", companyId);
    fd.set("companyType", values.companyType);
    fd.set("companyTitle", values.companyTitle);
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
    fd.set("country", values.country);
    fd.set("state", values.state);
    fd.set("city", values.city);

    // ✅ inclusions/services/units as comma-separated strings
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

    const mappedReviews = (values.reviews || []).map((r) => ({
      ...r,
      review: r.review || r.description || "",
      description: r.description || r.review || "",
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

    // Optional per-listing logo — falls back to the Host Company's profile
    // logo server-side when nothing is uploaded here.
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

  return (
    <div className="p-4">
      <PageFrame>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5 mb-4">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
              Add Product
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Create a new listing for your co-working or co-living space on Wono Nomads.
            </p>
          </div>
        </div>
        <form
          ref={formRef}
          encType="multipart/form-data"
          onSubmit={handleSubmit(onSubmit, () => onSubmit(getValues()))}
          className="grid grid-cols-2 gap-4"
        >
          {/* Company Title */}
          <Controller
            name="companyTitle"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="Company Title"
                  helperText="Defaults to the company name if left blank"
                />
              </div>
            )}
          />

          {/* Website URL */}
          <Controller
            name="website"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="Website URL"
                  helperText="Defaults to the company's registered website if left blank"
                />
              </div>
            )}
          />

          {/* Company Type */}
          <Controller
            name="companyType"
            control={control}
            rules={{ required: "Company Type is required" }}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  select
                  label="Company Type"
                  onChange={(e) => {
                    field.onChange(e);
                    // Inclusions are fixed per company type — drop any
                    // selected ones that don't apply to the new type.
                    const allowed = new Set(AMENITIES_BY_TYPE[e.target.value] || []);
                    const current = getValues("inclusions") || [];
                    setValue("inclusions", current.filter((v) => allowed.has(v)));
                  }}
                >
                  <option value="" disabled>
                    Select Company Type
                  </option>
                  {companyTypes.map((type) => {
                    const alreadyAdded = addedTypes.has(normalizeCompanyType(type));
                    return (
                      <option key={type} value={type.toLowerCase()}>
                        {type}
                        {alreadyAdded ? " (Added)" : ""}
                      </option>
                    );
                  })}
                </WebsiteFormField>
              </div>
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
                <div className="col-span-2 md:col-span-1">
                  <WebsiteMultiSelectField
                    label="Inclusions"
                    value={
                      Array.isArray(field.value)
                        ? field.value
                        : field.value
                          ? [field.value]
                          : []
                    }
                    onChange={field.onChange}
                    options={options}
                    disabled={!selectedType}
                    placeholder="Select inclusions"
                  />
                </div>
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
                  <FormControl size="small" fullWidth>
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
                  <FormControl size="small" fullWidth>
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
                className="col-span-2 md:col-span-1"
              />
            )}
          />
          */}

          {/* Address */}
          {/* <div className="col-span-2"> */}
          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="Address"
                  multiline
                  minRows={3}
                />
              </div>
            )}
          />
          {/* </div> */}

          {/* About */}
          {/* <div className="col-span-2"> */}
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
                />
              </div>
            )}
          />
          {/* </div> */}

          {/* Ratings */}
          <Controller
            name="ratings"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField field={field} label="Ratings" type="number" />
              </div>
            )}
          />

          {/* Total Reviews */}
          <Controller
            name="totalReviews"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  label="Total Reviews"
                  type="number"
                />
              </div>
            )}
          />

          {/* Country — each listing has its own location, independent of
              the Host Company's registered address. */}
          <Controller
            name="country"
            control={control}
            rules={{ required: "Country is required" }}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  select
                  label="Country"
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
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    select
                    label="State"
                    disabled={!countryObj}
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
                <div className="col-span-2 md:col-span-1">
                  <WebsiteFormField
                    field={field}
                    select
                    label="City"
                    disabled={!stateObj}
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

          {/* Images Upload */}
          {/* <div className="col-span-2"> */}
          <Controller
            name="images"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <UploadMultipleFilesInput
                  {...field}
                  label="Product Images"
                  maxFiles={5}
                  allowedExtensions={["jpg", "jpeg", "png", "webp"]}
                  id="images"
                />
              </div>
            )}
          />
          {/* </div> */}

          {/* Logo — optional; falls back to the Host Company's profile logo */}
          <div className="col-span-2 md:col-span-1">
            <Controller
              name="logo"
              control={control}
              render={({ field }) => (
                <UploadMultipleFilesInput
                  {...field}
                  label="Company Logo (optional)"
                  maxFiles={1}
                  allowedExtensions={["jpg", "jpeg", "png", "webp"]}
                  id="logo"
                />
              )}
            />
            {!watch("logo")?.length && profileLogoUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={profileLogoUrl}
                  alt="Company logo"
                  className="h-24 w-24 rounded-lg object-contain border p-1"
                />
                <p className="text-[11px] font-pmedium text-slate-500">
                  Using this company's profile logo. Upload one above to override it for this listing.
                </p>
              </div>
            )}
          </div>

          <Controller
            name="googleMap"
            control={control}
            rules={{
              validate: (val) => {
                const v = (val || "").trim();
                if (!v) return true; // optional
                const GOOGLE_MAP_REGEX =
                  /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;
                return GOOGLE_MAP_REGEX.test(v) || "Enter a valid Google Maps URL";
              },
            }}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField
                  field={field}
                  onChange={(e) => {
                    field.onChange(e);
                    const coords = extractLatLngFromMapUrl(e.target.value);
                    if (coords) {
                      setValue("latitude", coords.lat);
                      setValue("longitude", coords.lng);
                    }
                  }}
                  label="Google Map URL"
                  helperText={errors?.googleMap?.message}
                  error={!!errors.googleMap}
                />
              </div>
            )}
          />

          {/* Latitude — auto-filled from the Google Map URL above when possible */}
          <Controller
            name="latitude"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField field={field} label="Latitude" />
              </div>
            )}
          />

          {/* Longitude — auto-filled from the Google Map URL above when possible */}
          <Controller
            name="longitude"
            control={control}
            render={({ field }) => (
              <div className="col-span-2 md:col-span-1">
                <WebsiteFormField field={field} label="Longitude" />
              </div>
            )}
          />

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
                  <button
                    type="button"
                    onClick={() => removeReview(index)}
                    className="text-sm text-red-500"
                  >
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
                      <WebsiteFormField
                        field={field}
                        label="Reviewer Name"
                        helperText={errors?.reviews?.[index]?.name?.message}
                        error={!!errors?.reviews?.[index]?.name}
                      />
                    )}
                  />

                  {/* Rating */}
                  <Controller
                    name={`reviews.${index}.starCount`}
                    control={control}
                    render={({ field }) => (
                      <WebsiteFormField
                        field={field}
                        type="number"
                        label="Rating (1-5)"
                        min={1}
                        max={5}
                      />
                    )}
                  />
                </div>

                {/* Review text */}
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
                        helperText={
                          errors?.reviews?.[index]?.review?.message
                        }
                        error={!!errors?.reviews?.[index]?.review}
                      />
                    )}
                  />
                </div>
              </div>
            ))}

            {/* Add Review button */}
            <div>
              <button
                type="button"
                onClick={() => appendReview({ ...defaultReview })}
                className="text-sm text-primary"
              >
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
