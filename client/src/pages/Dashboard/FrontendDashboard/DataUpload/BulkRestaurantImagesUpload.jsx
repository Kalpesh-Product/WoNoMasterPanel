import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { toast } from "sonner";
import PrimaryButton from "../../../../components/PrimaryButton";
import SecondaryButton from "../../../../components/SecondaryButton";
import UploadMultipleFilesInput from "../../../../components/UploadMultipleFilesInput";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const FILTERS_STORAGE_KEY = "restaurantImageUploadFilters";

const BulkRestaurantImagesUpload = () => {
  const axios = useAxiosPrivate();
  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [images, setImages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-for-image-upload"],
    queryFn: async () => {
      const res = await axios.get(`${NOMADS_API_BASE_URL}/restaurants`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

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
    mutationFn: async ({ restaurantId, images }) => {
      const form = new FormData();
      form.append("restaurantId", restaurantId);
      images.forEach((image) => form.append("images", image));

      const res = await axios.post(
        "/api/admin/bulk-upload-restaurant-images",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Restaurant images uploaded successfully");
      setImages([]);
      setRestaurantId("");
      setError(null);
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message || "Restaurant image upload failed";
      toast.error(message);
      setError(message);
    },
  });

  const handleUpload = () => {
    if (!restaurantId) return setError("Please select a restaurant first");
    if (!images.length) return setError("Please select images to upload");

    const tooLarge = images.find((image) => image.size > MAX_BYTES);
    if (tooLarge) {
      return setError(
        `File ${tooLarge.name} is too large (max ${humanSize(MAX_BYTES)})`,
      );
    }

    mutate({ restaurantId, images });
  };

  const handleReset = () => {
    setCountry("");
    setDestination("");
    setRestaurantId("");
    setSearchTerm("");
    setImages([]);
    setError(null);
  };

  return (
    <div className="p-0">
      <div className="py-6 px-0 sm:p-6 flex flex-col gap-6 max-w-2xl mx-auto">
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

            <UploadMultipleFilesInput
              value={images}
              onChange={setImages}
              label="Restaurant Images"
              maxFiles={MAX_FILES}
              allowedExtensions={["webp"]}
              id="bulk-upload-restaurant-images"
              previewType="image"
            />

            <p className="text-xs text-gray-500">
              Accepted type: <code>.webp</code>. Max size:{" "}
              {humanSize(MAX_BYTES)}. Max files: {MAX_FILES}.
            </p>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-4 justify-center">
              <PrimaryButton
                type="button"
                title={isPending ? "Uploading..." : "Upload"}
                handleSubmit={handleUpload}
                isLoading={isPending}
                disabled={!images.length || !restaurantId || isPending}
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

export default BulkRestaurantImagesUpload;

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
