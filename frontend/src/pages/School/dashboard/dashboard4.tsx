import { useState } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import {
  FileIcon,
  CheckCircleIcon,
  ErrorIcon,
  DownloadIcon,
  PieChartIcon,
  BoxCubeIcon,
  FilterIcon,
  RefreshIcon,
  CalenderIcon,
  GroupIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BoltIcon,
  TableIcon,
  CopyIcon,
} from "../../../icons";

export default function Dashboard3() {
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [selectedCollege, setSelectedCollege] = useState("all");

  // Static data for advanced reports
  const staticData = {
    overview: {
      totalTranscripts: 15420,
      processed: 12850,
      pending: 1850,
      failed: 720,
      successRate: 83.3,
      avgProcessingTime: 2.4,
      totalArticulations: 8920,
      coursesMapped: 12450,
    },
    trends: {
      dailyProcessing: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        processed: [245, 312, 289, 356, 298, 234, 198],
        failed: [12, 18, 15, 22, 16, 14, 11],
      },
      weeklyComparison: {
        current: [1200, 1350, 1280, 1420, 1380, 1250, 1180],
        previous: [1100, 1220, 1180, 1300, 1260, 1150, 1100],
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      },
    },
    statusDistribution: {
      transcript: {
        labels: ["Processed", "Pending", "Failed", "Rerun", "Kickout"],
        series: [12850, 1850, 720, 450, 550],
      },
      articulation: {
        labels: ["Completed", "In Progress", "Failed", "Pending Review"],
        series: [8920, 2340, 890, 1270],
      },
    },
    topColleges: [
      { name: "Ohio State University", transcripts: 3420, successRate: 87.5, trend: "+5.2%" },
      { name: "Miami University", transcripts: 2890, successRate: 85.3, trend: "+3.8%" },
      { name: "University of Cincinnati", transcripts: 2560, successRate: 82.1, trend: "-1.2%" },
      { name: "Kent State University", transcripts: 2130, successRate: 88.9, trend: "+7.1%" },
      { name: "Bowling Green State", transcripts: 1890, successRate: 79.6, trend: "+2.4%" },
    ],
    errorBreakdown: [
      { type: "OCR Errors", count: 320, percentage: 44.4, color: "#EF4444" },
      { type: "Data Validation", count: 180, percentage: 25.0, color: "#F59E0B" },
      { type: "Articulation Mapping", count: 120, percentage: 16.7, color: "#8B5CF6" },
      { type: "System Errors", count: 100, percentage: 13.9, color: "#64748B" },
    ],
    recentActivity: [
      { id: 1, action: "Batch Processed", college: "Ohio State", count: 245, time: "2 hours ago", status: "success" },
      { id: 2, action: "Articulation Completed", college: "Miami University", count: 189, time: "3 hours ago", status: "success" },
      { id: 3, action: "Error Detected", college: "UC", count: 12, time: "4 hours ago", status: "error" },
      { id: 4, action: "Batch Uploaded", college: "Kent State", count: 156, time: "5 hours ago", status: "success" },
      { id: 5, action: "Rerun Initiated", college: "BGSU", count: 45, time: "6 hours ago", status: "pending" },
    ],
    performanceMetrics: {
      avgResponseTime: 1.8,
      systemUptime: 99.8,
      dailyThroughput: 892,
      peakHour: "2:00 PM",
      bottleneck: "Articulation Processing",
    },
  };

  // Chart configurations
  const lineChartOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    markers: {
      size: 5,
      hover: { size: 7 },
    },
    xaxis: {
      categories: staticData.trends.dailyProcessing.labels,
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: "#64748B" },
    },
    colors: ["#10B981", "#EF4444"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: { formatter: (val) => val.toLocaleString() },
    },
  };

  const areaChartOptions: ApexOptions = {
    chart: {
      type: "area",
      height: 350,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
      },
    },
    xaxis: {
      categories: staticData.trends.weeklyComparison.labels,
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: "#64748B" },
    },
    colors: ["#3C50E0", "#8B5CF6"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: { formatter: (val) => val.toLocaleString() },
    },
  };

  const donutChartOptions = (labels: string[]): ApexOptions => ({
    chart: {
      type: "donut",
      height: 300,
    },
    labels: labels,
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "12px",
      labels: { colors: "#64748B" },
    },
    colors: ["#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#3C50E0"],
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              color: "#64748B",
              formatter: () => {
                return staticData.statusDistribution.transcript.series.reduce((a, b) => a + b, 0).toLocaleString();
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (val) => val.toLocaleString() },
    },
  });

  const barChartOptions: ApexOptions = {
    chart: {
      type: "bar",
      height: 350,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "60%",
        borderRadius: 5,
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: staticData.errorBreakdown.map((e) => e.type),
      labels: {
        style: { colors: "#64748B", fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
    },
    colors: staticData.errorBreakdown.map((e) => e.color),
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: { formatter: (val) => val.toLocaleString() },
    },
  };

  const StatCard = ({
    title,
    value,
    change,
    icon,
    color,
    subtitle,
  }: {
    title: string;
    value: string | number;
    change?: string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }) => (
    <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
          <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </h4>
          {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
          {change && (
            <span
              className={`mt-2 flex items-center gap-1 text-sm font-medium ${
                change.startsWith("+") ? "text-green-600" : "text-red-600"
              }`}
            >
              {change.startsWith("+") ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
              {change}
            </span>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color} bg-opacity-10`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const handleExport = (format: "pdf" | "excel" | "csv") => {
    // Placeholder for export functionality
    console.log(`Exporting report as ${format}`);
    alert(`Export functionality will be implemented. Format: ${format}`);
  };

  return (
    <PageWrapper>
      <PageMeta title="Advanced Dashboard | OSUCSC" description="Advanced analytics and reporting dashboard" />
      <PageBreadcrumb pageTitle="Advanced Dashboard" />

      <PageContainer>
        {/* Header with Filters and Actions */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Advanced Analytics Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Comprehensive reports and performance metrics
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark-2"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="1year">Last Year</option>
            </select>

            {/* College Filter */}
            <select
              value={selectedCollege}
              onChange={(e) => setSelectedCollege(e.target.value)}
              className="rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark-2"
            >
              <option value="all">All Colleges</option>
              <option value="osu">Ohio State University</option>
              <option value="miami">Miami University</option>
              <option value="uc">University of Cincinnati</option>
            </select>

            {/* Export Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => handleExport("pdf")}
              >
                <DownloadIcon className="w-4 h-4" />
                Export
              </Button>
            </div>

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Transcripts"
            value={staticData.overview.totalTranscripts}
            change="+12.5%"
            icon={<FileIcon className="w-6 h-6 text-blue-500" />}
            color="bg-blue-500"
            subtitle="This period"
          />
          <StatCard
            title="Successfully Processed"
            value={staticData.overview.processed}
            change="+8.2%"
            icon={<CheckCircleIcon className="w-6 h-6 text-green-500" />}
            color="bg-green-500"
            subtitle={`${staticData.overview.successRate}% success rate`}
          />
          <StatCard
            title="Processing Errors"
            value={staticData.overview.failed}
            change="-3.1%"
            icon={<ErrorIcon className="w-6 h-6 text-red-500" />}
            color="bg-red-500"
            subtitle="Requires attention"
          />
          <StatCard
            title="Total Articulations"
            value={staticData.overview.totalArticulations}
            change="+15.7%"
            icon={<BoltIcon className="w-6 h-6 text-purple-500" />}
            color="bg-purple-500"
            subtitle="Courses mapped"
          />
        </div>

        {/* Secondary Metrics */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</span>
                <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                  {staticData.overview.successRate}%
                </h4>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 bg-opacity-10">
                <PieChartIcon className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${staticData.overview.successRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Processing Time</span>
                <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                  {staticData.overview.avgProcessingTime}s
                </h4>
                <p className="mt-1 text-xs text-green-600">-0.5s from last week</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 bg-opacity-10">
                <BoxCubeIcon className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">System Uptime</span>
                <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                  {staticData.performanceMetrics.systemUptime}%
                </h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Last 30 days</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 bg-opacity-10">
                <BoltIcon className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Charts Row */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Daily Processing Trend */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Daily Processing Trend</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last 7 days performance</p>
              </div>
            </div>
            <div className="h-[350px]">
              <Chart
                options={lineChartOptions}
                series={[
                  { name: "Processed", data: staticData.trends.dailyProcessing.processed },
                  { name: "Failed", data: staticData.trends.dailyProcessing.failed },
                ]}
                type="line"
                height="100%"
              />
            </div>
          </div>

          {/* Weekly Comparison */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Weekly Comparison</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current vs Previous Month</p>
              </div>
            </div>
            <div className="h-[350px]">
              <Chart
                options={areaChartOptions}
                series={[
                  { name: "Current Month", data: staticData.trends.weeklyComparison.current },
                  { name: "Previous Month", data: staticData.trends.weeklyComparison.previous },
                ]}
                type="area"
                height="100%"
              />
            </div>
          </div>
        </div>

        {/* Status Distribution and Error Breakdown */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Transcript Status Distribution */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-black dark:text-white">Transcript Status Distribution</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overall status breakdown</p>
            </div>
            <div className="h-[300px]">
              <Chart
                options={donutChartOptions(staticData.statusDistribution.transcript.labels)}
                series={staticData.statusDistribution.transcript.series}
                type="donut"
                height="100%"
              />
            </div>
          </div>

          {/* Error Breakdown */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4">
              <h4 className="text-lg font-bold text-black dark:text-white">Error Breakdown</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Error types and frequency</p>
            </div>
            <div className="h-[300px]">
              <Chart
                options={barChartOptions}
                series={[{ name: "Errors", data: staticData.errorBreakdown.map((e) => e.count) }]}
                type="bar"
                height="100%"
              />
            </div>
          </div>
        </div>

        {/* Top Colleges and Recent Activity */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Performing Colleges */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">Top Performing Colleges</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">By transcript volume</p>
              </div>
              <TableIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {staticData.topColleges.map((college, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-stroke p-4 dark:border-strokedark"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                      <span className="font-semibold text-black dark:text-white">{college.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{college.transcripts.toLocaleString()} transcripts</span>
                      <span>{college.successRate}% success</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        college.trend.startsWith("+") ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {college.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">Recent Activity</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Latest system events</p>
              </div>
              <BoltIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {staticData.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between rounded-lg border border-stroke p-4 dark:border-strokedark"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-black dark:text-white">{activity.action}</span>
                      {activity.status === "success" && (
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      )}
                      {activity.status === "error" && <ErrorIcon className="w-4 h-4 text-red-500" />}
                      {activity.status === "pending" && (
                        <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{activity.college}</span>
                      <span>{activity.count} items</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-black dark:text-white">Performance Metrics</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">System performance indicators</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Response Time</div>
              <div className="mt-1 text-xl font-bold text-black dark:text-white">
                {staticData.performanceMetrics.avgResponseTime}s
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">System Uptime</div>
              <div className="mt-1 text-xl font-bold text-black dark:text-white">
                {staticData.performanceMetrics.systemUptime}%
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Daily Throughput</div>
              <div className="mt-1 text-xl font-bold text-black dark:text-white">
                {staticData.performanceMetrics.dailyThroughput}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Peak Hour</div>
              <div className="mt-1 text-xl font-bold text-black dark:text-white">
                {staticData.performanceMetrics.peakHour}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottleneck</div>
              <div className="mt-1 text-sm font-bold text-black dark:text-white">
                {staticData.performanceMetrics.bottleneck}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </PageWrapper>
  );
}

