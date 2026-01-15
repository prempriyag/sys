import { useState, useEffect } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../config/api";
import Chart from "react-apexcharts";
import { RefreshIcon } from "../../../icons";
import { ApexOptions } from "apexcharts";

export default function CollegeDashboard() {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    college_name: "",
    fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    todate: new Date().toISOString().split("T")[0],
  });

  const [dashboardData, setDashboardData] = useState({
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
        setDashboardData(data);
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

  // Calculate statistics
  const totalTranscripts = dashboardData.transcriptStatusDonut.series.reduce((a: number, b: number) => a + b, 0);
  const totalArticulations = dashboardData.articulationStatusDonut.series.reduce((a: number, b: number) => a + b, 0);
  const processedCount = dashboardData.transcriptStatus.datasets.find((d: any) => d.name === "PROCESSED")?.data.reduce((a: number, b: number) => a + b, 0) || 0;
  const failedCount = dashboardData.transcriptStatus.datasets.find((d: any) => d.name === "FAILED")?.data.reduce((a: number, b: number) => a + b, 0) || 0;

  // Chart options with glassmorphic styling
  const barChartOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      background: "transparent",
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 8,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: { 
      categories: dashboardData.transcriptStatus.labels,
      labels: { style: { colors: "#64748b" } }
    },
    yaxis: { 
      title: { text: "Count", style: { color: "#64748b" } },
      labels: { style: { colors: "#64748b" } }
    },
    fill: { opacity: 1 },
    legend: { 
      position: "top",
      labels: { colors: "#64748b" }
    },
    colors: ["#3C50E0", "#8FD0EF", "#80CAEE", "#F59E0B", "#EF4444"],
    grid: {
      borderColor: "rgba(148, 163, 184, 0.1)",
      strokeDashArray: 4,
    },
    tooltip: {
      theme: "dark",
    },
  };

  const lineChartOptions: ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      background: "transparent",
      zoom: { enabled: false },
    },
    stroke: { curve: "smooth", width: 3 },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: dashboardData.transcriptSources.labels,
      labels: { style: { colors: "#64748b" } }
    },
    yaxis: { 
      title: { text: "Count", style: { color: "#64748b" } },
      labels: { style: { colors: "#64748b" } }
    },
    legend: { 
      position: "top",
      labels: { colors: "#64748b" }
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444"],
    grid: {
      borderColor: "rgba(148, 163, 184, 0.1)",
      strokeDashArray: 4,
    },
    tooltip: {
      theme: "dark",
    },
    markers: {
      size: 5,
      hover: { size: 7 }
    },
  };

  const donutChartOptions = (labels: string[]): ApexOptions => ({
    chart: { 
      type: "donut",
      fontFamily: "Inter, sans-serif",
      background: "transparent",
    },
    labels,
    legend: { 
      position: "bottom",
      labels: { colors: "#64748b" }
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
    tooltip: {
      theme: "dark",
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
        },
      },
    },
  });

  const StatCard = ({ title, value, subtitle, icon, gradient }: { title: string; value: string | number; subtitle?: string; icon?: any; gradient: string }) => (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl animate-fade-in`}
      style={{
        background: `linear-gradient(135deg, ${gradient.split(' ')[1]}15 0%, ${gradient.split(' ')[3]}15 100%)`,
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
          {icon && <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">{icon}</div>}
        </div>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</h3>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
    </div>
  );

  return (
    <PageWrapper>
      <PageMeta title="College Dashboard | OSUCSC" description="College Dashboard with comprehensive analytics" />
      <PageBreadcrumb pageTitle="College Dashboard" />

      <PageContainer>
        {/* Glassmorphic Filter Section */}
        <div
          className="mb-8 rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">College Name</label>
              <input
                type="text"
                value={filters.college_name}
                onChange={(e) => handleFilterChange("college_name", e.target.value)}
                placeholder="Search college..."
                className="w-full rounded-xl border border-white/20 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800/50 dark:text-white/90 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">From Date</label>
              <input
                type="date"
                value={filters.fromdate}
                onChange={(e) => handleFilterChange("fromdate", e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800/50 dark:text-white/90"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">To Date</label>
              <input
                type="date"
                value={filters.todate}
                onChange={(e) => handleFilterChange("todate", e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800/50 dark:text-white/90"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 transition-all duration-200 hover:scale-105">
                {loading ? "Loading..." : "Submit"}
              </Button>
              <Button onClick={handleClear} variant="outline" className="transition-all duration-200 hover:scale-105">
                Clear
              </Button>
              <Button onClick={fetchDashboardData} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />} className="transition-all duration-200 hover:scale-105">
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent"></div>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Loading dashboard data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Transcripts"
                value={totalTranscripts}
                subtitle="All transcript records"
                gradient="from-blue-500 to-blue-600"
              />
              <StatCard
                title="Processed"
                value={processedCount}
                subtitle="Successfully processed"
                gradient="from-green-500 to-green-600"
              />
              <StatCard
                title="Failed"
                value={failedCount}
                subtitle="Processing errors"
                gradient="from-red-500 to-red-600"
              />
              <StatCard
                title="Total Articulations"
                value={totalArticulations}
                subtitle="Articulation records"
                gradient="from-purple-500 to-purple-600"
              />
            </div>

            {/* Transcripts Downloaded From Sources */}
            <div
              className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
              style={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                backdropFilter: "blur(20px)",
              }}
            >
              <h3 className="mb-6 text-xl font-bold text-gray-800 dark:text-white">Transcripts Downloaded From Sources</h3>
              <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <Chart options={lineChartOptions} series={dashboardData.transcriptSources.datasets} type="line" height={350} />
              </div>
            </div>

            {/* Transcript Status */}
            <div
              className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
              style={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                backdropFilter: "blur(20px)",
              }}
            >
              <h3 className="mb-6 text-xl font-bold text-gray-800 dark:text-white">Transcript Status</h3>
              <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                <Chart options={barChartOptions} series={dashboardData.transcriptStatus.datasets} type="bar" height={350} />
              </div>
            </div>

            {/* Transcripts Processed In Banner */}
            {dashboardData.transcriptProcessed.labels.length > 0 && (
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-xl font-bold text-gray-800 dark:text-white">Transcripts Processed In Banner</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart options={lineChartOptions} series={dashboardData.transcriptProcessed.datasets} type="line" height={350} />
                </div>
              </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Initial Kickouts and Processed */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Initial Kickouts and Processed</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart options={barChartOptions} series={dashboardData.initialKickouts.datasets} type="bar" height={280} />
                </div>
              </div>

              {/* Transcripts Kickouts and Processed */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Transcripts Kickouts and Processed</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart options={barChartOptions} series={dashboardData.transcriptKickouts.datasets} type="bar" height={280} />
                </div>
              </div>

              {/* Articulation Kickouts and Processed */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Articulation Kickouts and Processed</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart options={barChartOptions} series={dashboardData.articulationKickouts.datasets} type="bar" height={280} />
                </div>
              </div>

              {/* Articulation Courses Kickouts and Processed */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Articulation Courses Kickouts and Processed</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart options={barChartOptions} series={dashboardData.articulationCoursesKickouts.datasets} type="bar" height={280} />
                </div>
              </div>
            </div>

            {/* Donut Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Transcript Status Donut */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Transcript Status</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart
                    options={donutChartOptions(dashboardData.transcriptStatusDonut.labels)}
                    series={dashboardData.transcriptStatusDonut.series}
                    type="donut"
                    height={320}
                  />
                </div>
              </div>

              {/* Articulation Status Donut */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Articulation Status</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart
                    options={donutChartOptions(dashboardData.articulationStatusDonut.labels)}
                    series={dashboardData.articulationStatusDonut.series}
                    type="donut"
                    height={320}
                  />
                </div>
              </div>

              {/* Articulation Courses Status Donut */}
              <div
                className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in hover:shadow-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <h3 className="mb-6 text-lg font-bold text-gray-800 dark:text-white">Articulation Courses Status</h3>
                <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                  <Chart
                    options={donutChartOptions(dashboardData.articulationCoursesStatusDonut.labels)}
                    series={dashboardData.articulationCoursesStatusDonut.series}
                    type="donut"
                    height={320}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </PageWrapper>
  );
}
