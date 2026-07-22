import PageFrame from "../../../../components/Pages/PageFrame";
import PrimaryButton from "../../../../components/PrimaryButton";

const FrontendWebsiteIssueReports = () => {
  const websiteIssueReportsColumn = [
    { field: "id", headerName: "Sr No", width: 100 },
    { field: "dueBy", headerName: "Due By" },
    { field: "clientName", headerName: "Client Name" },
    { field: "issue", headerName: "Issue" },
    { field: "department", headerName: "Department" },
    { field: "status", headerName: "Status" },
    {
      field: "priority",
      headerName: "Priority",
      cellRenderer: (params) => {
        const priority = params.value.toLowerCase();
        let colorClass = "";
        if (priority === "low") colorClass = "bg-green-500";
        else if (priority === "medium") colorClass = "bg-yellow-500";
        else if (priority === "high") colorClass = "bg-red-500";
        return (
          <div className="flex items-center">
            <span className={`w-2 h-2 rounded-full ${colorClass} mr-2`}></span>
            <span>{params.value}</span>
          </div>
        );
      },
    },
    {
      field: "action",
      headerName: "Action",
      cellRenderer: (params) => (
        <div className="p-2">
          <PrimaryButton
            title="View Details"
            handleSubmit={() => ("View Details clicked for id", params.data.id)}
          />
        </div>
      ),
    },
  ];

  const rows = [
    { id: 1, dueBy: "07-02-2025", clientName: "Dane John", issue: "Website is down", department: "IT", status: "Open", priority: "Low" },
    { id: 2, dueBy: "08-02-2025", clientName: "Alice Smith", issue: "Links are not working", department: "HR", status: "Open", priority: "Medium" },
    { id: 3, dueBy: "09-02-2025", clientName: "Bob Brown", issue: "Domain is expired", department: "Administration", status: "Assigned", priority: "High" },
    { id: 4, dueBy: "10-02-2025", clientName: "Charlie Davis", issue: "Website is down", department: "Sales", status: "Closed", priority: "Low" },
    { id: 5, dueBy: "11-02-2025", clientName: "Eve Foster", issue: "Domain is expired", department: "Finance", status: "Open", priority: "High" },
    { id: 6, dueBy: "12-02-2025", clientName: "Frank Green", issue: "Website is down", department: "IT", status: "Paused", priority: "Medium" },
    { id: 7, dueBy: "13-02-2025", clientName: "Grace Hill", issue: "Links are not working", department: "Sales", status: "Open", priority: "Low" },
    { id: 8, dueBy: "14-02-2025", clientName: "Henry Ivy", issue: "Domain is expired", department: "IT", status: "Open", priority: "High" },
    { id: 9, dueBy: "15-02-2025", clientName: "Irene Jacobs", issue: "Website is down", department: "Administration", status: "Closed", priority: "Medium" },
    { id: 10, dueBy: "16-02-2025", clientName: "Jack King", issue: "Website is down", department: "HR", status: "Assigned", priority: "Low" },
    { id: 11, dueBy: "17-02-2025", clientName: "Karen Lewis", issue: "Links are not working", department: "Finance", status: "Open", priority: "High" },
    { id: 12, dueBy: "18-02-2025", clientName: "Leo Martin", issue: "Domain is expired", department: "Administration", status: "Closed", priority: "Medium" },
    { id: 13, dueBy: "19-02-2025", clientName: "Mona Nash", issue: "Domain is expired", department: "Sales", status: "Unassigned", priority: "Low" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageFrame>
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100/60">
            <h3 className="text-sm font-pmedium text-slate-900">Website Issue Reports</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  {websiteIssueReportsColumn.filter(c => c.headerName).map((col) => (
                    <th key={col.field} className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">{col.headerName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={websiteIssueReportsColumn.length} className="text-center py-10 text-slate-400 font-pmedium">No data</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.id}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.dueBy}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.clientName}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.issue}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.department}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.status}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${row.priority === "Low" ? "bg-green-500" : row.priority === "Medium" ? "bg-yellow-500" : "bg-red-500"}`}></span>
                          {row.priority}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <PrimaryButton title="View Details" handleSubmit={() => {}} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default FrontendWebsiteIssueReports;
