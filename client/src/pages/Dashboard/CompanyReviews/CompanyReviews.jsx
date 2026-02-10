import React, { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { MenuItem, TextField } from "@mui/material";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import PageFrame from "../../../components/Pages/PageFrame";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const CompanyReviews = () => {
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const axiosPrivate = useAxiosPrivate();
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
      const response = await axiosPrivate.get("/api/admin/reviews", {
        // params: {
        // companyId: selectedCompany?.companyId,
        // companyId: "CMP0001",
        // companyType: "meetingroom",
        // status: "pending",
        // },
        headers: { "Cache-Control": "no-cache" },
      });
      const payload = response?.data;
      const reviews =
        payload?.reviews ?? payload?.data?.reviews ?? payload?.data ?? payload;
      return Array.isArray(reviews) ? reviews : [];
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

  const getEffectiveStatus = useCallback(
    (review) => {
      const reviewId = review?._id || review?.id;
      return statusOverrides[reviewId] || review?.status;
    },
    [statusOverrides],
  );

  const handleStatusChange = (review, newStatus) => {
    const reviewId = review?._id || review?.id;
    if (!reviewId) return;

    setStatusOverrides((prev) => ({
      ...prev,
      [reviewId]: newStatus,
    }));
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

  const columns = [
    { field: "srNo", headerName: "SrNo", width: 100 },
    {
      field: "reviewerName",
      headerName: "Reviewer Name",
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
      field: "status",
      headerName: "Status",
      cellRenderer: (params) => {
        const value = formatStatusLabel(params.data.status);
        const isFinalStatus = value === "Approved" || value === "Rejected";

        const statusStyles = {
          Pending: { bg: "#FEF3C7", color: "#F59E0B" },
          Approved: { bg: "#D1FAE5", color: "#10B981" },
          Rejected: { bg: "#FEE2E2", color: "#EF4444" },
        };

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
                onChange={(e) =>
                  handleStatusChange(params.data, e.target.value.toLowerCase())
                }
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "9999px",
                    px: 1.5,
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    backgroundColor: statusStyles[value]?.bg,
                    color: statusStyles[value]?.color,
                    "& fieldset": { border: "none" },
                  },
                  "& .MuiSelect-select": {
                    textAlign: "center",
                  },
                }}
              >
                {["Pending", "Approved", "Rejected"].map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      borderRadius: "9999px",
                      my: 0.5,
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
      field: "comment",

      headerName: "Description",
      cellRenderer: (params) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* <IconButton onClick={() => handleOpenModal(params.data)}>
            <MdOutlineRateReview />
          </IconButton> */}
          <button
            className="text-blue-500 underline font-semibold"
            onClick={() => handleOpenModal(params.data)}
          >
            View Description
          </button>
        </div>
      ),
    },
  ];

  if (isPending) return <>Loading Reviews</>;
  if (isError)
    return <span className="text-red-500">Error Loading Reviews</span>;

  return (
    <div className="p-4">
      <PageFrame>
        <YearWiseTable data={rows} tableTitle={"Reviews"} columns={columns} />

        {rows.length === 0 && (
          <div className="text-center text-gray-500 py-4">No records found</div>
        )}
      </PageFrame>

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
