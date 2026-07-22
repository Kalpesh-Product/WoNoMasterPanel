import React, { useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Eye, ArrowLeft, Plus, MapPin, Calendar, Utensils } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import { queryClient } from "../../../main";
import { NOMADS_BACKEND_URL, NOMADS_API_BASE_URL } from "../../../constants/api";
import { statusPillClass } from "../../../lib/status-pill";

const BLOG_ENDPOINTS = [
  "/api/blogs",
  "/api/blogs/all-blogs",
  "/api/blogs/get-all-blogs",
];

const NEWS_ENDPOINTS = [
  "/api/news",
  "/api/news/all-news",
  "/api/news/get-all-news",
];

const EVENT_ENDPOINTS = [`${NOMADS_API_BASE_URL}/events`];
const EVENT_API_BASE_URL = NOMADS_BACKEND_URL;

const PLACE_ENDPOINTS = [`${NOMADS_API_BASE_URL}/places`];
const PLACE_API_BASE_URL = NOMADS_BACKEND_URL;

const RESTAURANT_ENDPOINTS = [`${NOMADS_API_BASE_URL}/restaurants`];
const RESTAURANT_API_BASE_URL = NOMADS_BACKEND_URL;

const COMPANY_ENDPOINTS = ["/api/hosts/companies"];

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.companies)) return payload.companies;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const getByPath = (obj, path) => {
  const keys = path.split(".");
  let cur = obj;
  for (const key of keys) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
};

const pickFirst = (obj, keys, fallback = "-") => {
  for (const key of keys) {
    const value = key.includes(".") ? getByPath(obj, key) : obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }
  return fallback;
};

const normalizeKey = (value) =>
  `${value}`.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByLooseKey = (obj, preferredKeys, fallback = "-") => {
  if (!obj || typeof obj !== "object") return fallback;

  const allEntries = Object.entries(obj);
  const normalizedPreferredKeys = new Set(preferredKeys.map(normalizeKey));

  for (const [key, value] of allEntries) {
    const normalizedKey = normalizeKey(key);
    const looksLikeMatch =
      normalizedPreferredKeys.has(normalizedKey) ||
      [...normalizedPreferredKeys].some((preferredKey) =>
        normalizedKey.endsWith(preferredKey),
      );

    if (
      looksLikeMatch &&
      value !== undefined &&
      value !== null &&
      `${value}`.trim() !== ""
    ) {
      return `${value}`.trim();
    }
  }

  return fallback;
};

const normalizeCountry = (row) =>
  `${pickFirst(
    row,
    [
      "country",
      "countryName",
      "country_name",
      "locationCountry",
      "location.country",
      "address.country",
      "companyCountry",
    ],
    pickByLooseKey(row, ["country", "countryname"], "Unknown"),
  )}`.trim();

const normalizeContinent = (row) =>
  `${pickFirst(
    row,
    [
      "continent",
      "continentName",
      "continent_name",
      "region",
      "location.continent",
      "companyContinent",
    ],
    pickByLooseKey(row, ["continent", "continentname", "region"], "-"),
  )}`.trim();

const normalizeDestination = (row) =>
  `${pickFirst(
    row,
    [
      "state",
      "companyState",
      "city",
      "companyCity",
      "destination",
      "destinationName",
      "destination_name",
      "region",
      "location.destination",
    ],
    pickByLooseKey(
      row,
      ["state", "city", "destination", "destinationname", "region"],
      "-",
    ),
  )}`.trim();

const fetchFirstSuccessfulArray = async (axios, endpoints) => {
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint);
      const arr = toArray(response.data);
      if (arr.length || endpoint === endpoints[endpoints.length - 1]) {
        return arr;
      }
    } catch (error) {
      console.log(error);
    }
  }
  return [];
};

