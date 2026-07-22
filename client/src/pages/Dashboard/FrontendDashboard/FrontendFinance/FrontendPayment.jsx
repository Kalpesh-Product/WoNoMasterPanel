import React, { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";

const FrontendPayment = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const modalRef = useRef(null);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedEvent(null);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isDrawerOpen && modalRef.current && !modalRef.current.contains(e.target)) {
        closeDrawer();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDrawerOpen]);

  const dummyData = [
    { title: "Salary Disbursement", date: "2025-04-03", amount: "4000", status: "paid" },
    { title: "Freelancer Payment", date: "2025-04-05", amount: "1200", status: "unpaid" },
    { title: "Team Bonus", date: "2025-04-10", amount: "900", status: "paid" },
    { title: "Medical Reimbursement", date: "2025-04-21", amount: "300", status: "paid" },
    { title: "Travel Allowance", date: "2025-04-20", amount: "600", status: "unpaid" },
  ];

  const statusColorMap = {
    paid: "#28a745",
    unpaid: "#dc3545",
  };

  const [statusFilters, setStatusFilters] = useState(["paid", "unpaid"]);

  const events = dummyData.map((payment) => ({
    title: payment.title,
    start: payment.date,
    backgroundColor: statusColorMap[payment.status],
    borderColor: statusColorMap[payment.status],
    extendedProps: {
      amount: payment.amount,
      status: payment.status,
    },
  }));

  const filteredEvents = events.filter((event) =>
    statusFilters.includes(event.extendedProps.status)
  );

  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col p-4 bg-white">
      <div className="flex gap-4">
        <div className="flex flex-col gap-4 w-[25%]">
          <div className="border-2 border-gray-300 rounded-md">
            <div className="w-full flex justify-start border-b-default border-borderGray p-2">
              <span className="text-content font-bold uppercase">Payment Status</span>
            </div>
            <div className="flex justify-start text-content px-2 flex-col gap-1 py-2">
              {["paid", "unpaid"].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(status)}
                    onChange={(e) => {
                      const selectedStatus = e.target.value;
                      setStatusFilters((prev) =>
                        e.target.checked
                          ? [...prev, selectedStatus]
                          : prev.filter((s) => s !== selectedStatus)
                      );
                    }}
                    value={status}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs font-pmedium capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-2 border-gray-300 rounded-md">
            <div className="mb-2 text-content font-bold uppercase border-b-default border-borderGray p-2">
              <span>Today's Payments</span>
            </div>
            <div className="px-2 max-h-[33.5vh] overflow-y-auto">
              {filteredEvents.filter((e) =>
                dayjs(e.start).isSame(dayjs(), "day")
              ).length > 0 ? (
                filteredEvents
                  .filter((e) => dayjs(e.start).isSame(dayjs(), "day"))
                  .map((event, index) => (
                    <div key={index} className="flex gap-2 items-start mb-2">
                      <div
                        className="w-3 h-3 rounded-full mt-[0.3rem]"
                        style={{ backgroundColor: event.backgroundColor }}
                      ></div>
                      <div className="flex flex-col">
                        <span className="text-content font-medium">{event.title}</span>
                        <span className="text-small text-gray-500">
                          {event.start ? dayjs(event.start).format("h:mm A") : "All Day"}
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-sm">No payments today.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full h-full overflow-y-auto">
          <FullCalendar
            headerToolbar={{
              left: "today",
              center: "prev title next",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={filteredEvents}
            contentHeight={425}
            eventClick={handleEventClick}
            dayMaxEvents={2}
            eventDisplay="block"
          />
        </div>
      </div>

      {isDrawerOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="bg-white rounded-[2rem] shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-pmedium text-slate-900">Payment Details</h3>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="flex flex-col gap-3">
                <div className="flex items-center">
                  <span className="w-[30%] text-xs font-pmedium text-slate-500">Title</span>
                  <span className="text-xs font-pmedium text-slate-900">{selectedEvent.title}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-[30%] text-xs font-pmedium text-slate-500">Date</span>
                  <span className="text-xs font-pmedium text-slate-900">{dayjs(selectedEvent.start).format("YYYY-MM-DD")}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-[30%] text-xs font-pmedium text-slate-500">Status</span>
                  <span className={`text-xs font-pmedium capitalize ${
                    selectedEvent.extendedProps.status === "paid" ? "text-emerald-600" : "text-red-600"
                  }`}>{selectedEvent.extendedProps.status}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-[30%] text-xs font-pmedium text-slate-500">Amount</span>
                  <span className="text-xs font-pmedium text-slate-900">
                    {Number(selectedEvent.extendedProps.amount).toLocaleString("en-IN")} INR
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrontendPayment;
