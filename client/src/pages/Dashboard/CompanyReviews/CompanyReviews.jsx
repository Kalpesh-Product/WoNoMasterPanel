import React, { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { MenuItem, TextField } from "@mui/material";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";
import { MdOutlineRemoveRedEye } from "react-icons/md";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const REVIEW_TABS = {
  nomadListings: 0,
  eventReviews: 1,
  placeReviews: 2,
};

const statusStyles = {
  Pending: { bg: "#FEF3C7", color: "#F59E0B" },
  Approved: { bg: "#D1FAE5", color: "#10B981" },
  Rejected: { bg: "#FEE2E2", color: "#EF4444" },
};

const CompanyReviews = () => {
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(REVIEW_TABS.nomadListings);
  const [openModal, setOpenModal] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["companyReviews", selectedCompany?.companyId],
    // enabled: !!selectedCompany?.companyId,

    queryFn: async () => {
      const extractReviews = (response) => {
        const payload = response?.data;
        const reviews =
          payload?.reviews ??
          payload?.data?.reviews ??
          payload?.data ??
          payload;
        return Array.isArray(reviews) ? reviews : [];
      };

      const response = await axiosPrivate.get("/api/admin/reviews", {
        headers: { "Cache-Control": "no-cache" },
      });

      const mergedReviews = extractReviews(response);

      const uniqueReviews = new Map();
      mergedReviews.forEach((review, index) => {
        const reviewId = review?._id || review?.id;
        if (!reviewId || !uniqueReviews.has(reviewId)) {
          uniqueReviews.set(reviewId || `review-${index}`, review);
        }
      });

      return Array.from(uniqueReviews.values());
    },
  });

  const {
    data: eventReviews = [],
    isPending: isEventReviewsPending,
    isError: isEventReviewsError,
  } = useQuery({
    queryKey: ["eventReviews"],
    enabled: activeTab === REVIEW_TABS.eventReviews,
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_API_BASE_URL}/event-reviews/all`,
        {
          headers: { "Cache-Control": "no-cache" },
        },
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const {
    data: placeReviews = [],
    isPending: isPlaceReviewsPending,
    isError: isPlaceReviewsError,
  } = useQuery({
    queryKey: ["placeReviews"],
    enabled: activeTab === REVIEW_TABS.placeReviews,
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_API_BASE_URL}/place-reviews/all`,
        {
          headers: { "Cache-Control": "no-cache" },
        },
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  // const rows = useMemo(
  //   () =>
  //     (Array.isArray(data) ? data : []).map((review, index) => ({
  //       ...review,
  //       srNo: index + 1,
  //     })),
  //   [data],
  // );

  const handleOpenModal = (review) => {
    setActiveReview(review);
    setOpenModal(true);
  };

  const formatStatusLabel = (status) => {
    if (!status) return "Pending";
    const normalized = String(status).toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatDateTime = (date) => {
    if (!date) return "-";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEffectiveStatus = useCallback(
    (review) => {
      const reviewId = review?._id || review?.id;
      return statusOverrides[reviewId] || review?.status;
    },
    [statusOverrides],
  );

  const getReviewerActionByName = useCallback(
    (review) => {
      const extractName = (user) => {
        if (!user) return "";
        if (typeof user === "string") return user;

        const firstName = user?.firstName || "";
        const lastName = user?.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          fullName ||
          user?.fullName ||
          user?.name ||
          user?.username ||
          user?.email ||
          ""
        );
      };

      const extractActionUserName = (actionBy) => {
        if (!actionBy) return "";
        if (typeof actionBy === "string") return actionBy;

        const userType = String(actionBy?.userType || "").toUpperCase();
        const nestedUser = actionBy?.user;

        if (userType === "MASTER") {
          const masterName = `${nestedUser?.firstName || ""} ${
            nestedUser?.lastName || ""
          }`.trim();

          return masterName || extractName(nestedUser) || extractName(actionBy);
        }

        if (userType === "HOST") {
          return (
            nestedUser?.name || extractName(nestedUser) || extractName(actionBy)
          );
        }

        return extractName(nestedUser) || extractName(actionBy);
      };

      const status = String(getEffectiveStatus(review) || review?.status || "")
        .toLowerCase()
        .trim();

      if (status === "approved") {
        return (
          extractName(review?.approvedByName) ||
          extractActionUserName(review?.approvedBy) ||
          "-"
        );
      }

      if (status === "rejected") {
        return (
          extractName(review?.rejectedByName) ||
          extractActionUserName(review?.rejectedBy) ||
          "-"
        );
      }

      return "-";
    },
    [getEffectiveStatus],
  );

  const updateReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(
        `/api/admin/review/${reviewId}`,
        {
          status,
          // companyId/companyName ride along for the audit log
          ...(selectedCompany?.companyId
            ? { companyId: selectedCompany.companyId }
            : {}),
          ...(selectedCompany?.companyName
            ? { companyName: selectedCompany.companyName }
            : {}),
        },
      );
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["companyReviews", selectedCompany?.companyId],
      });
    },
  });

  const updateEventReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(
        `${NOMADS_API_BASE_URL}/event-reviews/${reviewId}/status`,
        {
          status,
        },
      );
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["eventReviews"],
      });
    },
  });

  const updatePlaceReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }) => {
      const response = await axiosPrivate.patch(
        `${NOMADS_API_BASE_URL}/place-reviews/${reviewId}/status`,
        {
          status,
        },
      );
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["placeReviews"],
      });
    },
  });

  const handleStatusChange = (review, newStatus) => {
    const reviewId = review?._id || review?.id;
    if (!reviewId) return;

    setStatusOverrides((prev) => ({
      ...prev,
      [reviewId]: newStatus,
    }));

    if (newStatus === "approved" || newStatus === "rejected") {
      updateReviewStatusMutation.mutate({ reviewId, status: newStatus });
    }
  };

  const handleEventStatusChange = (review, newStatus) => {
    const reviewId = review?._id || review?.id;
    if (!reviewId) return;

    setStatusOverrides((prev) => ({
      ...prev,
      [reviewId]: newStatus,
    }));

    if (newStatus === "approved" || newStatus === "rejected") {
      updateEventReviewStatusMutation.mutate({ reviewId, status: newStatus });
    }
  };

  const handlePlaceStatusChange = (review, newStatus) => {
    const reviewId = review?._id || review?.id;
    if (!reviewId) return;

    setStatusOverrides((prev) => ({
      ...prev,
      [reviewId]: newStatus,
    }));

    if (newStatus === "approved" || newStatus === "rejected") {
      updatePlaceReviewStatusMutation.mutate({ reviewId, status: newStatus });
    }
  };

  const getSelectChipSx = (styles, value) => ({
    minWidth: 130,
    "& .MuiOutlinedInput-root": {
      borderRadius: "9999px",
      minHeight: 30,
      px: 1,
      fontWeight: 600,
      fontSize: "0.75rem",
      backgroundColor: styles[value]?.bg,
      color: styles[value]?.color,
      border: "1px solid rgba(148, 163, 184, 0.35)",
      "& fieldset": { border: "none" },
    },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      py: "4px !important",
      pr: "22px !important",
      pl: "10px !important",
      textTransform: "capitalize",
    },
    "& .MuiSelect-icon": {
      right: 8,
      color: styles[value]?.color,
      fontSize: "1rem",
    },
  });

  const selectMenuProps = {
    PaperProps: {
      sx: {
        mt: 1,
        borderRadius: "18px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
        p: 0.5,
        overflow: "hidden",
      },
    },
    MenuListProps: {
      dense: true,
      sx: {
        p: 0,
      },
    },
  };

  const rows = useMemo(() => {
    const statusOrder = {
      pending: 0,
      rejected: 1,
      approved: 2,
    };

    return (Array.isArray(data) ? data : [])
      .slice()
      .sort((a, b) => {
        const aStatus = String(
          getEffectiveStatus(a) || "pending",
        ).toLowerCase();
        const bStatus = String(
          getEffectiveStatus(b) || "pending",
        ).toLowerCase();
        const aRank = statusOrder[aStatus] ?? Number.MAX_SAFE_INTEGER;
        const bRank = statusOrder[bStatus] ?? Number.MAX_SAFE_INTEGER;
        return aRank - bRank;
      })
      .map((review, index) => ({
        ...review,
        srNo: index + 1,
        status: getEffectiveStatus(review) || review?.status,
      }));
  }, [data, getEffectiveStatus]);

  const eventReviewRows = useMemo(
    () =>
      (Array.isArray(eventReviews) ? eventReviews : []).map(
        (review, index) => ({
          ...review,
          srNo: index + 1,
          status: getEffectiveStatus(review) || review?.status,
          createdAtFormatted: formatDateTime(review?.createdAt),
          updatedAtFormatted: formatDateTime(review?.updatedAt),
        }),
      ),
    [eventReviews, getEffectiveStatus],
  );

  const placeReviewRows = useMemo(
    () =>
      (Array.isArray(placeReviews) ? placeReviews : []).map(
        (review, index) => ({
          ...review,
          srNo: index + 1,
          status: getEffectiveStatus(review) || review?.status,
          createdAtFormatted: formatDateTime(review?.createdAt),
          updatedAtFormatted: formatDateTime(review?.updatedAt),
        }),
      ),
    [placeReviews, getEffectiveStatus],
  );

  const columns = [
    {
      field: "srNo",
      lockPinned: true,
      pinned: "left",
      headerName: "SrNo",
      width: 100,
    },
    {
      field: "reviewerName",
      headerName: "Reviewer Name",
      width: 300,
      valueGetter: (params) =>
        params.data.reviewerName ||
        params.data.reviewreName ||
        params.data.fullName ||
        params.data.name ||
        "-",
    },
    {
      field: "rating",
      headerName: "Rating",
      valueGetter: (params) =>
        params.data.rating ??
        params.data.ratingValue ??
        params.data.starCount ??
        "-",
    },
    {
      field: "approvedOrRejectedBy",
      headerName: "Approved/Rejected by",
      width: 250,
      valueGetter: (params) => getReviewerActionByName(params.data),
    },
    {
      field: "status",
      headerName: "Status",
      width: 200,
      cellRenderer: (params) => {
        const value = formatStatusLabel(params.data.status);
        const isFinalStatus = value === "Approved" || value === "Rejected";

        const badgeStyles = {
          borderRadius: "9999px",
          padding: "4px 16px",
          fontWeight: 600,
          fontSize: "0.85rem",
          backgroundColor: statusStyles[value]?.bg,
          color: statusStyles[value]?.color,
          lineHeight: 1.5,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            {isFinalStatus ? (
              <span style={badgeStyles}>{value}</span>
            ) : (
              <TextField
                select
                size="small"
                value={value}
                disabled={updateReviewStatusMutation.isPending}
                onChange={(e) =>
                  handleStatusChange(params.data, e.target.value.toLowerCase())
                }
                sx={getSelectChipSx(statusStyles, value)}
                MenuProps={selectMenuProps}
              >
                {["Pending", "Approved", "Rejected"].map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{
                      justifyContent: "flex-start",
                      alignItems: "center",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      color: "#0f172a",
                      my: 0,
                      px: 1.5,
                      py: 1,
                      textTransform: "capitalize",
                      "&:hover": {
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </div>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 120,
      pinned: "right",
      lockPinned: true,
      cellRenderer: (params) => (
        <div className="flex items-center gap-2">
          <div
            role="button"
            onClick={() => handleOpenModal(params.data)}
            className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
          >
            <MdOutlineRemoveRedEye />
          </div>
        </div>
      ),
    },
  ];

  const eventReviewColumns = [
    {
      field: "srNo",
      lockPinned: true,
      pinned: "left",
      headerName: "SrNo",
      width: 100,
    },
    {
      field: "reviewerName",
      headerName: "Reviewer Name",
      width: 220,
      valueGetter: (params) =>
        params.data.reviewerName || params.data.name || "-",
    },
    {
      field: "eventName",
      headerName: "Event Name",
      width: 240,
      valueGetter: (params) => params.data.eventName || "-",
    },
    // {
    //   field: "eventId",
    //   headerName: "Event ID",
    //   width: 240,
    //   valueGetter: (params) => params.data.eventId || params.data.event || "-",
    // },
    {
      field: "continent",
      headerName: "Continent",
      width: 160,
      valueGetter: (params) => params.data.continent || "-",
    },
    {
      field: "country",
      headerName: "Country",
      width: 160,
      valueGetter: (params) => params.data.country || "-",
    },
    {
      field: "state",
      headerName: "State",
      width: 180,
      valueGetter: (params) => params.data.state || "-",
    },
    {
      field: "starCount",
      headerName: "Rating",
      width: 120,
      valueGetter: (params) => params.data.starCount ?? "-",
    },
    {
      field: "status",
      headerName: "Status",
      width: 180,
      cellRenderer: (params) => {
        const value = formatStatusLabel(params.data.status);
        const isFinalStatus = value === "Approved" || value === "Rejected";

        const badgeStyles = {
          borderRadius: "9999px",
          padding: "4px 16px",
          fontWeight: 600,
          fontSize: "0.85rem",
          backgroundColor: statusStyles[value]?.bg,
          color: statusStyles[value]?.color,
          lineHeight: 1.5,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            {isFinalStatus ? (
              <span style={badgeStyles}>{value}</span>
            ) : (
              <TextField
                select
                size="small"
                value={value}
                disabled={updateEventReviewStatusMutation.isPending}
                onChange={(e) =>
                  handleEventStatusChange(
                    params.data,
                    e.target.value.toLowerCase(),
                  )
                }
                sx={getSelectChipSx(statusStyles, value)}
                MenuProps={selectMenuProps}
              >
                {["Pending", "Approved", "Rejected"].map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{
                      justifyContent: "flex-start",
                      alignItems: "center",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      color: "#0f172a",
                      my: 0,
                      px: 1.5,
                      py: 1,
                      textTransform: "capitalize",
                      "&:hover": {
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </div>
        );
      },
    },
    // {
    //   field: "reviewer",
    //   headerName: "Reviewer ID",
    //   width: 240,
    //   valueGetter: (params) => params.data.reviewer || "-",
    // },
    {
      field: "createdAtFormatted",
      headerName: "Created At",
      width: 190,
      valueGetter: (params) => params.data.createdAtFormatted || "-",
    },
    {
      field: "updatedAtFormatted",
      headerName: "Updated At",
      width: 190,
      valueGetter: (params) => params.data.updatedAtFormatted || "-",
    },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 120,
      pinned: "right",
      lockPinned: true,
      cellRenderer: (params) => (
        <div className="flex items-center gap-2">
          <div
            role="button"
            onClick={() => handleOpenModal(params.data)}
            className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
          >
            <MdOutlineRemoveRedEye />
          </div>
        </div>
      ),
    },
  ];

  const placeReviewColumns = [
    {
      field: "srNo",
      lockPinned: true,
      pinned: "left",
      headerName: "SrNo",
      width: 100,
    },
    {
      field: "reviewerName",
      headerName: "Reviewer Name",
      width: 220,
      valueGetter: (params) =>
        params.data.reviewerName || params.data.name || "-",
    },
    {
      field: "placeName",
      headerName: "Place Name",
      width: 240,
      valueGetter: (params) => params.data.placeName || "-",
    },
    {
      field: "continent",
      headerName: "Continent",
      width: 160,
      valueGetter: (params) => params.data.continent || "-",
    },
    {
      field: "country",
      headerName: "Country",
      width: 160,
      valueGetter: (params) => params.data.country || "-",
    },
    {
      field: "state",
      headerName: "State",
      width: 180,
      valueGetter: (params) => params.data.state || "-",
    },
    {
      field: "starCount",
      headerName: "Rating",
      width: 120,
      valueGetter: (params) => params.data.starCount ?? "-",
    },
    {
      field: "status",
      headerName: "Status",
      width: 180,
      cellRenderer: (params) => {
        const value = formatStatusLabel(params.data.status);
        const isFinalStatus = value === "Approved" || value === "Rejected";

        const badgeStyles = {
          borderRadius: "9999px",
          padding: "4px 16px",
          fontWeight: 600,
          fontSize: "0.85rem",
          backgroundColor: statusStyles[value]?.bg,
          color: statusStyles[value]?.color,
          lineHeight: 1.5,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            {isFinalStatus ? (
              <span style={badgeStyles}>{value}</span>
            ) : (
              <TextField
                select
                size="small"
                value={value}
                disabled={updatePlaceReviewStatusMutation.isPending}
                onChange={(e) =>
                  handlePlaceStatusChange(
                    params.data,
                    e.target.value.toLowerCase(),
                  )
                }
                sx={getSelectChipSx(statusStyles, value)}
                MenuProps={selectMenuProps}
              >
                {["Pending", "Approved", "Rejected"].map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{
                      justifyContent: "flex-start",
                      alignItems: "center",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      borderRadius: 0,
                      backgroundColor: "transparent",
                      color: "#0f172a",
                      my: 0,
                      px: 1.5,
                      py: 1,
                      textTransform: "capitalize",
                      "&:hover": {
                        backgroundColor: "#f8fafc",
                      },
                    }}
                  >
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </div>
        );
      },
    },
    {
      field: "createdAtFormatted",
      headerName: "Created At",
      width: 190,
      valueGetter: (params) => params.data.createdAtFormatted || "-",
    },
    {
      field: "updatedAtFormatted",
      headerName: "Updated At",
      width: 190,
      valueGetter: (params) => params.data.updatedAtFormatted || "-",
    },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 120,
      pinned: "right",
      lockPinned: true,
      cellRenderer: (params) => (
        <div className="flex items-center gap-2">
          <div
            role="button"
            onClick={() => handleOpenModal(params.data)}
            className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
          >
            <MdOutlineRemoveRedEye />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Review type"
        className="grid grid-cols-1 gap-1 rounded-2xl border border-[#e2e8f0] bg-[#f1f5f9] p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] sm:grid-cols-3 sm:rounded-full"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === REVIEW_TABS.nomadListings}
          onClick={() => setActiveTab(REVIEW_TABS.nomadListings)}
          className={`rounded-full px-4 py-2 text-center font-semibold transition-colors ${
            activeTab === REVIEW_TABS.nomadListings
              ? "bg-white text-[#2563EB] shadow-[0_1px_4px_rgba(15,23,42,0.12)]"
              : "bg-transparent text-[#475569]"
          }`}
        >
          Nomad Listing Reviews
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === REVIEW_TABS.eventReviews}
          onClick={() => setActiveTab(REVIEW_TABS.eventReviews)}
          className={`rounded-full px-4 py-2 text-center font-semibold transition-colors ${
            activeTab === REVIEW_TABS.eventReviews
              ? "bg-white text-[#2563EB] shadow-[0_1px_4px_rgba(15,23,42,0.12)]"
              : "bg-transparent text-[#475569]"
          }`}
        >
          Event Reviews
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === REVIEW_TABS.placeReviews}
          onClick={() => setActiveTab(REVIEW_TABS.placeReviews)}
          className={`rounded-full px-4 py-2 text-center font-semibold transition-colors ${
            activeTab === REVIEW_TABS.placeReviews
              ? "bg-white text-[#2563EB] shadow-[0_1px_4px_rgba(15,23,42,0.12)]"
              : "bg-transparent text-[#475569]"
          }`}
        >
          Places Reviews
        </button>
      </div>

      <div className="py-4">
        {activeTab === REVIEW_TABS.nomadListings && (
          <>
            {isPending ? (
              <>Loading Reviews</>
            ) : isError ? (
              <span className="text-red-500">Error Loading Reviews</span>
            ) : (
              <>
                <AgTable
                  data={rows}
                  search
                  tableTitle={"Nomad Listing Reviews"}
                  columns={columns}
                />

                {rows.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No records found
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === REVIEW_TABS.eventReviews && (
          <>
            {isEventReviewsPending ? (
              <>Loading Event Reviews</>
            ) : isEventReviewsError ? (
              <span className="text-red-500">Error Loading Event Reviews</span>
            ) : (
              <>
                <AgTable
                  data={eventReviewRows}
                  search
                  tableTitle={"Event Reviews"}
                  columns={eventReviewColumns}
                />

                {eventReviewRows.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No records found
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === REVIEW_TABS.placeReviews && (
          <>
            {isPlaceReviewsPending ? (
              <>Loading Places Reviews</>
            ) : isPlaceReviewsError ? (
              <span className="text-red-500">Error Loading Places Reviews</span>
            ) : (
              <>
                <AgTable
                  data={placeReviewRows}
                  search
                  tableTitle={"Places Reviews"}
                  columns={placeReviewColumns}
                />

                {placeReviewRows.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    No records found
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <MuiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Review Description"
      >
        <TextField
          label="Description"
          multiline
          rows={4}
          fullWidth
          disabled
          value={activeReview?.description || ""}
        />
      </MuiModal>
    </div>
  );
};

export default CompanyReviews;
