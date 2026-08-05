import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { toast } from "sonner";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";

const MAX_BYTES = 5 * 1024 * 1024;
const FILTERS_STORAGE_KEY = "restaurantLogoUploadFilters";

const RestaurantLogoUpload = () => {
  const inputRef = useRef(null);
  const axios = useAxiosPrivate();

  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-for-logo-upload"],
    queryFn: async () => {
      const res = await axios.get(`${NOMADS_API_BASE_URL}/restaurants`);
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

      const res = await axios.post("/api/admin/upload-restaurant-logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Restaurant logo uploaded successfully");
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
    <div className="p-0">
      <div className="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
        {isLoading ? (
          <p>Loading restaurants...</p>
        ) : (
          <>
            <TextField
              select
              size="small"
              fullWidth
              label="Country"
              value={country}
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
                    {restaurant.restaurantName || restaurant.businessName}
                  </MenuItem>
                ))}
            </TextField>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
              id="restaurant-logo-input"
            />
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-gray-400"
              onClick={() => inputRef.current?.click()}
            >
              <p className="font-medium">
                {file ? "Change logo" : "Upload logo here (click to browse)"}
              </p>
              {file && (
                <p className="text-sm text-gray-600">
                  Selected: {file.name} - {humanSize(file.size)}
                </p>
              )}
            </div>

            {preview && (
              <div className="mt-4">
                <img
                  src={preview}
                  alt="preview"
                  className="w-48 h-48 object-cover border rounded-lg mx-auto"
                />
              </div>
            )}

            <p className="text-xs text-gray-500">
              Accepted type: <code>.jpg, .png, .webp</code>. Max size:{" "}
              {humanSize(MAX_BYTES)}.
            </p>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-4 justify-center">
              <PrimaryButton
                type="button"
                title={isPending ? "Uploading..." : "Upload"}
                handleSubmit={handleUpload}
                isLoading={isPending}
                disabled={!file || !restaurantId || isPending}
              />
              <SecondaryButton
                type="button"
                title="Reset"
                handleSubmit={handleReset}
                disabled={isPending}
              />
            </div>
          </>
        )}
      </div>
    </div>
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
