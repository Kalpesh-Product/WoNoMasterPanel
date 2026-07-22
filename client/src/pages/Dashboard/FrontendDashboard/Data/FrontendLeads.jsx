import React, { useState, useRef, useEffect } from "react";
import { IoIosArrowDown } from "react-icons/io";
import WidgetSection from "../../../../components/WidgetSection";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import PageFrame from "../../../../components/Pages/PageFrame";
import { statusPillClass } from "../../../../lib/status-pill";

const FrontendLeads = () => {
  const axios = useAxiosPrivate();
  const { data: revenueData = [], isPending: isRevenuePending } = useQuery({
    queryKey: ["revenueData"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/sales/fetch-revenues");
        return response.data;
      } catch (error) {
        console.error("Error fetching clients data:", error);
      }
    },
  });

  const mockBusinessRevenueData = [
    {
      month: "April",
      domains: [
        {
          name: "Co-Working",
          revenue: 9,
          clients: [
            { srNo: 1, date: "01-04-2025", time: "10:00 AM", name: "Aarav Thakur", phone: "9811208753", status: "Pending" },
            { srNo: 2, date: "02-04-2025", time: "02:30 PM", name: "Bhavna Joshi", phone: "9487337194", status: "Follow-up" },
            { srNo: 3, date: "03-04-2025", time: "09:15 AM", name: "Chetan Rawal", phone: "9828899290", status: "Pending" },
            { srNo: 4, date: "04-04-2025", time: "11:45 AM", name: "Divya Saini", phone: "9751382616", status: "Follow-up" },
            { srNo: 5, date: "05-04-2025", time: "03:00 PM", name: "Eshan Dubey", phone: "9894331626", status: "Pending" },
            { srNo: 6, date: "06-04-2025", time: "01:30 PM", name: "Falguni Mehra", phone: "9741777376", status: "Follow-up" },
            { srNo: 7, date: "07-04-2025", time: "12:15 PM", name: "Gaurav Kulkarni", phone: "9837373505", status: "Pending" },
            { srNo: 8, date: "08-04-2025", time: "04:00 PM", name: "Hina Parmar", phone: "9404873976", status: "Follow-up" },
            { srNo: 9, date: "09-04-2025", time: "10:45 AM", name: "Ishaan Vyas", phone: "9487337194", status: "Pending" },
          ],
        },
        {
          name: "Workation",
          revenue: 9,
          clients: [
            { srNo: 1, date: "01-04-2025", time: "11:00 AM", name: "Kiran Bedi", phone: "9487337194", status: "Pending" },
            { srNo: 2, date: "02-04-2025", time: "03:30 PM", name: "Lalit Shukla", phone: "9828899290", status: "Follow-up" },
            { srNo: 3, date: "03-04-2025", time: "09:45 AM", name: "Meera Nair", phone: "9404873976", status: "Pending" },
            { srNo: 4, date: "04-04-2025", time: "01:15 PM", name: "Nitin Garg", phone: "9894331626", status: "Follow-up" },
            { srNo: 5, date: "05-04-2025", time: "10:30 AM", name: "Ojasvi Rana", phone: "9751382616", status: "Pending" },
            { srNo: 6, date: "06-04-2025", time: "02:45 PM", name: "Poonam Desai", phone: "9741777376", status: "Follow-up" },
            { srNo: 7, date: "07-04-2025", time: "12:00 PM", name: "Qadir Khan", phone: "9837373505", status: "Pending" },
            { srNo: 8, date: "08-04-2025", time: "04:30 PM", name: "Rhea Malhotra", phone: "9811208753", status: "Follow-up" },
          ],
        },
        {
          name: "Meetings",
          revenue: 10,
          clients: [
            { srNo: 1, date: "01-04-2025", time: "12:30 PM", name: "Umesh Yadav", phone: "9751382616", status: "Pending" },
            { srNo: 2, date: "02-04-2025", time: "04:15 PM", name: "Vandana Sethi", phone: "9837373505", status: "Follow-up" },
            { srNo: 3, date: "03-04-2025", time: "10:15 AM", name: "Waseem Ali", phone: "9828899290", status: "Pending" },
            { srNo: 4, date: "04-04-2025", time: "02:00 PM", name: "Xena Gupta", phone: "9487337194", status: "Follow-up" },
            { srNo: 5, date: "05-04-2025", time: "11:30 AM", name: "Yashwant Rao", phone: "9894331626", status: "Pending" },
            { srNo: 6, date: "06-04-2025", time: "03:45 PM", name: "Zara Sheikh", phone: "9741777376", status: "Follow-up" },
            { srNo: 7, date: "07-04-2025", time: "01:00 PM", name: "Aditi Pathak", phone: "9404873976", status: "Pending" },
            { srNo: 8, date: "08-04-2025", time: "05:00 PM", name: "Bhuvan Chawla", phone: "9811208753", status: "Follow-up" },
            { srNo: 9, date: "09-04-2025", time: "12:45 PM", name: "Chitra Bose", phone: "9751382616", status: "Pending" },
            { srNo: 10, date: "10-04-2025", time: "04:30 PM", name: "Dhruv Menon", phone: "9837373505", status: "Follow-up" },
          ],
        },
        {
          name: "Virtual Office",
          revenue: 8,
          clients: [
            { srNo: 1, date: "01-04-2025", time: "01:45 PM", name: "Esha Trivedi", phone: "9751382616", status: "Pending" },
            { srNo: 2, date: "02-04-2025", time: "05:30 PM", name: "Farooq Siddiqui", phone: "9741777376", status: "Follow-up" },
            { srNo: 3, date: "03-04-2025", time: "11:00 AM", name: "Gitanjali Roy", phone: "9837373505", status: "Pending" },
            { srNo: 4, date: "04-04-2025", time: "03:15 PM", name: "Harsh Vardhan", phone: "9487337194", status: "Follow-up" },
            { srNo: 5, date: "05-04-2025", time: "12:15 PM", name: "Indira Kaul", phone: "9828899290", status: "Pending" },
            { srNo: 6, date: "06-04-2025", time: "04:45 PM", name: "Jatin Puri", phone: "9894331626", status: "Follow-up" },
            { srNo: 7, date: "07-04-2025", time: "02:00 PM", name: "Kavita Luthra", phone: "9404873976", status: "Pending" },
            { srNo: 8, date: "08-04-2025", time: "06:00 PM", name: "Lakshmi Nair", phone: "9811208753", status: "Follow-up" },
          ],
        },
        {
          name: "Co-Living",
          revenue: 10,
          clients: [
            { srNo: 1, date: "01-04-2025", time: "02:15 PM", name: "Omkar Patil", phone: "9894331626", status: "Pending" },
            { srNo: 2, date: "02-04-2025", time: "06:30 PM", name: "Pallavi Dutta", phone: "9487337194", status: "Follow-up" },
            { srNo: 3, date: "03-04-2025", time: "12:00 PM", name: "Qasim Rizvi", phone: "9811208753", status: "Pending" },
            { srNo: 4, date: "04-04-2025", time: "04:30 PM", name: "Rekha Sharma", phone: "9828899290", status: "Follow-up" },
            { srNo: 5, date: "05-04-2025", time: "01:15 PM", name: "Siddhant Jain", phone: "9751382616", status: "Pending" },
            { srNo: 6, date: "06-04-2025", time: "05:45 PM", name: "Tanya Kohli", phone: "9741777376", status: "Follow-up" },
            { srNo: 7, date: "07-04-2025", time: "03:00 PM", name: "Ujjwal Das", phone: "9837373505", status: "Pending" },
            { srNo: 8, date: "08-04-2025", time: "07:00 PM", name: "Vaishali More", phone: "9404873976", status: "Follow-up" },
            { srNo: 9, date: "09-04-2025", time: "02:45 PM", name: "Yuvraj Singh", phone: "9487337194", status: "Pending" },
            { srNo: 10, date: "10-04-2025", time: "06:15 PM", name: "Zoya Akhtar", phone: "9894331626", status: "Follow-up" },
          ],
        },
      ],
    },
  ];

  const [selectedMonth, setSelectedMonth] = useState(
    mockBusinessRevenueData[0].month
  );

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  const selectedMonthData = mockBusinessRevenueData.find(
    (data) => data.month === selectedMonth
  );

  const graphData = [
    {
      name: "Revenue",
      data: selectedMonthData.domains.map((domain) => domain.revenue),
    },
  ];

  const options = {
    chart: { type: "bar", stacked: false, fontFamily: "Poppins-Regular" },
    xaxis: {
      categories: selectedMonthData.domains.map((domain) => domain.name),
    },
    yaxis: { title: { text: "Revenue (in Rupees)" } },
    plotOptions: {
      bar: { horizontal: false, columnWidth: "30%", borderRadius: 5 },
    },
    legend: { position: "top" },
    colors: ["#54C4A7", "#EB5C45"],
  };

  return (
    <div className="flex flex-col gap-8">
      <PageFrame>
        <div>
          <div className="flex flex-col gap-4 justify-between">
            <span className="font-pmedium text-title text-primary">
              New Leads - April 2025
            </span>
            <hr />
          </div>
          <div>
            {selectedMonthData.domains.map((domain, index) => (
              <DomainAccordion key={index} domain={domain} index={index} />
            ))}
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

const DomainAccordion = ({ domain, index }) => {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight : 0);
    }
  }, [open]);

  return (
    <div className="border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
      >
        <span className="text-sm font-pmedium text-slate-700">{domain.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-pmedium text-slate-400">{domain.clients.length} leads</span>
          <IoIosArrowDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: height }}
      >
        <div className="border-t border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
              <tr>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Sr. No.</th>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Date</th>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Time</th>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Name</th>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Phone No.</th>
                <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {domain.clients.map((client) => (
                <tr key={client.srNo} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{client.srNo}</td>
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{client.date}</td>
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{client.time}</td>
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{client.name}</td>
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{client.phone}</td>
                  <td className="px-5 py-4 text-xs font-pmedium text-slate-600">
                    <span className={statusPillClass(client.status)}>
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FrontendLeads;
