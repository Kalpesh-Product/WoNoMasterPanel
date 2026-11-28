import ReactApexChart from "react-apexcharts";
import { ChartCard } from "../MainDashboard/charts/charts";

const FONT = "Poppins-SemiBold, sans-serif";
const DISPLAY_LIMIT = 15;

const GeographicUsersChart = ({ data, title }) => {
  const items = (Array.isArray(data) ? data : []).slice(0, DISPLAY_LIMIT);
  const chartHeight = Math.max(280, items.length * 30);

  const options = {
    chart: {
      type: "bar",
      fontFamily: FONT,
      toolbar: { show: false },
      animations: { enabled: true, speed: 350 },
    },
    colors: ["#2563EB", "#10B981"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: "68%",
      },
    },
    dataLabels: { enabled: false },
    grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      fontFamily: FONT,
      fontSize: "10px",
      markers: { size: 5 },
    },
    xaxis: {
      categories: items.map((item) => item.label),
      min: 0,
      labels: {
        style: { fontFamily: FONT, fontSize: "9px" },
        formatter: (value) => Number(value || 0).toLocaleString("en-US"),
      },
    },
    yaxis: {
      labels: {
        maxWidth: 190,
        style: { fontFamily: FONT, fontSize: "9px" },
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (value) => Number(value || 0).toLocaleString("en-US") },
    },
  };

  return (
    <ChartCard title={title}>
      <ReactApexChart
        className="chart-tooltip-overflow-visible"
        options={options}
        series={[
          { name: "Active Users", data: items.map((item) => Number(item.activeUsers) || 0) },
          { name: "New Users", data: items.map((item) => Number(item.newUsers) || 0) },
        ]}
        type="bar"
        height={chartHeight}
      />
      {data.length > DISPLAY_LIMIT && (
        <p className="px-3 pb-3 text-[10px] font-pmedium text-slate-400">
          Showing the top {DISPLAY_LIMIT} locations. The CSV export includes all {data.length}.
        </p>
      )}
    </ChartCard>
  );
};

export default GeographicUsersChart;
