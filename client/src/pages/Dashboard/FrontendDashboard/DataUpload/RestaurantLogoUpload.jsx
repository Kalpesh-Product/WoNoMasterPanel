import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { DropdownLogo, UploadActions, UploadCard, UploadPanel, muiFieldSx } from "./UploadUI";

const LOGO_ENDPOINT = "/api/admin/upload-restaurant-logo";
const RESTAURANTS_QUERY_KEY = ["restaurants-for-logo-upload"];
const MAX_BYTES = 5 * 1024 * 1024;
const FILTERS_STORAGE_KEY = "restaurantLogoUploadFilters";

const RestaurantLogoUpload = () => {
  const inputRef = useRef(null);
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();

  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const { data: restaurants = [], isLoading, isLoadingError } = useQuery({
    queryKey: RESTAURANTS_QUERY_KEY,
    queryFn: async () => {
      const res = await axios.get(LOGO_ENDPOINT);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const countries = useMemo(
    () =>
      uniqueSorted(
        restaurants.map((restaurant) => restaurant.country).filter(Boolean),
      ),
    [restaurants],
  );

  const destinations = useMemo(
    () =>
      uniqueSorted(
        restaurants
          .filter((restaurant) => restaurant.country === country)
          .map((restaurant) => restaurant.destination || restaurant.state)
          .filter(Boolean),
      ),
    [restaurants, country],
  );

  const filteredRestaurants = useMemo(
    () =>
      restaurants.filter((restaurant) => {
        const restaurantDestination = restaurant.destination || restaurant.state;
        return (
          restaurant.country === country &&
          restaurantDestination === destination
        );
      }),
    [restaurants, country, destination],
  );

  useEffect(() => {
    if (!restaurants.length) return;

    const savedFilters = safeParseJSON(
      localStorage.getItem(FILTERS_STORAGE_KEY),
    );
    const savedCountry = countries.includes(savedFilters.country)
      ? savedFilters.country
      : "";

    const destinationsForCountry = uniqueSorted(
      restaurants
        .filter((restaurant) => restaurant.country === savedCountry)
        .map((restaurant) => restaurant.destination || restaurant.state)
        .filter(Boolean),
    );
    const savedDestination = destinationsForCountry.includes(
      savedFilters.destination,
    )
      ? savedFilters.destination
      : "";

    setCountry(savedCountry);
    setDestination(savedDestination);
  }, [restaurants, countries]);

  useEffect(() => {
    if (!restaurants.length) return;

    localStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ country, destination }),
    );
  }, [restaurants, country, destination]);

  useEffect(() => {
    if (destination && !destinations.includes(destination)) {
      setDestination("");
      setRestaurantId("");
    }
  }, [destinations, destination]);

  const { mutate, isPending } = useMutation({
    mutationFn: async ({ restaurantId, file }) => {
      const form = new FormData();
      form.append("restaurantId", restaurantId);
      form.append("image", file);

      const res = await axios.post(LOGO_ENDPOINT, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.cleanupFailed) toast.warning(data.message);
      else toast.success(data?.message || "Restaurant logo uploaded successfully");
      queryClient.invalidateQueries({ queryKey: RESTAURANTS_QUERY_KEY });
      setFile(null);
      setPreview(null);
      setRestaurantId("");
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message || "Restaurant logo upload failed";
      toast.error(message);
      setError(message);
    },
  });

  const onFileChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return setFile(null);

    if (selectedFile.size > MAX_BYTES) {
      setError(`File too large. Max allowed: ${humanSize(MAX_BYTES)}`);
      return;
    }

    setError(null);
    setFile(selectedFile);
  };

  const handleUpload = () => {
    if (!restaurantId) return setError("Please select a restaurant first");
    if (!file) return setError("Please select a logo to upload");
    mutate({ restaurantId, file });
  };

  const handleReset = () => {
    setCountry("");
    setDestination("");
    setRestaurantId("");
    setSearchTerm("");
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <UploadCard
      title="Restaurant Logo Upload"
      description="Pick a restaurant, then upload a logo for it."
    >
      <UploadPanel>
        {isLoading ? (
          <p className="text-xs font-pmedium text-slate-500">Loading restaurants...</p>
        ) : isLoadingError ? (
          <p role="alert" className="text-xs font-pmedium text-rose-600">
            Could not load restaurants from Nomads.
          </p>
        ) : !restaurants.length ? (
          <p className="text-xs font-pmedium text-slate-500">
            No restaurants are available for logo upload yet.
          </p>
        ) : (
          <>
            <div data-tour="data-upload-target-picker" className="grid gap-3 sm:grid-cols-3">
              <TextField
                select
                size="small"
                fullWidth
                label="Country"
                value={country}
                sx={muiFieldSx}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setDestination("");
                  setRestaurantId("");
                  setSearchTerm("");
                }}
              >
                {countries.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                fullWidth
                label="Destination"
                value={destination}
                sx={muiFieldSx}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setRestaurantId("");
                  setSearchTerm("");
                }}
                disabled={!country}
              >
                {destinations.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                fullWidth
                label="Restaurant"
                value={restaurantId}
                sx={muiFieldSx}
                onChange={(e) => setRestaurantId(e.target.value)}
                disabled={!destination}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { maxHeight: 300 },
                    },
                  },
                  renderValue: (selected) => {
                    const restaurant = filteredRestaurants.find(
                      (item) => item._id === selected,
                    );
                    return restaurant ? restaurant.restaurantName : "";
                  },
                }}
              >
                <MenuItem disableRipple disableTouchRipple>
                  <TextField
                    size="small"
                    placeholder="Search restaurant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    fullWidth
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </MenuItem>

                {filteredRestaurants
                  .filter((restaurant) =>
                    String(restaurant.restaurantName || restaurant.businessName)
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                  )
                  .map((restaurant) => (
                    <MenuItem key={restaurant._id} value={restaurant._id}>
                      <DropdownLogo src={restaurant.logo} />
                      {restaurant.restaurantName || restaurant.businessName}
                    </MenuItem>
                  ))}
              </TextField>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              className="hidden"
              id="restaurant-logo-input"
            />
            <button
              type="button"
              data-tour="data-upload-dropzone"
              className="mt-4 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-7 text-center transition hover:border-[#2563EB]/40 hover:bg-blue-50/30"
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud size={22} className="text-slate-400" />
              <span className="text-xs font-pmedium text-slate-600">
                {file ? "Change logo" : "Upload logo here (click to browse)"}
              </span>
              <span className="text-[10px] font-pmedium text-slate-400">
                {file
                  ? `${file.name} · ${humanSize(file.size)}`
                  : `.jpg, .png, .webp · Max ${humanSize(MAX_BYTES)}`}
              </span>
            </button>

            {preview && (
              <div className="mt-4">
                <img
                  src={preview}
                  alt="preview"
                  className="mx-auto h-48 w-48 rounded-xl border border-slate-200 object-cover"
                />
              </div>
            )}

            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}

            <div className="mt-4" data-tour="data-upload-actions">
              <UploadActions
                onUpload={handleUpload}
                onReset={handleReset}
                pending={isPending}
                uploadDisabled={!file || !restaurantId || isPending}
                resetDisabled={isPending}
              />
            </div>
          </>
        )}
      </UploadPanel>
    </UploadCard>
  );
};

export default RestaurantLogoUpload;

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function safeParseJSON(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
