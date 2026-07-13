import React, { useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import StatusChip from "../../../components/StatusChip";
import { queryClient } from "../../../main";
import { NOMADS_BACKEND_URL, NOMADS_API_BASE_URL } from "../../../constants/api";

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

// Keep the existing Event Count source independent from the event-management APIs.
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
      navigate(
        `/dashboard/BlogsAndNews/${encodeURIComponent(location)}-${viewType}`,
      );
    },
    [navigate],
  );

  const summaryColumns = useMemo(
    () => [
      { field: "srNo", headerName: "Sr No", width: 80 },
      { field: "continent", headerName: "Continent", flex: 1 },
      { field: "country", headerName: "Country", flex: 1 },
      { field: "destination", headerName: "Destination", flex: 1.5 },
      {
        field: "blogCount",
        headerName: "Count Blog",
        flex: 1,
        cellRenderer: (params) => (
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => handleViewDetail(params.data.destination, "blog")}
          >
            {params.value}
          </button>
        ),
      },
      {
        field: "newsCount",
        headerName: "Count News",
        flex: 1,
        cellRenderer: (params) => (
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => handleViewDetail(params.data.destination, "news")}
          >
            {params.value}
          </button>
        ),
      },
      {
        field: "eventCount",
        headerName: "Event Count",
        flex: 1,
        cellRenderer: (params) => (
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => handleViewDetail(params.data.destination, "event")}
          >
            {params.value}
          </button>
        ),
      },
      {
        field: "placeCount",
        headerName: "Places",
        flex: 1,
        cellRenderer: (params) => (
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => handleViewDetail(params.data.destination, "place")}
          >
            {params.value}
          </button>
        ),
      },
      {
        field: "restaurantCount",
        headerName: "Restaurants",
        flex: 1,
        cellRenderer: (params) => (
          <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() =>
              handleViewDetail(params.data.destination, "restaurant")
            }
          >
            {params.value}
          </button>
        ),
      },
    ],
    [handleViewDetail],
  );

  const detailColumns = useMemo(() => {
    const serialNumberColumn = {
      field: "srNo",
      headerName: "Sr No",
      width: 80,
      lockPinned: true,
      pinned: "left",
      valueGetter: (params) => params.node.rowIndex + 1,
    };

    const statusColumn = {
      field: "isActive",
      headerName: "Status",
      flex: 1,
      minWidth: 140,
      cellRenderer: (params) => (
        <StatusChip status={params.value === false ? "Inactive" : "Active"} />
      ),
    };

    const actionColumn = {
      headerName: "Action",
      width: 100,
      pinned: "right",
      lockPinned: true,
      cellRenderer: (params) => (
        <ThreeDotMenu
          rowId={params.data._id}
          menuItems={[
            {
              label: "Edit",
              onClick: () =>
                navigate(
                  `/dashboard/BlogsAndNews/${encodeURIComponent(selectedLocation)}-${detailType}/edit`,
                  {
                    state: {
                      item: params.data,
                      type: detailType,
                      destinations: stats.map((s) => s.destination),
                    },
                  },
                ),
            },
            params.data.isActive !== false
              ? {
                  label: "Mark As Inactive",
                  onClick: () =>
                    toggleStatus({
                      id: params.data._id,
                      currentStatus: params.data.isActive !== false,
                      itemType: detailType,
                    }),
                }
              : {
                  label: "Mark As Active",
                  onClick: () =>
                    toggleStatus({
                      id: params.data._id,
                      currentStatus: params.data.isActive !== false,
                      itemType: detailType,
                    }),
                },
          ]}
        />
      ),
    };

    if (detailType === "place") {
      return [
        serialNumberColumn,
        { field: "placeName", headerName: "Place Name", flex: 2 },
        {
          field: "category",
          headerName: "Category",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "rating",
          headerName: "Rating",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "address",
          headerName: "Address",
          flex: 2,
          valueFormatter: (params) => params.value || "-",
        },
        statusColumn,
        actionColumn,
      ];
    }

    if (detailType === "restaurant") {
      return [
        serialNumberColumn,
        { field: "restaurantName", headerName: "Restaurant Name", flex: 2 },
        {
          field: "restaurantType",
          headerName: "Type",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "rating",
          headerName: "Rating",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "address",
          headerName: "Address",
          flex: 2,
          valueFormatter: (params) => params.value || "-",
        },
        statusColumn,
        actionColumn,
      ];
    }

    if (detailType === "event") {
      return [
        serialNumberColumn,
        { field: "eventName", headerName: "Event Name", flex: 2 },
        {
          field: "category",
          headerName: "Category",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "month",
          headerName: "Month",
          flex: 1,
          valueFormatter: (params) => params.value || "-",
        },
        {
          field: "venue",
          headerName: "Venue",
          flex: 1.5,
          valueFormatter: (params) => params.value || "-",
        },
        statusColumn,
        actionColumn,
      ];
    }

    return [
      serialNumberColumn,
      { field: "mainTitle", headerName: "Title", flex: 2 },
      {
        field: "author",
        headerName: "Author",
        flex: 1,
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "source",
        headerName: "Source",
        flex: 1,
        valueFormatter: (params) => params.value || "-",
      },
      statusColumn,
      actionColumn,
    ];
  }, [detailType, navigate, stats, toggleStatus, selectedLocation]);

  const filteredDetailData = useMemo(() => {
    if (currentView !== "detail" || !selectedLocation) return [];
    if (detailType === "event") return destinationEvents;
    if (detailType === "place") return destinationPlaces;
    if (detailType === "restaurant") return destinationRestaurants;
    const source =
      detailType === "blog"
        ? Array.isArray(data?.allBlogs)
          ? data.allBlogs
          : []
        : Array.isArray(data?.allNews)
          ? data.allNews
          : [];
    return source.filter(
      (item) => normalizeDestination(item) === selectedLocation,
    );
  }, [
    currentView,
    selectedLocation,
    detailType,
    data,
    destinationEvents,
    destinationPlaces,
    destinationRestaurants,
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

  return (
    <div>
      <>
        {currentView === "summary" ? (
          <AgTable
            data={stats}
            columns={summaryColumns}
            search
            tableTitle="Blogs and News"
            tableHeight={500}
            loading={isPending}
          />
        ) : (
          <div>
            <AgTable
              data={filteredDetailData}
              columns={detailColumns}
              search
              tableTitle={`${detailLabel} in ${selectedLocation}`}
              tableHeight={500}
              buttonTitle={`Add ${
                detailType === "blog"
                  ? "Blog"
                  : detailType === "news"
                    ? "News"
                    : detailType === "place"
                      ? "Place"
                      : detailType === "restaurant"
                        ? "Restaurant"
                        : "Event"
              }`}
              handleClick={() =>
                navigate(
                  `/dashboard/BlogsAndNews/${encodeURIComponent(selectedLocation)}-${detailType}/add`,
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
              loading={
                isPending ||
                isTogglePending ||
                (detailType === "event" && isDestinationEventsPending) ||
                (detailType === "place" && isDestinationPlacesPending) ||
                (detailType === "restaurant" &&
                  isDestinationRestaurantsPending)
              }
            />
          </div>
        )}
        {isError ||
        isDestinationEventsError ||
        isDestinationPlacesError ||
        isDestinationRestaurantsError ? (
          <p className="pt-3 text-sm text-red-500">
            Could not load all remote data. Please verify Nomads API
            connectivity.
          </p>
        ) : null}
      </>
    </div>
  );
};

export default BlogsAndNews;
