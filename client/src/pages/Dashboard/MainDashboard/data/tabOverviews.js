import {
  Users,
  UserPlus,
  Building2,
  Globe,
  MessageSquareText,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  Star,
  Target,
  CalendarDays,
  CreditCard,
  ShieldCheck,
  Ticket,
  Newspaper,
  Plane,
  UserRound,
  BarChart3,
  ScrollText,
  LifeBuoy,
  PlaneTakeoff,
  UtensilsCrossed,
  Activity,
} from "lucide-react";
import { NOMADS_BACKEND_URL, NOMADS_API_BASE_URL } from "../../../../constants/api";

const VALUE_ADDS_API_BASE_URL =
  import.meta.env.VITE_VALUE_ADDS_API_BASE_URL || NOMADS_BACKEND_URL;
import {
  countBy,
  topN,
  distinctCount,
  sumBy,
  monthlyTrend,
  countSince,
  countThisMonth,
  countToday,
  firstNonEmpty,
  actorName,
  countVerticals,
  flatten,
  pickArray,
  pickDataArray,
  pickItems,
  pickData,
  pickGenericArray,
  pickReviews,
} from "./aggregate";

const statusLabels = (pending, contacted, closed, rejected) => ({
  pending,
  contacted,
  closed,
  rejected,
});

const COMPANIES_OVERVIEW = {
  sources: [
    {
      key: "companies",
      url: "/api/hosts/companies",
      params: { page: 1, limit: 100 },
      pick: pickData,
    },
  ],
  cards: [
    { label: "Total Companies", value: ({ data }) => data.companies.counts?.total ?? 0, icon: Building2, tone: 0 },
    { label: "Active", value: ({ data }) => data.companies.counts?.active ?? 0, icon: CheckCircle2, tone: 1 },
    { label: "Inactive", value: ({ data }) => data.companies.counts?.inactive ?? 0, icon: AlertCircle, tone: 2 },
    { label: "Countries", value: ({ data }) => distinctCount(data.companies.items, "companyCountry"), icon: Globe, tone: 3 },
  ],
  charts: [
    {
      title: "Status Distribution",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Active", value: data.companies.counts?.active ?? 0 },
          { label: "Inactive", value: data.companies.counts?.inactive ?? 0 },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Top Cities",
      type: "bars",
      build: ({ data }) => topN(countBy(data.companies.items, "companyCity"), 6),
    },
    {
      title: "Continent Distribution",
      type: "donut",
      build: ({ data }) => countBy(data.companies.items, "companyContinent"),
    },
    {
      title: "Top Countries",
      type: "bars",
      build: ({ data }) => topN(countBy(data.companies.items, "companyCountry"), 6),
    },
  ],
};

