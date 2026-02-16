import React, { useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import StatusChip from "../../../components/StatusChip";
import { queryClient } from "../../../main";

const API_BASE = "https://wononomadsbe.vercel.app/api";
const VITE_DEV_LINK = "http://localhost:5007/api";

const BLOG_ENDPOINTS = [
    `${VITE_DEV_LINK}/blogs`,
    `${VITE_DEV_LINK}/blogs/all-blogs`,
    `${VITE_DEV_LINK}/blogs/get-all-blogs`,
];

const NEWS_ENDPOINTS = [
    `${VITE_DEV_LINK}/news`,
    `${VITE_DEV_LINK}/news/all-news`,
    `${VITE_DEV_LINK}/news/get-all-news`,
];

const COMPANY_ENDPOINTS = [
    `${API_BASE}/company/companies`,
];

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

const normalizeKey = (value) => `${value}`.toLowerCase().replace(/[^a-z0-9]/g, "");

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

        if (looksLikeMatch && value !== undefined && value !== null && `${value}`.trim() !== "") {
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
        pickByLooseKey(row, ["state", "city", "destination", "destinationname", "region"], "-"),
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
    return { allBlogs: [], allNews: [], companies: [] };
};

const BlogsAndNews = () => {
    const { locationType } = useParams();
    const [searchParams] = useSearchParams();
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
        data = { allBlogs: [], allNews: [], companies: [] },
        isPending,
        isError,
    } = useQuery({
        queryKey: ["country-content-stats", "blogs-news-comprehensive"],
        queryFn: async () => {
            const [companies, blogs, news] = await Promise.all([
                fetchFirstSuccessfulArray(axios, COMPANY_ENDPOINTS),
                fetchFirstSuccessfulArray(axios, BLOG_ENDPOINTS),
                fetchFirstSuccessfulArray(axios, NEWS_ENDPOINTS),
            ]);
            return { allBlogs: blogs, allNews: news, companies };
        },
    });

    const stats = useMemo(() => {
        const { allBlogs, allNews, companies } = data;
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

        const ensureDestination = (destinationName, countryName = "Unknown", continentName = "-") => {
            const safeDest = destinationName || "-";
            if (!destinationMap.has(safeDest)) {
                let finalCountry = countryName;
                let finalContinent = continentName;

                if ((finalCountry === "Unknown" || finalCountry === "-") && locationLookup.has(safeDest)) {
                    finalCountry = locationLookup.get(safeDest).country;
                }
                if ((finalContinent === "-") && locationLookup.has(safeDest)) {
                    finalContinent = locationLookup.get(safeDest).continent;
                }

                destinationMap.set(safeDest, {
                    destination: safeDest,
                    country: finalCountry || "Unknown",
                    continent: finalContinent || "-",
                    blogCount: 0,
                    newsCount: 0,
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
                ...row
            }));
    }, [data]);

    const { mutate: toggleStatus, isPending: isTogglePending } = useMutation({
        mutationFn: async ({ id, currentStatus, itemType }) => {
            const endpoint = itemType === "blog" ? "blogs" : "news";
            const newStatus = !currentStatus;

            const response = await axios.patch(`${VITE_DEV_LINK}/${endpoint}/${id}`, {
                isActive: newStatus
            });

            return response.data;
        },
        onMutate: async ({ id, currentStatus, itemType }) => {
            await queryClient.cancelQueries({ queryKey: ["country-content-stats", "blogs-news-comprehensive"] });

            const previousData = queryClient.getQueryData(["country-content-stats", "blogs-news-comprehensive"]);

            queryClient.setQueryData(["country-content-stats", "blogs-news-comprehensive"], (old) => {
                if (!old) return old;
                const field = itemType === "blog" ? "allBlogs" : "allNews";
                return {
                    ...old,
                    [field]: old[field].map((item) =>
                        item._id === id ? { ...item, isActive: !currentStatus } : item
                    ),
                };
            });

            return { previousData };
        },
        onSuccess: () => {
            toast.success("Status updated successfully");
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(["country-content-stats", "blogs-news-comprehensive"], context.previousData);
            }
            console.error("Error toggling status:", err);
            toast.error(err.response?.data?.message || "Failed to update status");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["country-content-stats", "blogs-news-comprehensive"] });
        },
    });

    const handleViewDetail = React.useCallback((location, viewType) => {
        setSelectedLocation(location);
        setDetailType(viewType);
        setCurrentView("detail");
        navigate(`/dashboard/BlogsAndNews/${encodeURIComponent(location)}-${viewType}`);
    }, [navigate]);

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
                        className="text-primary hover:underline font-medium"
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
                        className="text-primary hover:underline font-medium"
                        onClick={() => handleViewDetail(params.data.destination, "news")}
                    >
                        {params.value}
                    </button>
                ),
            },
        ],
        [handleViewDetail],
    );

    const detailColumns = useMemo(
        () => [
            {
                field: "srNo",
                headerName: "Sr No",
                width: 80,
                valueGetter: (params) => params.node.rowIndex + 1,
            },
            { field: "mainTitle", headerName: "Title", flex: 2 },
            { field: "author", headerName: "Author", flex: 1, valueFormatter: (params) => params.value || "-" },
            { field: "source", headerName: "Source", flex: 1, valueFormatter: (params) => params.value || "-" },
            {
                field: "isActive",
                headerName: "Status",
                flex: 1,
                minWidth: 140,
                cellRenderer: (params) => (
                    <StatusChip status={params.value === false ? "Inactive" : "Active"} />
                ),
            },
            {
                headerName: "Action",
                width: 100,
                cellRenderer: (params) => (
                    <ThreeDotMenu
                        rowId={params.data._id}
                        menuItems={[
                            {
                                label: "Edit",
                                onClick: () =>
                                    navigate(`/dashboard/BlogsAndNews/${encodeURIComponent(selectedLocation)}-${detailType}/edit`, {
                                        state: {
                                            item: params.data,
                                            type: detailType,
                                            destinations: stats.map((s) => s.destination),
                                        },
                                    }),
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
            },
        ],
        [detailType, navigate, stats, toggleStatus, selectedLocation],
    );

    const filteredDetailData = useMemo(() => {
        if (currentView !== "detail" || !selectedLocation) return [];
        const source = detailType === "blog" ? data.allBlogs : data.allNews;
        return source.filter((item) => normalizeDestination(item) === selectedLocation);
    }, [currentView, selectedLocation, detailType, data]);

    return (
        <div className="p-4">
            <PageFrame>
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
                            tableTitle={`${detailType === "blog" ? "Blogs" : "News"} in ${selectedLocation}`}
                            tableHeight={500}
                            buttonTitle={`Add ${detailType === "blog" ? "Blog" : "News"}`}
                            handleClick={() =>
                                navigate(`/dashboard/BlogsAndNews/${encodeURIComponent(selectedLocation)}-${detailType}/add`, {
                                    state: {
                                        item: null,
                                        type: detailType,
                                        destinations: stats.map((s) => s.destination),
                                    },
                                })
                            }
                            loading={isPending || isTogglePending}
                        />
                    </div>
                )}
                {isError ? (
                    <p className="pt-3 text-sm text-red-500">
                        Could not load all remote data. Please verify Nomads API connectivity.
                    </p>
                ) : null}
            </PageFrame>
        </div>
    );
};

export default BlogsAndNews;