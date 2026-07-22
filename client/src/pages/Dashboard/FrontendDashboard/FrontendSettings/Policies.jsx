import { IoMdDownload } from "react-icons/io";
import { MdUpload } from "react-icons/md";
import PrimaryButton from "../../../../components/PrimaryButton";

const Policies = () => {
  const uploadItems = ["Upload Policies"];
  const policiesUploadDataColumns = [
    { field: "srNo", headerName: "Sr No", flex: 1 },
    { field: "templateName", headerName: "Template Name", flex: 1 },
    { field: "uploadedBy", headerName: "Uploaded By", flex: 1 },
    { field: "date", headerName: "Date", flex: 1 },
  ];

  const policiesUploadData = [
    { srNo: 1, templateName: "Upload Policies", uploadedBy: "John Doe", date: "01-03-2025" },
    { srNo: 2, templateName: "Upload Policies", uploadedBy: "Jane Smith", date: "08-03-2025" },
    { srNo: 3, templateName: "Upload Policies", uploadedBy: "Michael Johnson", date: "15-03-2025" },
    { srNo: 4, templateName: "Upload Policies", uploadedBy: "Emily Davis", date: "22-03-2025" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <span className="text-title font-pmedium text-primary">Upload Policies</span>
      <hr />

      <div className="grid lg:grid-cols-3 md:grid-col-3 sm:grid-col-1">
        {uploadItems.map((item, index) => (
          <div className="space-y-2 border-default p-4 rounded-md" key={index}>
            <div className="mb-2">
              <span className="text-subtitle text-primary">{item}</span>
            </div>
            <div className="flex gap-4">
              <div className="flex items-end w-full border justify-end border-gray-200 rounded-md">
                <PrimaryButton title={"Choose File"} />
              </div>
              <div className="flex gap-2 items-center">
                <div className="bg-borderGray text-black p-2 rounded-md cursor-pointer hover:bg-gray-200 transition-all">
                  <MdUpload style={{ fill: "black" }} />
                </div>
                <div className="bg-borderGray text-black p-2 rounded-md cursor-pointer hover:bg-gray-200 transition-all">
                  <IoMdDownload style={{ fill: "black" }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100/60">
          <h3 className="text-sm font-pmedium text-slate-900">Policies Data</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
              <tr>
                {policiesUploadDataColumns.map((col) => (
                  <th key={col.field} className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">{col.headerName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policiesUploadData.length === 0 ? (
                <tr><td colSpan={policiesUploadDataColumns.length} className="text-center py-10 text-slate-400 font-pmedium">No data</td></tr>
              ) : (
                policiesUploadData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    {policiesUploadDataColumns.map((col) => (
                      <td key={col.field} className="px-5 py-4 text-xs font-pmedium text-slate-600">{row[col.field]}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Policies;
