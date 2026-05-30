import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import MuiModal from "../../../components/MuiModal";

const ModuleAccessLogs = () => {
  const axios = useAxiosPrivate();
  const [openModal, setOpenModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["module-access-logs"],
    queryFn: async () => {
      const response = await axios.get("/api/logs/module-access-logs");
      return response.data || [];
    },
  });

  const rows = useMemo(
    () =>
      (isLoading ? [] : data).map((item, index) => ({
        ...item,
        srNo: index + 1,
        panel: item.sourcePanel === "host_panel" ? "Host Panel" : "Master Panel",
        hostCompany: item.hostCompany || "-",
        givenBy: item.actorName || item.actorEmail || "-",
        target: item.targetName || item.targetId || "-",
        workspace: item.workspaceName || item.workspaceId || "-",
        enabledCount: Number(item?.enabledCount ?? item?.changes?.enabledCount ?? 0),
        disabledCount: Number(item?.disabledCount ?? item?.changes?.disabledCount ?? 0),
        enabledModules:
          item?.enabledModules || item?.changes?.enabledModules || [],
        disabledModules:
          item?.disabledModules || item?.changes?.disabledModules || [],
      })),
    [data, isLoading],
  );

  const columns = [
    { headerName: "Sr No", field: "srNo", width: 90 },
    { headerName: "Panel", field: "panel", width: 130 },
    { headerName: "Host Company", field: "hostCompany", flex: 1 },
    { headerName: "Access Given By", field: "givenBy", flex: 1 },
    { headerName: "Target", field: "target", flex: 1 },
    { headerName: "Workspace", field: "workspace", flex: 1 },
    { headerName: "Enabled", field: "enabledCount", width: 100 },
    { headerName: "Disabled", field: "disabledCount", width: 100 },
    {
      headerName: "Date",
      field: "createdAt",
      flex: 1,
      cellRenderer: (params) => humanDate(params.value),
    },
    {
      headerName: "View",
      field: "viewModules",
      width: 100,
      cellRenderer: (params) => (
        <button
          type="button"
          className="underline text-primary"
          onClick={() => {
            setSelectedRow(params.data || {});
            setOpenModal(true);
          }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <YearWiseTable
        data={rows}
        columns={columns}
        dateColumn="createdAt"
        tableHeight={400}
        tableTitle="Module Access Logs"
        exportData={true}
        search={true}
        filterExcludeColumns={["createdAt"]}
      />

      <MuiModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Module Access Changes"
      >
        <div className="grid grid-cols-1 gap-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-semibold">Panel:</span> {selectedRow?.panel || "-"}
            </div>
            <div>
              <span className="font-semibold">Host Company:</span>{" "}
              {selectedRow?.hostCompany || "-"}
            </div>
            <div>
              <span className="font-semibold">Given By:</span> {selectedRow?.givenBy || "-"}
            </div>
            <div>
              <span className="font-semibold">Target:</span> {selectedRow?.target || "-"}
            </div>
            <div>
              <span className="font-semibold">Workspace:</span>{" "}
              {selectedRow?.workspace || "-"}
            </div>
            <div>
              <span className="font-semibold">Date:</span>{" "}
              {selectedRow?.createdAt ? humanDate(selectedRow.createdAt) : "-"}
            </div>
            <div>
              <span className="font-semibold">Enabled Count:</span>{" "}
              {selectedRow?.enabledCount ?? 0}
            </div>
            <div>
              <span className="font-semibold">Disabled Count:</span>{" "}
              {selectedRow?.disabledCount ?? 0}
            </div>
          </div>
          <div>
            <div className="font-semibold text-green-700">Enabled Modules</div>
            <div className="mt-1">
              {(selectedRow?.enabledModules || []).length
                ? (selectedRow.enabledModules || []).join(", ")
                : "-"}
            </div>
          </div>
          <div>
            <div className="font-semibold text-red-700">Disabled Modules</div>
            <div className="mt-1">
              {(selectedRow?.disabledModules || []).length
                ? (selectedRow.disabledModules || []).join(", ")
                : "-"}
            </div>
          </div>
        </div>
      </MuiModal>
    </div>
  );
};

export default ModuleAccessLogs;
