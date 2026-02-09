import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { IconButton, TextField } from "@mui/material";
import { MdOutlineRateReview } from "react-icons/md";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import PageFrame from "../../../components/Pages/PageFrame";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const CompanyReviews = () => {
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const axiosPrivate = useAxiosPrivate();
  const [openModal, setOpenModal] = useState(false);
  const [activeReview, setActiveReview] = useState(null);

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["companyReviews", selectedCompany?.companyId],
    // enabled: !!selectedCompany?.companyId,

    queryFn: async () => {
      const response = await axiosPrivate.get("/api/admin/reviews", {
        params: {
          // companyId: selectedCompany?.companyId,
          companyId: "CMP0001",
          // companyType: "meetingroom",
          status: "approved",
        },
        headers: { "Cache-Control": "no-cache" },
      });
      const payload = response?.data;
      const reviews =
        payload?.reviews ?? payload?.data?.reviews ?? payload?.data ?? payload;
      return Array.isArray(reviews) ? reviews : [];
    },
  });

  const rows = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((review, index) => ({
        ...review,
        srNo: index + 1,
      })),
    [data],
  );

  const handleOpenModal = (review) => {
    setActiveReview(review);
    setOpenModal(true);
  };

  const formatStatusLabel = (status) => {
    if (!status) return "Pending";
    const normalized = String(status).toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

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
      valueGetter: (params) => formatStatusLabel(params.data.status),
    },
    {
      field: "comment",
      headerName: "Description",
      cellRenderer: (params) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <IconButton onClick={() => handleOpenModal(params.data)}>
            <MdOutlineRateReview />
          </IconButton>
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
