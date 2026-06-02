import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, MenuItem, TextField } from "@mui/material";
import PageFrame from "../../../components/Pages/PageFrame";
import AgTable from "../../../components/AgTable";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const REQUIREMENT_OPTIONS = [
  "e-visa",
  "no admission",
  "visa free",
  "visa freee",
  "visa on arrival",
  "visa required",
];

const VisaCountries = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formRows, setFormRows] = useState([]);
  const [modalError, setModalError] = useState("");

  const {
    data: countries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["visaCountriesList"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "http://localhost:3000/api/visa-rules/destinations/countries",
      );
      return response?.data?.countries || [];
    },
  });

  const tableRows = useMemo(
    () =>
      countries.map((country, index) => ({
        id: `${country}-${index}`,
        srNo: index + 1,
        country,
      })),
    [countries],
  );

  const { data: visaRules = [], isFetching: isFetchingVisaRules } = useQuery({
    queryKey: ["visaRulesByPassport", selectedPassport],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `http://localhost:3000/api/visa-rules/passport/${encodeURIComponent(selectedPassport)}`,
      );
      return response?.data?.data || [];
    },
    enabled: Boolean(selectedPassport),
  });

  const { mutate: patchVisaRule, isPending: isSaving } = useMutation({
    mutationFn: async ({ passport, destination, durationDays, requirement }) =>
      axiosPrivate.patch(
        `http://localhost:3000/api/visa-rules/passport/${encodeURIComponent(passport)}`,
        {
          destination,
          durationDays: Number(durationDays),
          requirement,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["visaRulesByPassport", selectedPassport],
      });
      setEditMode(false);
      setModalError("");
    },
    onError: () => {
      setModalError("Failed to update visa rule(s). Please try again.");
    },
  });

  const handleOpenVisaDetails = (passportCountry) => {
    setSelectedPassport(passportCountry);
    setModalError("");
    setEditMode(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditMode(false);
    setFormRows([]);
    setModalError("");
  };

  const columns = useMemo(
    () => [
      {
        field: "srNo",
        headerName: "Sr No",
        width: 110,
      },
      {
        field: "country",
        headerName: "Country",
        flex: 1,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={params?.data?.id}
            menuItems={[
              {
                label: "Visa Details",
                onClick: () => handleOpenVisaDetails(params?.data?.country),
              },
            ]}
          />
        ),
      },
    ],
    [],
  );

  React.useEffect(() => {
    setFormRows(
      (visaRules || []).map((rule) => ({
        destination: rule.destination || "",
        durationDays: rule.durationDays ?? "",
        requirement: rule.requirement || "",
      })),
    );
  }, [visaRules]);

  const handleFieldChange = (index, field, value) => {
    setFormRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const handleSubmitEdits = (event) => {
    event.preventDefault();
    formRows.forEach((row) => {
      patchVisaRule({
        passport: selectedPassport,
        destination: row.destination,
        durationDays: row.durationDays,
        requirement: row.requirement,
      });
    });
  };

  if (isError) {
    return (
      <div className="p-6 text-red-500">Failed to load visa countries.</div>
    );
  }

  return (
    <div>
      <AgTable
        data={tableRows}
        columns={columns}
        search={true}
        tableTitle="Visa Countries"
        tableHeight={500}
        loading={isLoading}
      />

      <MuiModal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={`Visa Details - ${selectedPassport || ""}`}
      >
        <form onSubmit={handleSubmitEdits} className="space-y-4">
          <h3 className="text-lg font-semibold">Visa Details</h3>
          {isFetchingVisaRules ? (
            <p className="text-sm text-gray-500">Loading visa details...</p>
          ) : null}
          {modalError ? (
            <p className="text-sm text-red-500">{modalError}</p>
          ) : null}

          <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
            {formRows.map((row, index) => (
              <div
                key={`${row.destination}-${index}`}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <TextField
                  label="Destination"
                  value={row.destination}
                  size="small"
                  disabled
                  fullWidth
                />
                <TextField
                  label="Duration Days"
                  type="number"
                  size="small"
                  value={row.durationDays}
                  onChange={(event) =>
                    handleFieldChange(index, "durationDays", event.target.value)
                  }
                  disabled={!editMode}
                  fullWidth
                />
                <TextField
                  label="Requirement"
                  size="small"
                  select
                  value={row.requirement}
                  onChange={(event) =>
                    handleFieldChange(index, "requirement", event.target.value)
                  }
                  disabled={!editMode}
                  fullWidth
                >
                  {Array.from(
                    new Set([
                      ...REQUIREMENT_OPTIONS,
                      ...(row.requirement ? [row.requirement] : []),
                    ]),
                  ).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            {editMode ? (
              <>
                <Button onClick={() => setEditMode(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button variant="contained" onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </div>
        </form>
      </MuiModal>
    </div>
  );
};

export default VisaCountries;
