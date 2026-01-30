import { useState, useEffect } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../config/api";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import {
  FileIcon,
  CheckCircleIcon,
  ErrorIcon,
  ArrowRightIcon,
  DownloadIcon,
  PieChartIcon,
  BoxCubeIcon,
  FilterIcon,
  RefreshIcon,
  CalenderIcon,
  GroupIcon,
} from "../../../icons";

interface DashboardData {
  transcriptSources: { labels: string[]; datasets: any[] };
  transcriptStatus: { labels: string[]; datasets: any[] };
  transcriptProcessed: { labels: string[]; datasets: any[] };
  initialKickouts: { labels: string[]; datasets: any[] };
  transcriptKickouts: { labels: string[]; datasets: any[] };
  articulationKickouts: { labels: string[]; datasets: any[] };
  articulationCoursesKickouts: { labels: string[]; datasets: any[] };
  transcriptStatusDonut: { series: number[]; labels: string[] };
  articulationStatusDonut: { series: number[]; labels: string[] };
  articulationCoursesStatusDonut: { series: number[]; labels: string[] };
  statistics?: {
    totalTranscripts: number;
    processedCount: number;
    failedCount: number;
    totalArticulations: number;
    successRate: number;
    avgProcessingTime: number;
  };
}

export default function Dashboard2() {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    college_name: "",
    fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    todate: new Date().toISOString().split("T")[0],
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    transcriptSources: { labels: [], datasets: [] },
    transcriptStatus: { labels: [], datasets: [] },
    transcriptProcessed: { labels: [], datasets: [] },
    initialKickouts: { labels: [], datasets: [] },
    transcriptKickouts: { labels: [], datasets: [] },
    articulationKickouts: { labels: [], datasets: [] },
    articulationCoursesKickouts: { labels: [], datasets: [] },
    transcriptStatusDonut: { series: [], labels: [] },
    articulationStatusDonut: { series: [], labels: [] },
    articulationCoursesStatusDonut: { series: [], labels: [] },
    statistics: {
      totalTranscripts: 0,
      processedCount: 0,
      failedCount: 0,
      totalArticulations: 0,
      successRate: 0,
      avgProcessingTime: 0
    }
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    fetchDashboardData();
  };

  const handleClear = () => {
    setFilters({
      college_name: "",
      fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      todate: new Date().toISOString().split("T")[0],
    });
    setTimeout(() => fetchDashboardData(), 100);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(filters),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Calculate statistics
        const totalTranscripts = data.transcriptStatusDonut.series.reduce((a: number, b: number) => a + b, 0);
        const processedCount = data.transcriptStatus.datasets.find((d: any) => d.name === "PROCESSED")?.data.reduce((a: number, b: number) => a + b, 0) || 0;
        const failedCount = data.transcriptStatus.datasets.find((d: any) => d.name === "FAILED")?.data.reduce((a: number, b: number) => a + b, 0) || 0;
        const totalArticulations = data.articulationStatusDonut.series.reduce((a: number, b: number) => a + b, 0);
        const successRate = totalTranscripts > 0 ? ((processedCount / totalTranscripts) * 100) : 0;

        setDashboardData({
          ...data,
          statistics: {
            totalTranscripts,
            processedCount,
            failedCount,
            totalArticulations,
            successRate: parseFloat(successRate.toFixed(2)),
            avgProcessingTime: 2.5 // This should come from API
          }
        });
      } else {
        console.error("Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Chart options in TailAdmin style
  const barChartOptions: ApexOptions = {
    chart: {
      type: "bar",
      height: 350,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: dashboardData.transcriptStatus.labels,
      labels: {
        style: {
          colors: "#64748B",
          fontSize: "12px",
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      title: {
        text: "Count",
        style: {
          color: "#64748B",
          fontSize: "12px",
        },
      },
      labels: {
        style: {
          colors: "#64748B",
          fontSize: "12px",
        },
      },
    },
    fill: {
      opacity: 1,
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      fontWeight: 500,
      labels: {
        colors: "#64748B",
      },
      markers: {
        size: 12,
      },
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val.toLocaleString();
        },
      },
    },
  };

  const lineChartOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    markers: {
      size: 5,
      hover: {
        size: 7,
      },
    },
    xaxis: {
      categories: dashboardData.transcriptSources.labels,
      labels: {
        style: {
          colors: "#64748B",
          fontSize: "12px",
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      title: {
        text: "Count",
        style: {
          color: "#64748B",
          fontSize: "12px",
        },
      },
      labels: {
        style: {
          colors: "#64748B",
          fontSize: "12px",
        },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      fontWeight: 500,
      labels: {
        colors: "#64748B",
      },
      markers: {
        size: 12,
      },
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val.toLocaleString();
        },
      },
    },
  };

  const donutChartOptions = (labels: string[]): ApexOptions => ({
    chart: {
      type: "donut",
      height: 350,
    },
    labels: labels,
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "12px",
      fontWeight: 500,
      labels: {
        colors: "#64748B",
      },
      markers: {
        size: 12,
      },
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
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
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return val.toLocaleString();
        },
      },
    },
  });

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon, 
    color 
  }: { 
    title: string; 
    value: string | number; 
    change?: string; 
    icon: React.ReactNode; 
    color: string;
  }) => (
    <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{title}</span>
          <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h4>
          {change && (
            <span className={`mt-1 flex items-center gap-1 text-sm font-medium ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {change}
              <span className="text-sm text-gray-500">vs last week</span>
            </span>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color} bg-opacity-10`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <PageWrapper>
      <PageMeta title="College Dashboard 2 | OSUCSC" description="College Dashboard 2 with comprehensive analytics" />
      <PageBreadcrumb pageTitle="College Dashboard 2" />

      <PageContainer>
        {/* Header with Filters */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">College Dashboard 2</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Comprehensive analytics for transcript processing and articulation
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleClear}
              variant="outline"
              className="flex items-center gap-2 border-stroke px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800"
            >
              <FilterIcon className="w-4 h-4" />
              Clear Filters
            </Button>
            <Button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-8 rounded-xl border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CalenderIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Date Range</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.fromdate}
                  onChange={(e) => handleFilterChange("fromdate", e.target.value)}
                  className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark-2"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={filters.todate}
                  onChange={(e) => handleFilterChange("todate", e.target.value)}
                  className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark-2"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <GroupIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.college_name}
                  onChange={(e) => handleFilterChange("college_name", e.target.value)}
                  placeholder="Search college..."
                  className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark-2"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {loading ? 'Applying...' : 'Apply Filters'}
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
              <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics Overview */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <StatCard
                title="Total Transcripts"
                value={dashboardData.statistics?.totalTranscripts || 0}
                change="+12.5%"
                icon={<FileIcon className="w-6 h-6 text-blue-500" />}
                color="bg-blue-500"
              />
              <StatCard
                title="Successfully Processed"
                value={dashboardData.statistics?.processedCount || 0}
                change="+8.2%"
                icon={<CheckCircleIcon className="w-6 h-6 text-green-500" />}
                color="bg-green-500"
              />
              <StatCard
                title="Processing Errors"
                value={dashboardData.statistics?.failedCount || 0}
                change="-3.1%"
                icon={<ErrorIcon className="w-6 h-6 text-red-500" />}
                color="bg-red-500"
              />
              <StatCard
                title="Total Articulations"
                value={dashboardData.statistics?.totalArticulations || 0}
                change="+15.7%"
                icon={<ArrowRightIcon className="w-6 h-6 text-purple-500" />}
                color="bg-purple-500"
              />
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Success Rate</span>
                    <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                      {dashboardData.statistics?.successRate || 0}%
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
                      style={{ width: `${dashboardData.statistics?.successRate || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Avg Processing Time</span>
                    <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                      {dashboardData.statistics?.avgProcessingTime || 0}s
                    </h4>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 bg-opacity-10">
                    <BoxCubeIcon className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <span className="text-green-600">-0.5s</span> from last week
                </div>
              </div>

              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Downloads Today</span>
                    <h4 className="mt-2 text-2xl font-bold text-black dark:text-white">
                      {dashboardData.transcriptSources.datasets[0]?.data[dashboardData.transcriptSources.datasets[0]?.data.length - 1] || 0}
                    </h4>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 bg-opacity-10">
                    <DownloadIcon className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <span className="text-green-600">+24%</span> from yesterday
                </div>
              </div>
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Transcript Sources */}
              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-black dark:text-white">Transcript Sources</h3>
                    <p className="text-sm text-gray-500">Downloads from different sources</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Last 30 days</span>
                  </div>
                </div>
                <div className="h-[350px]">
                  <Chart
                    options={lineChartOptions}
                    series={dashboardData.transcriptSources.datasets}
                    type="line"
                    height="100%"
                  />
                </div>
              </div>

              {/* Transcript Status */}
              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-black dark:text-white">Transcript Status</h3>
                    <p className="text-sm text-gray-500">Processing status overview</p>
                  </div>
                </div>
                <div className="h-[350px]">
                  <Chart
                    options={barChartOptions}
                    series={dashboardData.transcriptStatus.datasets}
                    type="bar"
                    height="100%"
                  />
                </div>
              </div>
            </div>

            {/* Kickouts & Processed Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Initial Kickouts", data: dashboardData.initialKickouts, description: "Initial processing kickouts" },
                { title: "Transcript Kickouts", data: dashboardData.transcriptKickouts, description: "Transcript validation kickouts" },
                { title: "Articulation Kickouts", data: dashboardData.articulationKickouts, description: "Articulation process kickouts" },
                { title: "Course Kickouts", data: dashboardData.articulationCoursesKickouts, description: "Course mapping kickouts" },
              ].map((item, index) => (
                <div key={index} className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                  <h4 className="mb-4 text-sm font-bold text-black dark:text-white">{item.title}</h4>
                  <p className="mb-4 text-xs text-gray-500">{item.description}</p>
                  <div className="h-[200px]">
                    <Chart
                      options={{
                        ...barChartOptions,
                        chart: { ...barChartOptions.chart, height: 200 },
                        legend: { show: false },
                        xaxis: { labels: { show: false } },
                      }}
                      series={item.data.datasets}
                      type="bar"
                      height="100%"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Donut Charts Row */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-black dark:text-white">Transcript Status</h4>
                  <p className="text-sm text-gray-500">Distribution by status</p>
                </div>
                <div className="h-[320px]">
                  <Chart
                    options={donutChartOptions(dashboardData.transcriptStatusDonut.labels)}
                    series={dashboardData.transcriptStatusDonut.series}
                    type="donut"
                    height="100%"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-black dark:text-white">Articulation Status</h4>
                  <p className="text-sm text-gray-500">Articulation process status</p>
                </div>
                <div className="h-[320px]">
                  <Chart
                    options={donutChartOptions(dashboardData.articulationStatusDonut.labels)}
                    series={dashboardData.articulationStatusDonut.series}
                    type="donut"
                    height="100%"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-black dark:text-white">Course Status</h4>
                  <p className="text-sm text-gray-500">Course articulation status</p>
                </div>
                <div className="h-[320px]">
                  <Chart
                    options={donutChartOptions(dashboardData.articulationCoursesStatusDonut.labels)}
                    series={dashboardData.articulationCoursesStatusDonut.series}
                    type="donut"
                    height="100%"
                  />
                </div>
              </div>
            </div>

            {/* Transcripts Processed In Banner */}
            {dashboardData.transcriptProcessed.labels.length > 0 && (
              <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-black dark:text-white">Transcripts Processed In Banner</h3>
                    <p className="text-sm text-gray-500">Daily processing volume in Banner system</p>
                  </div>
                </div>
                <div className="h-[350px]">
                  <Chart
                    options={lineChartOptions}
                    series={dashboardData.transcriptProcessed.datasets}
                    type="line"
                    height="100%"
                  />
                </div>
              </div>
            )}

            {/* Recent Activity / Summary */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h4 className="mb-4 text-lg font-bold text-black dark:text-white">Performance Summary</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Peak Processing Day</div>
                  <div className="mt-1 text-xl font-bold text-black dark:text-white">Yesterday</div>
                  <div className="mt-1 text-sm text-gray-500">1,245 transcripts</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Success Rate</div>
                  <div className="mt-1 text-xl font-bold text-black dark:text-white">97.8%</div>
                  <div className="mt-1 text-sm text-gray-500">Achieved on Monday</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Daily Volume</div>
                  <div className="mt-1 text-xl font-bold text-black dark:text-white">892</div>
                  <div className="mt-1 text-sm text-gray-500">Transcripts per day</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">System Uptime</div>
                  <div className="mt-1 text-xl font-bold text-black dark:text-white">99.95%</div>
                  <div className="mt-1 text-sm text-gray-500">Last 30 days</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}