import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const API_BASE = "https://wononomadsbe.vercel.app/api";

const BLOG_ENDPOINTS = [
    `${API_BASE}/blogs`,
    `${API_BASE}/blogs/all-blogs`,
    `${API_BASE}/blogs/get-all-blogs`,
];

const NEWS_ENDPOINTS = [
    `${API_BASE}/news`,
    `${API_BASE}/news/all-news`,
    `${API_BASE}/news/get-all-news`,
];

const COMPANY_ENDPOINTS = [
    `${API_BASE}/company/companiesma`,
    `${API_BASE}/company/companies`,
    `${API_BASE}/company/get-companies`,
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

const normalizeCountry = (row) =>
    `${pickFirst(
        row,
        [
            "country",
            "countryName",
            "locationCountry",
            "location.country",
            "address.country",
        ],
        "Unknown",
    )}`.trim();

const normalizeContinent = (row) =>
    `${pickFirst(
        row,
        ["continent", "continentName", "region", "location.continent"],
        "-",
    )}`.trim();

const normalizeDestination = (row) =>
    `${pickFirst(
        row,
        [
            "destination",
            "destinationName",
            "city",
            "companyCity",
            "locationCity",
            "location.city",
            "address.city",
        ],
        "-",
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
            // try next endpoint
        }
    }
    return [];
};

const BlogsAndNews = () => {
    const axios = useAxiosPrivate();

    const {
        data: statsData = [],
        isPending,
        isError,
    } = useQuery({
        queryKey: ["country-content-stats", "blogs-news"],
        queryFn: async () => {
            const [companies, blogs, news] = await Promise.all([
                fetchFirstSuccessfulArray(axios, COMPANY_ENDPOINTS),
                fetchFirstSuccessfulArray(axios, BLOG_ENDPOINTS),
                fetchFirstSuccessfulArray(axios, NEWS_ENDPOINTS),
            ]);

            const countryMap = new Map();

            const ensureCountry = (
                countryName,
                continentName = "-",
                destinationName = "-",
            ) => {
                const safeCountry = countryName || "Unknown";
                if (!countryMap.has(safeCountry)) {
                    countryMap.set(safeCountry, {
                        country: safeCountry,
                        continent: continentName || "-",
                        destinations: new Set(),
                        blogCount: 0,
                        newsCount: 0,
                    });
                }

                const row = countryMap.get(safeCountry);
                if (row.continent === "-" && continentName && continentName !== "-") {
                    row.continent = continentName;
                }
                if (destinationName && destinationName !== "-") {
                    row.destinations.add(destinationName);
                }

                return row;
            };

            companies.forEach((company) => {
                ensureCountry(
                    normalizeCountry(company),
                    normalizeContinent(company),
                    normalizeDestination(company),
                );
            });

            blogs.forEach((blog) => {
                const row = ensureCountry(
                    normalizeCountry(blog),
                    normalizeContinent(blog),
                    normalizeDestination(blog),
                );
                row.blogCount += 1;
            });

            news.forEach((newsItem) => {
                const row = ensureCountry(
                    normalizeCountry(newsItem),
                    normalizeContinent(newsItem),
                    normalizeDestination(newsItem),
                );
                row.newsCount += 1;
            });

            return Array.from(countryMap.values())
                .sort((a, b) => a.country.localeCompare(b.country))
                .map((row, index) => ({
                    srNo: index + 1,
                    continent: row.continent,
                    country: row.country,
                    destination:
                        row.destinations.size > 0
                            ? Array.from(row.destinations).sort().join(", ")
                            : "-",
                    blogCount: row.blogCount,
                    newsCount: row.newsCount,
                }));
        },
    });

    const columns = useMemo(
        () => [
            { field: "srNo", headerName: "Sr No", width: 100 },
            { field: "continent", headerName: "Continent", flex: 1 },
            { field: "country", headerName: "Country", flex: 1 },
            { field: "destination", headerName: "Destination", flex: 1.5 },
            { field: "blogCount", headerName: "Count Blog", flex: 1 },
            { field: "newsCount", headerName: "Count News", flex: 1 },
        ],
        [],
    );

    return (
        <div className="p-4">
            <PageFrame>
                <AgTable
                    data={statsData}
                    columns={columns}
                    search
                    tableTitle="Blogs and News"
                    tableHeight={500}
                    loading={isPending}
                />
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

