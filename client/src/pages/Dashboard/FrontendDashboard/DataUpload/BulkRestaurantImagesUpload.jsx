import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MenuItem, TextField } from "@mui/material";
import { toast } from "sonner";
import UploadMultipleFilesInput from "../../../../components/UploadMultipleFilesInput";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";
import { UploadActions, UploadCard, UploadPanel, muiFieldSx } from "./UploadUI";

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const FILTERS_STORAGE_KEY = "restaurantImageUploadFilters";

const REUPLOAD_ENDPOINT = "/api/admin/restaurant-images-reupload";

const BulkRestaurantImagesUpload = ({ reupload = false }) => {
  const filtersKey = reupload ? "restaurantImageReuploadFilters" : FILTERS_STORAGE_KEY;
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [country, setCountry] = useState("");
  const [destination, setDestination] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [images, setImages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);

  const { data: restaurants = [], isLoading, isError } = useQuery({
    queryKey: [reupload ? "restaurants-for-image-reupload" : "restaurants-for-image-upload"],
    queryFn: async () => {
      const res = await axios.get(
        reupload ? REUPLOAD_ENDPOINT : `${NOMADS_API_BASE_URL}/restaurants`,
      );
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
      localStorage.getItem(filtersKey),
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
  }, [restaurants, countries, filtersKey]);

  useEffect(() => {
    if (!restaurants.length) return;

    localStorage.setItem(
      filtersKey,
      JSON.stringify({ country, destination }),
    );
  }, [restaurants, country, destination, filtersKey]);

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
        reupload ? REUPLOAD_ENDPOINT : "/api/admin/bulk-upload-restaurant-images",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data;
    },
    onSuccess: (data) => {
      if (reupload) {
        queryClient.invalidateQueries({ queryKey: ["restaurants-for-image-reupload"] });
      }
      if (data?.cleanupFailed) toast.warning(data.message);
      else toast.success(data?.message || "Restaurant images uploaded successfully");
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

    if (reupload) setError(null);
    mutate({ restaurantId, images });
  };

  const clearReuploadSelection = () => {
    if (!reupload) return;
    setImages([]);
    setError(null);
  };

  const handleReset = () => {
    setCountry("");
    setDestination("");
    setRestaurantId("");
    setSearchTerm("");
    setImages([]);
    setError(null);
  };

  const currentImages = filteredRestaurants.find((item) => item._id === restaurantId)?.images || [];

  return (
    <UploadCard
      title={reupload ? "Restaurant Images Reupload" : "Bulk Restaurant Images Upload"}
      description={
        reupload
          ? "Upload a complete new gallery to replace every current photo. The first new photo becomes the cover."
          : "Pick a restaurant, then upload up to 10 .webp images for it."
      }
    >
      <UploadPanel>
        {isLoading ? (
          <p className="text-xs font-pmedium text-slate-500">Loading restaurants...</p>
        ) : isError ? (
          <p role="alert" className="text-xs font-pmedium text-rose-600">
            Could not load restaurants. Refresh the page to try again.
          </p>
        ) : !restaurants.length ? (
          <p className="text-xs font-pmedium text-slate-500">
            {reupload
              ? "No restaurant galleries are available for reupload yet."
              : "No restaurants are available for image upload yet."}
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
                disabled={reupload && isPending}
                onChange={(e) => {
                  clearReuploadSelection();
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
                  clearReuploadSelection();
                  setDestination(e.target.value);
                  setRestaurantId("");
                  setSearchTerm("");
                }}
                disabled={!country || (reupload && isPending)}
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
                onChange={(e) => {
                  clearReuploadSelection();
                  setRestaurantId(e.target.value);
                }}
                disabled={!destination || (reupload && isPending)}
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
            </div>

            {reupload && currentImages.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                  Current gallery
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {currentImages.map((image, index) => image?.url && (
                    <img
                      key={image._id || index}
                      src={image.url}
                      alt={`Current photo ${index + 1}`}
                      className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-100 object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <UploadMultipleFilesInput
                value={images}
                onChange={setImages}
                label={reupload ? "New Restaurant Images" : "Restaurant Images"}
                maxFiles={MAX_FILES}
                allowedExtensions={["webp"]}
                id={reupload ? "restaurant-images-reupload" : "bulk-upload-restaurant-images"}
                disabled={reupload && isPending}
                previewType="image"
                dataTour="data-upload-dropzone"
                variant="spacious"
                lockPickerAtLimit
              />
            </div>

            <p className="text-xs font-pmedium text-gray-500">
              Accepted type: <code>.webp</code>. Max size:{" "}
              {humanSize(MAX_BYTES)}. Max files: {MAX_FILES}.
            </p>

            {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}

            <div className="mt-4" data-tour="data-upload-actions">
              <UploadActions
                onUpload={handleUpload}
                onReset={handleReset}
                uploadLabel={reupload ? "Replace Gallery" : "Upload"}
                pending={isPending}
                uploadDisabled={!images.length || !restaurantId || isPending}
                resetDisabled={isPending}
              />
            </div>
          </>
        )}
      </UploadPanel>
    </UploadCard>
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
