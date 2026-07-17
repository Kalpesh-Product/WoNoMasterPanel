import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import humanTime from "../../../utils/humanTime";
import DetalisFormatted from "../../../components/DetalisFormatted";
import MuiModal from "../../../components/MuiModal";
import { MdOutlineRemoveRedEye } from "react-icons/md";

const HostPanelLogs = () => {
  const axios = useAxiosPrivate();
  const [openModal, setOpenModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["host-activity-logs"],
    queryFn: async () => {
      const response = await axios.get("/api/logs/host-activity-logs");
      return response.data || [];
    },
  });

  const rows = useMemo(
    () =>
      (isLoading ? [] : data).map((item, index) => ({
        ...item,
        srNo: index + 1,
        companyName: item.companyName || "-",
        workspaceName: item.workspaceName || "-",
        user: item.fullName || item.email || "-",
      })),
    [data, isLoading],
  );

  const columns = [
    {
      headerName: "Sr No",
      field: "srNo",
      lockPinned: true,
      pinned: "left",
      width: 90,
    },
    {
      headerName: "Action",
      field: "action",
      flex: 1,
      cellRenderer: (params) => (
        <div
          role="button"
          onClick={() => {
            setSelectedLog(params.data || {});
            setOpenModal(true);
          }}
        >
          <span className="underline text-blue-600 cursor-pointer">
            {params.value}
          </span>
        </div>
      ),
    },
    {
      headerName: "Module",
      field: "module",
      flex: 1,
      valueFormatter: (params) => params.value || "-",
    },
    { headerName: "Company", field: "companyName", flex: 1 },
    { headerName: "Workspace", field: "workspaceName", flex: 1 },
    { headerName: "User", field: "user", flex: 1 },
    {
      headerName: "Date",
      field: "createdAt",
      flex: 1,
      cellRenderer: (params) => humanDate(params.value),
    },
    {
      field: "actions",
      headerName: "Actions",
      pinned: "right",
      lockPinned: true,
      width: 100,
      cellRenderer: (params) => (
        <div
          role="button"
          onClick={() => {
            setSelectedLog(params.data || {});
            setOpenModal(true);
          }}
          className="p-4 rounded-full hover:bg-borderGray cursor-pointer"
        >
          <MdOutlineRemoveRedEye />
        </div>
      ),
    },
  ];

  //////////////////////Format data for view modal/////////////////////////

  const skipKeys = ["__v", "_id", "refreshToken", "password"];

  const formatKey = (key) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

  const isMongoId = (value) =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

  const formatValue = (key, value) => {
    if (skipKeys.includes(key)) return null;
    if (isMongoId(value)) return null;
    if (value === null || value === undefined || value === "") return null;

    if (Array.isArray(value)) {
      const cleanList = value.filter((item) => !isMongoId(item));
      if (cleanList.length === 0) return null;
      return (
        <ul className="list-disc list-inside">
          {cleanList.map((item, idx) => (
            <li key={idx}>
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === "object") return JSON.stringify(value);

    if (key.toLowerCase().includes("date")) return humanDate(value);
    if (key.toLowerCase().includes("time")) return humanTime(value);

    return String(value);
  };

  return (
    <div>
      <YearWiseTable
        data={rows}
        columns={columns}
        dateColumn="createdAt"
        tableHeight={400}
        tableTitle="Host Panel Logs"
        exportData={true}
        search={true}
        filterExcludeColumns={["createdAt"]}
      />

      <MuiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="View Host Activity"
      >
        {selectedLog && (
          <div className="flex flex-col gap-5">
            {/* Summary */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ["Action", selectedLog.action],
                ["Module", selectedLog.module],
                ["Company", selectedLog.companyName],
                ["Workspace", selectedLog.workspaceName],
                ["User", selectedLog.user || selectedLog.fullName],
                ["Email", selectedLog.email],
                ["Method", selectedLog.method],
                [
                  "Status",
                  selectedLog.success === undefined
                    ? null
                    : selectedLog.success
                      ? "Success"
                      : "Failed",
                ],
                [
                  "Date",
                  selectedLog.createdAt
                    ? `${humanDate(selectedLog.createdAt)} ${humanTime(selectedLog.createdAt)}`
                    : null,
                ],
              ]
                .filter(
                  ([, value]) =>
                    value !== null && value !== undefined && value !== "",
                )
                .map(([title, value]) => (
                  <DetalisFormatted key={title} title={title} detail={value} />
                ))}
            </div>

            {/* Submitted data */}
            {selectedLog.payload &&
              Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <h4 className="mb-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-700">
                    Submitted Data
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(selectedLog.payload).map(
                      ([key, value], index) => {
                        if (skipKeys.includes(key)) return null;
                        const formattedValue = formatValue(key, value);
                        if (formattedValue === null) return null;
                        return (
                          <DetalisFormatted
                            key={index}
                            title={formatKey(key)}
                            detail={formattedValue}
                          />
                        );
                      },
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </MuiModal>
    </div>
  );
};

export default HostPanelLogs;