const REVIEWS_OVERVIEW = {
  sources: [
    {
      key: "nomadReviews",
      url: "/api/admin/reviews",
      params: { reviewScope: "nomads", allCompanies: true },
      pick: pickReviews,
    },
    {
      key: "eventReviews",
      url: `${NOMADS_API_BASE_URL}/event-reviews/all`,
      auth: "public",
      pick: pickDataArray,
    },
    {
      key: "placeReviews",
      url: `${NOMADS_API_BASE_URL}/place-reviews/all`,
      auth: "public",
      pick: pickDataArray,
    },
  ],
  cards: [
    {
      label: "Total Reviews",
      value: ({ data }) =>
        data.nomadReviews.length + data.eventReviews.length + data.placeReviews.length,
      icon: Star,
      tone: 0,
    },
    {
      label: "Pending",
      value: ({ data }) =>
        flatten(data.nomadReviews, data.eventReviews, data.placeReviews).filter(
          (r) => String(r?.status || "pending").toLowerCase() === "pending",
        ).length,
      icon: Clock,
      tone: 1,
    },
    {
      label: "Approved",
      value: ({ data }) =>
        flatten(data.nomadReviews, data.eventReviews, data.placeReviews).filter(
          (r) => String(r?.status || "").toLowerCase() === "approved",
        ).length,
      icon: CheckCircle2,
      tone: 2,
    },
    {
      label: "Rejected",
      value: ({ data }) =>
        flatten(data.nomadReviews, data.eventReviews, data.placeReviews).filter(
          (r) => String(r?.status || "").toLowerCase() === "rejected",
        ).length,
      icon: AlertCircle,
      tone: 3,
    },
  ],
  charts: [
    {
      title: "Review Status",
      type: "donut",
      build: ({ data }) =>
        countBy(
          flatten(data.nomadReviews, data.eventReviews, data.placeReviews),
          (r) => r?.status || "pending",
          { pending: "Pending", approved: "Approved", rejected: "Rejected" },
        ),
    },
    {
      title: "Rating Distribution",
      type: "bars",
      build: ({ data }) => {
        const all = flatten(data.nomadReviews, data.eventReviews, data.placeReviews);
        return [5, 4, 3, 2, 1]
          .map((rating) => ({
            label: `${rating}★`,
            value: all.filter((r) => Number(r?.rating) === rating).length,
          }))
          .filter((d) => d.value > 0);
      },
    },
    {
      title: "Review Source",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Nomad Listings", value: data.nomadReviews.length },
          { label: "Events", value: data.eventReviews.length },
          { label: "Places", value: data.placeReviews.length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Monthly Review Trend",
      type: "bars",
      build: ({ data }) =>
        monthlyTrend(flatten(data.nomadReviews, data.eventReviews, data.placeReviews)),
    },
  ],
};

export const TAB_OVERVIEWS = {
  "dashboard.all-leads": {
    sources: [
      {
        key: "enquiries",
        url: `${NOMADS_API_BASE_URL}/company/all-leads`,
        pick: pickArray,
      },
      {
        key: "poc",
        url: `${NOMADS_API_BASE_URL}/poc/poc`,
        pick: pickArray,
      },
    ],
    cards: [
      {
        label: "Total Leads",
        value: ({ data }) => data.enquiries.length + data.poc.length,
        icon: Users,
        tone: 0,
      },
      { label: "Enquiry Leads", value: ({ data }) => data.enquiries.length, icon: UserPlus, tone: 1 },
      { label: "POC Contacts", value: ({ data }) => data.poc.length, icon: LifeBuoy, tone: 2 },
      {
        label: "Pending Enquiries",
        value: ({ data }) =>
          data.enquiries.filter((l) => String(l?.status || "Pending").toLowerCase() === "pending")
            .length,
        icon: Clock,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Enquiry Status",
        type: "donut",
        build: ({ data }) =>
          countBy(data.enquiries, (l) => l?.status || "Pending", {
            pending: "Pending",
            contacted: "Contacted",
            closed: "Closed",
          }),
      },
      {
        title: "Vertical Type",
        type: "donut",
        build: ({ data }) => countVerticals(data.enquiries, "verticalType"),
      },
      {
        title: "Monthly Enquiry Trend",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.enquiries),
      },
      {
        title: "Top Enquiry Countries",
        type: "bars",
        build: ({ data }) => topN(countBy(data.enquiries, "country"), 6),
      },
    ],
  },

  "dashboard.value-adds-leads": {
    sources: [
      { key: "visa", url: `${VALUE_ADDS_API_BASE_URL}/api/visa-support`, auth: "public", pick: pickDataArray },
      { key: "activation", url: `${VALUE_ADDS_API_BASE_URL}/api/overall-activation-support`, auth: "public", pick: pickDataArray },
      { key: "companySetup", url: `${VALUE_ADDS_API_BASE_URL}/api/new-company-setup`, auth: "public", pick: pickDataArray },
      { key: "consultation", url: `${VALUE_ADDS_API_BASE_URL}/api/consultation`, auth: "public", pick: pickDataArray },
      { key: "workation", url: `${VALUE_ADDS_API_BASE_URL}/api/workation`, auth: "public", pick: pickDataArray },
      { key: "contributor", url: `${VALUE_ADDS_API_BASE_URL}/api/become-contributor`, auth: "public", pick: pickDataArray },
    ],
    cards: [
      {
        label: "Total Leads",
        value: ({ data }) =>
          data.visa.length +
          data.activation.length +
          data.companySetup.length +
          data.consultation.length +
          data.workation.length +
          data.contributor.length,
        icon: Users,
        tone: 0,
      },
      { label: "Visa Supports", value: ({ data }) => data.visa.length, icon: Plane, tone: 1 },
      {
        label: "Consultations",
        value: ({ data }) => data.consultation.length,
        icon: MessageSquareText,
        tone: 2,
      },
      { label: "Workations", value: ({ data }) => data.workation.length, icon: PlaneTakeoff, tone: 3 },
    ],
    charts: [
      {
        title: "Lead Source",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Visa Support", value: data.visa.length },
            { label: "Activation Support", value: data.activation.length },
            { label: "New Company Setup", value: data.companySetup.length },
            { label: "Consultation", value: data.consultation.length },
            { label: "Workation", value: data.workation.length },
            { label: "Contributor", value: data.contributor.length },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Monthly Lead Trend",
        type: "bars",
        build: ({ data }) =>
          monthlyTrend(
            flatten(data.visa, data.activation, data.companySetup, data.consultation, data.workation, data.contributor),
          ),
      },
      {
        title: "Top Countries",
        type: "donut",
        build: ({ data }) =>
          topN(
            countBy(
              flatten(data.visa, data.activation, data.companySetup, data.consultation, data.workation, data.contributor),
              (r) =>
                firstNonEmpty(r, [
                  "travellingCountry",
                  "workationCountry",
                  "travelCountry",
                  "consultationCountry",
                  "currentCountry",
                  "newCompanyCountry",
                  "currentCompanyCountry",
                  "nationalityOnPassport",
                ]),
            ),
            6,
          ),
      },
      {
        title: "Visa Types",
        type: "donut",
        build: ({ data }) => countBy(data.visa, "visaType"),
      },
    ],
  },

  "dashboard.nomad-signup-leads": {
    sources: [
      {
        key: "leads",
        url: "/api/nomad-users",
        pick: pickItems,
      },
    ],
    cards: [
      { label: "Total Leads", value: ({ data }) => data.leads.length, icon: UserRound, tone: 0 },
      { label: "Today's New Users", value: ({ data }) => countToday(data.leads), icon: CalendarDays, tone: 1 },
      { label: "This Month", value: ({ data }) => countThisMonth(data.leads), icon: UserPlus, tone: 2 },
      { label: "Last 30 Days", value: ({ data }) => countSince(data.leads, "createdAt", 30), icon: Clock, tone: 3 },
    ],
    charts: [
      {
        title: "Monthly Signup Trend",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.leads),
      },
      {
        title: "Country of Residence",
        type: "donut",
        build: ({ data }) => topN(countBy(data.leads, "countryOfResidence"), 6),
      },
      {
        title: "Country",
        type: "donut",
        build: ({ data }) => topN(countBy(data.leads, "country"), 6),
      },
    ],
  },

  "dashboard.companies": COMPANIES_OVERVIEW,
  "hostpanel.companies": COMPANIES_OVERVIEW,

  "dashboard.publish-listings": {
    sources: [
      {
        key: "listings",
        url: "/api/hosts/get-companies-listings",
        params: { page: 1, limit: 30 },
        pick: pickData,
      },
    ],
    cards: [
      {
        label: "Total Listings",
        value: ({ data }) => data.listings.globalCounts?.total ?? 0,
        icon: Layers,
        tone: 0,
      },
      {
        label: "Active",
        value: ({ data }) => data.listings.globalCounts?.active ?? 0,
        icon: CheckCircle2,
        tone: 1,
      },
      {
        label: "Inactive",
        value: ({ data }) => data.listings.globalCounts?.inactive ?? 0,
        icon: AlertCircle,
        tone: 2,
      },
      {
        label: "Public",
        value: ({ data }) => data.listings.globalCounts?.public ?? 0,
        icon: Globe,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Type Distribution",
        type: "donut",
        build: ({ data }) =>
          (data.listings.categoryCounts || [])
            .map((c) => ({ label: c.key || "Unknown", value: c.count || 0 }))
            .filter((d) => d.value > 0),
      },
      {
        title: "Status",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Active", value: data.listings.globalCounts?.active ?? 0 },
            { label: "Inactive", value: data.listings.globalCounts?.inactive ?? 0 },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Visibility",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Public", value: data.listings.globalCounts?.public ?? 0 },
            { label: "Private", value: data.listings.globalCounts?.private ?? 0 },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Top Countries",
        type: "bars",
        build: ({ data }) => topN(countBy(data.listings.items, "country"), 6),
      },
    ],
  },

  "dashboard.reviews": REVIEWS_OVERVIEW,

  "dashboard.data-upload": null,

  "dashboard.destinations-data": {
    sources: [
      {
        key: "summary",
        url: "/api/hosts/destinations-data",
        params: { page: 1, limit: 1 },
        pick: pickData,
      },
      {
        key: "rows",
        url: "/api/hosts/destinations-data",
        params: { page: 1, limit: 100 },
        pick: pickItems,
      },
    ],
    cards: [
      {
        label: "Destinations",
        value: ({ data }) => data.summary.counts?.destinations ?? 0,
        icon: Globe,
        tone: 0,
      },
      {
        label: "Blogs",
        value: ({ data }) => data.summary.counts?.blogs ?? 0,
        icon: Newspaper,
        tone: 1,
      },
      {
        label: "Events",
        value: ({ data }) => data.summary.counts?.events ?? 0,
        icon: CalendarDays,
        tone: 2,
      },
      {
        label: "Restaurants",
        value: ({ data }) => data.summary.counts?.restaurants ?? 0,
        icon: UtensilsCrossed,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Content Type",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Blogs", value: data.summary.counts?.blogs ?? 0 },
            { label: "News", value: data.summary.counts?.news ?? 0 },
            { label: "Events", value: data.summary.counts?.events ?? 0 },
            { label: "Places", value: data.summary.counts?.places ?? 0 },
            { label: "Restaurants", value: data.summary.counts?.restaurants ?? 0 },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Top Destinations by Content",
        type: "bars",
        build: ({ data }) =>
          topN(
            data.rows.map((r) => ({
              label: r.destination || r.country || "Unknown",
              value:
                (Number(r.blogCount) || 0) +
                (Number(r.newsCount) || 0) +
                (Number(r.eventCount) || 0) +
                (Number(r.placeCount) || 0) +
                (Number(r.restaurantCount) || 0),
            })),
            6,
          ),
      },
      {
        title: "Destinations per Country",
        type: "bars",
        build: ({ data }) => topN(countBy(data.rows, "country"), 6),
      },
      {
        title: "Continent Distribution",
        type: "donut",
        build: ({ data }) => countBy(data.rows, "continent"),
      },
    ],
  },

  "dashboard.world-ranking-weights": {
    sources: [
      {
        key: "weights",
        url: `${NOMADS_API_BASE_URL}/state-wise-weight`,
        pick: pickGenericArray,
      },
    ],
    cards: [
      { label: "Total Entries", value: ({ data }) => data.weights.length, icon: BarChart3, tone: 0 },
      {
        label: "Active",
        value: ({ data }) => data.weights.filter((w) => w.isActive).length,
        icon: CheckCircle2,
        tone: 1,
      },
      {
        label: "Inactive",
        value: ({ data }) => data.weights.filter((w) => !w.isActive).length,
        icon: AlertCircle,
        tone: 2,
      },
      { label: "Countries", value: ({ data }) => distinctCount(data.weights, "country"), icon: Globe, tone: 3 },
    ],
    charts: [
      {
        title: "Status",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Active", value: data.weights.filter((w) => w.isActive).length },
            { label: "Inactive", value: data.weights.filter((w) => !w.isActive).length },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Entries per Country",
        type: "bars",
        build: ({ data }) => topN(countBy(data.weights, "country"), 6),
      },
      {
        title: "Entries per Continent",
        type: "bars",
        build: ({ data }) => topN(countBy(data.weights, "continent"), 6),
      },
    ],
  },

  "dashboard.visa-countries": {
    sources: [
      {
        key: "countries",
        url: `${NOMADS_API_BASE_URL}/visa-rules/destinations/countries`,
        pick: (res) => (Array.isArray(res?.data?.countries) ? res.data.countries : []),
      },
    ],
    cards: [
      { label: "Total Countries", value: ({ data }) => data.countries.length, icon: Plane, tone: 0 },
    ],
    charts: [],
  },

  "dashboard.add-master-user": null,
  "dashboard.user-access": null,
  "dashboard.profile": null,

  "dashboard.logs": {
    sources: [
      {
        key: "logs",
        url: "/api/logs/get-logs",
        params: { page: 1, limit: 1000 },
        pick: pickData,
      },
    ],
    cards: [
      { label: "Total Logs", value: ({ data }) => data.logs.total ?? data.logs.items?.length ?? 0, icon: FileText, tone: 0 },
      { label: "This Month", value: ({ data }) => countThisMonth(data.logs.items), icon: CalendarDays, tone: 1 },
      { label: "Last 30 Days", value: ({ data }) => countSince(data.logs.items, "createdAt", 30), icon: Clock, tone: 2 },
      { label: "Today", value: ({ data }) => countToday(data.logs.items), icon: Activity, tone: 3 },
    ],
    charts: [
      {
        title: "Monthly Activity",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.logs.items),
      },
      {
        title: "Top Actors",
        type: "donut",
        build: ({ data }) => topN(countBy(data.logs.items, (l) => actorName(l)), 6),
      },
      {
        title: "Top Modules",
        type: "donut",
        build: ({ data }) => topN(countBy(data.logs.items, "module"), 6),
      },
    ],
  },

  "hostpanel.host-companies": {
    sources: [
      {
        key: "hostCompanies",
        url: "/api/hosts/host-companies",
        pick: pickArray,
      },
    ],
    cards: [
      { label: "Total Companies", value: ({ data }) => data.hostCompanies.length, icon: Building2, tone: 0 },
      {
        label: "Trial Active",
        value: ({ data }) => data.hostCompanies.filter((c) => c.isTrialActive).length,
        icon: LifeBuoy,
        tone: 1,
      },
      {
        label: "Active Subscription",
        value: ({ data }) =>
          data.hostCompanies.filter((c) =>
            String(c.subscriptionStatus || "").toLowerCase().includes("active"),
          ).length,
        icon: CheckCircle2,
        tone: 2,
      },
      { label: "Industries", value: ({ data }) => distinctCount(data.hostCompanies, "industry"), icon: Layers, tone: 3 },
    ],
    charts: [
      {
        title: "Subscription Status",
        type: "donut",
        build: ({ data }) => countBy(data.hostCompanies, "subscriptionStatus"),
      },
      {
        title: "Plan Distribution",
        type: "donut",
        build: ({ data }) => countBy(data.hostCompanies, "plan"),
      },
      {
        title: "Trial Status",
        type: "donut",
        build: ({ data }) =>
          [
            { label: "Trial Active", value: data.hostCompanies.filter((c) => c.isTrialActive).length },
            { label: "Not on Trial", value: data.hostCompanies.filter((c) => !c.isTrialActive).length },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Company Type",
        type: "donut",
        build: ({ data }) => countVerticals(data.hostCompanies, "industry"),
      },
    ],
  },

  "hostpanel.support-tickets": {
    sources: [
      {
        key: "tickets",
        url: "/api/tickets/host-support-tickets",
        pick: pickDataArray,
      },
    ],
    cards: [
      { label: "Total Tickets", value: ({ data }) => data.tickets.length, icon: Ticket, tone: 0 },
      {
        label: "Open",
        value: ({ data }) =>
          data.tickets.filter((t) => String(t?.status || "open").toLowerCase() === "open").length,
        icon: AlertCircle,
        tone: 1,
      },
      {
        label: "In Progress",
        value: ({ data }) =>
          data.tickets.filter((t) =>
            ["in progress", "accepted", "pending"].includes(String(t?.status || "").toLowerCase()),
          ).length,
        icon: Clock,
        tone: 2,
      },
      {
        label: "Closed",
        value: ({ data }) =>
          data.tickets.filter((t) => String(t?.status || "").toLowerCase() === "closed").length,
        icon: CheckCircle2,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Ticket Status",
        type: "donut",
        build: ({ data }) => countBy(data.tickets, "status"),
      },
      {
        title: "Monthly Ticket Trend",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.tickets),
      },
      {
        title: "Top Companies",
        type: "donut",
        build: ({ data }) => topN(countBy(data.tickets, "companyName"), 6),
      },
    ],
  },

  "hostpanel.signup-leads": {
    sources: [
      {
        key: "leads",
        url: `${NOMADS_API_BASE_URL}/forms/host-users`,
        pick: pickDataArray,
      },
    ],
    cards: [
      { label: "Total Signup Leads", value: ({ data }) => data.leads.length, icon: UserPlus, tone: 0 },
      {
        label: "Pending",
        value: ({ data }) =>
          data.leads.filter((l) => String(l?.status || "pending").toLowerCase() === "pending").length,
        icon: Clock,
        tone: 1,
      },
      {
        label: "Contacted",
        value: ({ data }) =>
          data.leads.filter((l) => String(l?.status || "").toLowerCase() === "contacted").length,
        icon: CheckCircle2,
        tone: 2,
      },
      {
        label: "Closed",
        value: ({ data }) =>
          data.leads.filter((l) => String(l?.status || "").toLowerCase() === "closed").length,
        icon: AlertCircle,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Status",
        type: "donut",
        build: ({ data }) =>
          countBy(data.leads, (l) => l?.status || "pending", statusLabels("Pending", "Contacted", "Closed", "Rejected")),
      },
      {
        title: "Vertical Type",
        type: "donut",
        build: ({ data }) => countVerticals(data.leads, "verticalType"),
      },
      {
        title: "Monthly Signup Trend",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.leads),
      },
      {
        title: "Top Countries",
        type: "donut",
        build: ({ data }) => topN(countBy(data.leads, "country"), 6),
      },
    ],
  },

  "hostpanel.website-credits": {
    sources: [
      {
        key: "summary",
        url: "/api/website-credits/summary",
        pick: pickArray,
      },
      {
        key: "ledger",
        url: "/api/website-credits/ledger",
        pick: pickArray,
      },
    ],
    cards: [
      { label: "Companies", value: ({ data }) => distinctCount(data.summary, "companyName"), icon: Building2, tone: 0 },
      { label: "Workspaces", value: ({ data }) => data.summary.length, icon: Layers, tone: 1 },
      { label: "Credits Remaining", value: ({ data }) => sumBy(data.summary, "creditsRemaining"), icon: CreditCard, tone: 2 },
      {
        label: "Credits Used",
        value: ({ data }) =>
          sumBy(
            data.ledger.filter((e) => String(e?.type || "").toLowerCase() === "used"),
            "credits",
          ),
        icon: TrendingUp,
        tone: 3,
      },
    ],
    charts: [
      {
        title: "Usage Type",
        type: "donut",
        build: ({ data }) =>
          [
            {
              label: "Used",
              value: sumBy(
                data.ledger.filter((e) => String(e?.type || "").toLowerCase() === "used"),
                "credits",
              ),
            },
            {
              label: "Added",
              value: sumBy(
                data.ledger.filter((e) => String(e?.type || "").toLowerCase() === "added"),
                "credits",
              ),
            },
          ].filter((d) => d.value > 0),
      },
      {
        title: "Top Companies by Remaining",
        type: "bars",
        build: ({ data }) =>
          topN(
            data.summary.map((s) => ({
              label: s.companyName || s.companyId || "Unknown",
              value: Number(s.creditsRemaining) || 0,
            })),
            6,
          ),
      },
      {
        title: "Monthly Usage Trend",
        type: "line",
        build: ({ data }) =>
          monthlyTrend(
            data.ledger.filter((e) => String(e?.type || "").toLowerCase() === "used"),
          ),
      },
      {
        title: "Top Companies by Limit",
        type: "bars",
        build: ({ data }) =>
          topN(
            data.summary.map((s) => ({
              label: s.companyName || s.companyId || "Unknown",
              value: Number(s.monthlyCreditsLimit) || 0,
            })),
            6,
          ),
      },
    ],
  },

  "hostpanel.module-access-logs": {
    sources: [
      {
        key: "logs",
        url: "/api/logs/module-access-logs",
        pick: pickGenericArray,
      },
    ],
    cards: [
      { label: "Total Events", value: ({ data }) => data.logs.length, icon: ShieldCheck, tone: 0 },
      { label: "Modules Enabled", value: ({ data }) => sumBy(data.logs, "enabledCount"), icon: CheckCircle2, tone: 1 },
      { label: "Modules Disabled", value: ({ data }) => sumBy(data.logs, "disabledCount"), icon: AlertCircle, tone: 2 },
      { label: "Companies", value: ({ data }) => distinctCount(data.logs, "hostCompany"), icon: Building2, tone: 3 },
    ],
    charts: [
      {
        title: "Source Panel",
        type: "donut",
        build: ({ data }) => countBy(data.logs, "sourcePanel"),
      },
      {
        title: "Top Host Companies",
        type: "donut",
        build: ({ data }) => topN(countBy(data.logs, "hostCompany"), 6),
      },
      {
        title: "Monthly Trend",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.logs),
      },
    ],
  },

  "hostpanel.host-panel-logs": {
    sources: [
      {
        key: "logs",
        url: "/api/logs/host-activity-logs",
        pick: pickGenericArray,
      },
    ],
    cards: [
      { label: "Total Logs", value: ({ data }) => data.logs.length, icon: ScrollText, tone: 0 },
      { label: "This Month", value: ({ data }) => countThisMonth(data.logs), icon: CalendarDays, tone: 1 },
      { label: "Last 30 Days", value: ({ data }) => countSince(data.logs, "createdAt", 30), icon: Clock, tone: 2 },
      { label: "Companies", value: ({ data }) => distinctCount(data.logs, "companyName"), icon: Building2, tone: 3 },
    ],
    charts: [
      {
        title: "Monthly Activity",
        type: "bars",
        build: ({ data }) => monthlyTrend(data.logs),
      },
      {
        title: "Top Companies",
        type: "donut",
        build: ({ data }) => topN(countBy(data.logs, "companyName"), 6),
      },
      {
        title: "Top Users",
        type: "donut",
        build: ({ data }) => topN(countBy(data.logs, "fullName"), 6),
      },
    ],
  },
};