const BlogsAndNews = () => {
  const { locationType } = useParams();
  const navigate = useNavigate();
  const axios = useAxiosPrivate();

  const [currentView, setCurrentView] = React.useState("summary");
  const [detailType, setDetailType] = React.useState("blog");
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  useEffect(() => {
    if (locationType) {
      const dashIndex = locationType.lastIndexOf("-");
      if (dashIndex !== -1) {
        const loc = locationType.substring(0, dashIndex);
        const t = locationType.substring(dashIndex + 1);
        setSelectedLocation(loc);
        setDetailType(t);
        setCurrentView("detail");
      }
    } else {
      setCurrentView("summary");
      setSelectedLocation("All");
      setDetailType("blog");
    }
  }, [locationType]);

  const {
    data = {
      allBlogs: [],
      allNews: [],
      allEvents: [],
      allPlaces: [],
      allRestaurants: [],
      companies: [],
    },
    isPending,
    isError,
  } = useQuery({
    queryKey: ["country-content-stats", "blogs-news-comprehensive"],
    queryFn: async () => {
      const [companies, blogs, news, events, places, restaurants] =
        await Promise.all([
          fetchFirstSuccessfulArray(axios, COMPANY_ENDPOINTS),
          fetchFirstSuccessfulArray(axios, BLOG_ENDPOINTS),
          fetchFirstSuccessfulArray(axios, NEWS_ENDPOINTS),
          fetchFirstSuccessfulArray(axios, EVENT_ENDPOINTS),
          fetchFirstSuccessfulArray(axios, PLACE_ENDPOINTS),
          fetchFirstSuccessfulArray(axios, RESTAURANT_ENDPOINTS),
        ]);
      return {
        allBlogs: blogs,
        allNews: news,
        allEvents: events,
        allPlaces: places,
        allRestaurants: restaurants,
        companies,
      };
    },
  });

  const {
    data: destinationEvents = [],
    isPending: isDestinationEventsPending,
    isError: isDestinationEventsError,
  } = useQuery({
    queryKey: ["destination-events", selectedLocation],
    queryFn: async () => {
      const response = await axios.get(
        `${EVENT_API_BASE_URL}/api/events/destination/${encodeURIComponent(selectedLocation)}`,
      );
      return toArray(response.data);
    },
    enabled:
      currentView === "detail" &&
      detailType === "event" &&
      Boolean(selectedLocation),
  });

  const {
    data: destinationPlaces = [],
    isPending: isDestinationPlacesPending,
    isError: isDestinationPlacesError,
  } = useQuery({
    queryKey: ["destination-places", selectedLocation],
    queryFn: async () => {
      const response = await axios.get(
        `${PLACE_API_BASE_URL}/api/places/destination/${encodeURIComponent(selectedLocation)}`,
      );
      return toArray(response.data);
    },
    enabled:
      currentView === "detail" &&
      detailType === "place" &&
      Boolean(selectedLocation),
  });

  const {
    data: destinationRestaurants = [],
    isPending: isDestinationRestaurantsPending,
    isError: isDestinationRestaurantsError,
  } = useQuery({
    queryKey: ["destination-restaurants", selectedLocation],
    queryFn: async () => {
      const response = await axios.get(
        `${RESTAURANT_API_BASE_URL}/api/restaurants/destination/${encodeURIComponent(selectedLocation)}`,
      );
      return toArray(response.data);
    },
    enabled:
      currentView === "detail" &&
      detailType === "restaurant" &&
      Boolean(selectedLocation),
  });

  const stats = useMemo(() => {
    const allBlogs = Array.isArray(data?.allBlogs) ? data.allBlogs : [];
    const allNews = Array.isArray(data?.allNews) ? data.allNews : [];
    const allEvents = Array.isArray(data?.allEvents) ? data.allEvents : [];
    const allPlaces = Array.isArray(data?.allPlaces) ? data.allPlaces : [];
    const allRestaurants = Array.isArray(data?.allRestaurants)
      ? data.allRestaurants
      : [];
    const companies = Array.isArray(data?.companies) ? data.companies : [];
    const destinationMap = new Map();
    const locationLookup = new Map();

    companies.forEach((company) => {
      const country = normalizeCountry(company);
      const continent = normalizeContinent(company);
      const city = (company.city || company.companyCity || "").trim();
      const state = (company.state || company.companyState || "").trim();

      if (city && city !== "-" && !locationLookup.has(city)) {
        locationLookup.set(city, { country, continent });
      }
      if (state && state !== "-" && !locationLookup.has(state)) {
        locationLookup.set(state, { country, continent });
      }
    });

    const ensureDestination = (
      destinationName,
      countryName = "Unknown",
      continentName = "-",
    ) => {
      const safeDest = destinationName || "-";
      if (!destinationMap.has(safeDest)) {
        let finalCountry = countryName;
        let finalContinent = continentName;

        if (
          (finalCountry === "Unknown" || finalCountry === "-") &&
          locationLookup.has(safeDest)
        ) {
          finalCountry = locationLookup.get(safeDest).country;
        }
        if (finalContinent === "-" && locationLookup.has(safeDest)) {
          finalContinent = locationLookup.get(safeDest).continent;
        }

        destinationMap.set(safeDest, {
          destination: safeDest,
          country: finalCountry || "Unknown",
          continent: finalContinent || "-",
          blogCount: 0,
          newsCount: 0,
          eventCount: 0,
          placeCount: 0,
          restaurantCount: 0,
        });
      }
      return destinationMap.get(safeDest);
    };

    companies.forEach((company) => {
      ensureDestination(
        normalizeDestination(company),
        normalizeCountry(company),
        normalizeContinent(company),
      );
    });

    allBlogs.forEach((blog) => {
      if (blog.isActive === false) return;
      const row = ensureDestination(
        normalizeDestination(blog),
        normalizeCountry(blog),
        normalizeContinent(blog),
      );
      row.blogCount += 1;
    });

    allNews.forEach((newsItem) => {
      if (newsItem.isActive === false) return;
      const row = ensureDestination(
        normalizeDestination(newsItem),
        normalizeCountry(newsItem),
        normalizeContinent(newsItem),
      );
      row.newsCount += 1;
    });

    allEvents.forEach((event) => {
      if (event.isActive === false) return;
      const row = ensureDestination(
        normalizeDestination(event),
        normalizeCountry(event),
        normalizeContinent(event),
      );
      row.eventCount += 1;
    });

    allPlaces.forEach((place) => {
      if (place.isActive === false) return;
      const row = ensureDestination(
        normalizeDestination(place),
        normalizeCountry(place),
        normalizeContinent(place),
      );
      row.placeCount += 1;
    });

    allRestaurants.forEach((restaurant) => {
      if (restaurant.isActive === false) return;
      const row = ensureDestination(
        normalizeDestination(restaurant),
        normalizeCountry(restaurant),
        normalizeContinent(restaurant),
      );
      row.restaurantCount += 1;
    });

    return Array.from(destinationMap.values())
      .sort((a, b) => {
        const contComp = a.continent.localeCompare(b.continent);
        if (contComp !== 0) return contComp;
        const countryComp = a.country.localeCompare(b.country);
        if (countryComp !== 0) return countryComp;
        return a.destination.localeCompare(b.destination);
      })
      .map((row, index) => ({
        srNo: index + 1,
        ...row,
      }));
  }, [data]);

  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return stats;
    const q = searchQuery.trim().toLowerCase();
    return stats.filter(
      (s) =>
        s.destination?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.continent?.toLowerCase().includes(q),
    );
  }, [stats, searchQuery]);

  const { mutate: toggleStatus, isPending: isTogglePending } = useMutation({
    mutationFn: async ({ id, currentStatus, itemType }) => {
      const newStatus = !currentStatus;

      const response =
        itemType === "event" ||
        itemType === "place" ||
        itemType === "restaurant"
          ? await axios.patch(
              itemType === "restaurant"
                ? `${RESTAURANT_API_BASE_URL}/api/restaurants/${id}/status`
                : `${NOMADS_API_BASE_URL}/${itemType === "event" ? "events" : "places"}/${id}/status`,
              {
                isActive: newStatus,
              },
            )
          : await axios.patch(
              `/api/${itemType === "blog" ? "blogs" : "news"}/${id}`,
              {
                isActive: newStatus,
              },
            );

      return response.data;
    },
    onMutate: async ({ id, currentStatus, itemType }) => {
      await queryClient.cancelQueries({
        queryKey: ["country-content-stats", "blogs-news-comprehensive"],
      });

      const previousData = queryClient.getQueryData([
        "country-content-stats",
        "blogs-news-comprehensive",
      ]);

      queryClient.setQueryData(
        ["country-content-stats", "blogs-news-comprehensive"],
        (old) => {
          if (!old) return old;
          const field =
            itemType === "blog"
              ? "allBlogs"
              : itemType === "news"
                ? "allNews"
                : itemType === "place"
                  ? "allPlaces"
                  : itemType === "restaurant"
                    ? "allRestaurants"
                    : "allEvents";
          return {
            ...old,
            [field]: old[field].map((item) =>
              item._id === id ? { ...item, isActive: !currentStatus } : item,
            ),
          };
        },
      );

      return { previousData };
    },
    onSuccess: () => {
      toast.success("Status updated successfully");
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["country-content-stats", "blogs-news-comprehensive"],
          context.previousData,
        );
      }
      console.error("Error toggling status:", err);
      toast.error(err.response?.data?.message || "Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["country-content-stats", "blogs-news-comprehensive"],
      });
      queryClient.invalidateQueries({ queryKey: ["destination-events"] });
      queryClient.invalidateQueries({ queryKey: ["destination-places"] });
      queryClient.invalidateQueries({ queryKey: ["destination-restaurants"] });
    },
  });

  const handleViewDetail = React.useCallback(
    (location, viewType) => {
      setSelectedLocation(location);
      setDetailType(viewType);
      setCurrentView("detail");
      setSearchQuery("");
      navigate(
        `/dashboard/destinations-data/${encodeURIComponent(location)}-${viewType}`,
      );
    },
    [navigate],
  );

  const handleBackToSummary = () => {
    setCurrentView("summary");
    setSelectedLocation("All");
    setDetailType("blog");
    setSearchQuery("");
    navigate("/dashboard/destinations-data");
  };

  const filteredDetailData = useMemo(() => {
    if (currentView !== "detail" || !selectedLocation) return [];
    let source;
    if (detailType === "event") source = destinationEvents;
    else if (detailType === "place") source = destinationPlaces;
    else if (detailType === "restaurant") source = destinationRestaurants;
    else if (detailType === "blog")
      source = Array.isArray(data?.allBlogs) ? data.allBlogs : [];
    else source = Array.isArray(data?.allNews) ? data.allNews : [];

    let filtered = source.filter(
      (item) => normalizeDestination(item) === selectedLocation,
    );

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        const name =
          item.placeName ||
          item.restaurantName ||
          item.eventName ||
          item.mainTitle ||
          "";
        return name.toLowerCase().includes(q);
      });
    }

    return filtered;
  }, [
    currentView,
    selectedLocation,
    detailType,
    data,
    destinationEvents,
    destinationPlaces,
    destinationRestaurants,
    searchQuery,
  ]);

  const detailLabel =
    detailType === "blog"
      ? "Blogs"
      : detailType === "news"
        ? "News"
        : detailType === "place"
          ? "Places"
          : detailType === "restaurant"
            ? "Restaurants"
            : "Events";

  const detailNameField =
    detailType === "place"
      ? "placeName"
      : detailType === "restaurant"
        ? "restaurantName"
        : detailType === "event"
          ? "eventName"
          : "mainTitle";

  const detailSecondaryField =
    detailType === "place"
      ? "category"
      : detailType === "restaurant"
        ? "restaurantType"
        : detailType === "event"
          ? "category"
          : "author";

  const detailThirdField =
    detailType === "place"
      ? "rating"
      : detailType === "restaurant"
        ? "rating"
        : detailType === "event"
          ? "month"
          : "source";

  const detailFourthField =
    detailType === "place" || detailType === "restaurant"
      ? "address"
      : detailType === "event"
        ? "venue"
        : null;

  const addLabel =
    detailType === "blog"
      ? "Blog"
      : detailType === "news"
        ? "News"
        : detailType === "place"
          ? "Place"
          : detailType === "restaurant"
            ? "Restaurant"
            : "Event";

  const isLoading =
    isPending ||
    isTogglePending ||
    (detailType === "event" && isDestinationEventsPending) ||
    (detailType === "place" && isDestinationPlacesPending) ||
    (detailType === "restaurant" && isDestinationRestaurantsPending);

  const hasError =
    isError ||
    isDestinationEventsError ||
    isDestinationPlacesError ||
    isDestinationRestaurantsError;

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">

          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                {currentView === "detail" && (
                  <button
                    type="button"
                    onClick={handleBackToSummary}
                    className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all mr-1"
                  >
                    <ArrowLeft size={15} />
                  </button>
                )}
                {currentView === "summary" ? "Destinations Data" : `${detailLabel} in ${selectedLocation}`}
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                {currentView === "summary"
                  ? "Overview of content across all destinations like blogs, news, places, restaurants, and events."
                  : `Managing ${detailLabel.toLowerCase()} for ${selectedLocation}.`}
              </p>
            </div>
            {currentView === "detail" && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/dashboard/destinations-data/${encodeURIComponent(selectedLocation)}-${detailType}/add`,
                    {
                      state: {
                        item: null,
                        type: detailType,
                        destinations: stats.map((s) => s.destination),
                        selectedLocation,
                      },
                    },
                  )
                }
                className="bg-[#2563EB] text-white px-4 py-2.5 rounded-2xl font-pmedium text-[10px] flex items-center gap-1.5 shadow-sm hover:bg-primary/95 active:scale-95 transition-all whitespace-nowrap"
              >
                <Plus size={13} strokeWidth={3} /> ADD {addLabel.toUpperCase()}
              </button>
            )}
          </div>

          {currentView === "summary" && (
            isPending ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 shrink-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse">
                    <div className="h-2.5 bg-slate-200 rounded-full w-24 mb-3" />
                    <div className="h-4 bg-slate-200 rounded-full w-12" />
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 shrink-0">
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Total Destinations</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.length}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-blue-500">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Total Blogs</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.reduce((acc, s) => acc + s.blogCount, 0)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Total News</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.reduce((acc, s) => acc + s.newsCount, 0)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-violet-500">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-violet-600 uppercase tracking-widest mb-1">Total Events</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.reduce((acc, s) => acc + s.eventCount, 0)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Total Places</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.reduce((acc, s) => acc + s.placeCount, 0)}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-rose-500">
                <div className="min-w-0">
                  <p className="text-[10px] font-pmedium text-rose-600 uppercase tracking-widest mb-1">Total Restaurants</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{stats.reduce((acc, s) => acc + s.restaurantCount, 0)}</p>
                </div>
              </div>
            </div>
            )
          )}

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
              <div className="w-full xl:max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder={currentView === "summary" ? "Search destinations..." : `Search ${detailLabel.toLowerCase()}...`}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              {isPending || (currentView === "detail" && isLoading) ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="h-3 bg-slate-200 rounded-full w-8" />
                      <div className="h-3 bg-slate-200 rounded-full w-24" />
                      <div className="h-3 bg-slate-200 rounded-full w-20" />
                      <div className="h-3 bg-slate-200 rounded-full w-32" />
                      <div className="h-3 bg-slate-200 rounded-full w-12 ml-auto" />
                      <div className="h-3 bg-slate-200 rounded-full w-12" />
                      <div className="h-3 bg-slate-200 rounded-full w-12" />
                      <div className="h-3 bg-slate-200 rounded-full w-12" />
                      <div className="h-3 bg-slate-200 rounded-full w-12" />
                    </div>
                  ))}
                </div>
              ) : currentView === "summary" ? (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Sr No</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Continent</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Country</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Destination</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Blogs</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">News</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Events</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Places</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Restaurants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStats.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 text-slate-400 font-pmedium">No destinations found.</td>
                      </tr>
                    ) : (
                      filteredStats.map((row) => (
                        <tr key={row.destination} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.srNo}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.continent}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.country}</td>
                          <td className="px-5 py-4 align-top font-pmedium text-[#0F172A] text-[13px]">{row.destination}</td>
                          <td className="px-5 py-4 align-top text-center">
                            <button className="text-blue-600 hover:underline font-pmedium" onClick={() => handleViewDetail(row.destination, "blog")}>{row.blogCount}</button>
                          </td>
                          <td className="px-5 py-4 align-top text-center">
                            <button className="text-blue-600 hover:underline font-pmedium" onClick={() => handleViewDetail(row.destination, "news")}>{row.newsCount}</button>
                          </td>
                          <td className="px-5 py-4 align-top text-center">
                            <button className="text-blue-600 hover:underline font-pmedium" onClick={() => handleViewDetail(row.destination, "event")}>{row.eventCount}</button>
                          </td>
                          <td className="px-5 py-4 align-top text-center">
                            <button className="text-blue-600 hover:underline font-pmedium" onClick={() => handleViewDetail(row.destination, "place")}>{row.placeCount}</button>
                          </td>
                          <td className="px-5 py-4 align-top text-center">
                            <button className="text-blue-600 hover:underline font-pmedium" onClick={() => handleViewDetail(row.destination, "restaurant")}>{row.restaurantCount}</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Sr No</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Name</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">{detailType === "event" ? "Category" : detailType === "restaurant" ? "Type" : "Category"}</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">{detailType === "event" ? "Month" : "Rating"}</th>
                      {detailFourthField && (
                        <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">{detailType === "event" ? "Venue" : "Address"}</th>
                      )}
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetailData.length === 0 ? (
                      <tr>
                        <td colSpan={detailFourthField ? 7 : 6} className="text-center py-20 text-slate-400 font-pmedium">No {detailLabel.toLowerCase()} found.</td>
                      </tr>
                    ) : (
                      filteredDetailData.map((item, index) => (
                        <tr key={item._id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{index + 1}</td>
                          <td className="px-5 py-4 align-top font-pmedium text-[#0F172A] text-[13px] truncate max-w-[200px]">{item[detailNameField] || "-"}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{item[detailSecondaryField] || "-"}</td>
                          <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{item[detailThirdField] || "-"}</td>
                          {detailFourthField && (
                            <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 truncate max-w-[200px]">{item[detailFourthField] || "-"}</td>
                          )}
                          <td className="px-5 py-4 align-top text-center">
                            <span className={statusPillClass(item.isActive === false ? "Inactive" : "Active")}>
                              {item.isActive === false ? "Inactive" : "Active"}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <ThreeDotMenu
                                rowId={item._id}
                                menuItems={[
                                  {
                                    label: "Edit",
                                    onClick: () =>
                                      navigate(
                                        `/dashboard/destinations-data/${encodeURIComponent(selectedLocation)}-${detailType}/edit`,
                                        {
                                          state: {
                                            item,
                                            type: detailType,
                                            destinations: stats.map((s) => s.destination),
                                          },
                                        },
                                      ),
                                  },
                                  item.isActive !== false
                                    ? {
                                        label: "Mark As Inactive",
                                        onClick: () =>
                                          toggleStatus({
                                            id: item._id,
                                            currentStatus: item.isActive !== false,
                                            itemType: detailType,
                                          }),
                                      }
                                    : {
                                        label: "Mark As Active",
                                        onClick: () =>
                                          toggleStatus({
                                            id: item._id,
                                            currentStatus: item.isActive !== false,
                                            itemType: detailType,
                                          }),
                                      },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {hasError && (
            <p className="pt-3 text-sm text-red-500">
              Could not load all remote data. Please verify Nomads API connectivity.
            </p>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default BlogsAndNews;
