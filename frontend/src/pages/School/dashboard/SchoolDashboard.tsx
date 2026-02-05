import { useState, useEffect } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../config/api";
import Chart from "react-apexcharts";
import { RefreshIcon } from "../../../icons";
import { ApexOptions } from "apexcharts";
import ThemedLoader from "../../../components/common/ThemedLoader";

export default function SchoolDashboard() {
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
    transcriptStatusDonut: { series: [], labels: [] },
  });
  
  const [filterGradient, setFilterGradient] = useState<string>(
    "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)"
  );

  // Update gradient when dark mode changes
  useEffect(() => {
    const updateGradient = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setFilterGradient(
        isDark
          ? "linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(30, 41, 59, 0.15) 100%)"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)"
      );
    };

    updateGradient();
    
    // Listen for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          updateGradient();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

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
      const response = await fetch(`${API_BASE_URL}/api/school/dashboard/data`, {
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
  const totalTranscripts = dashboardData.transcriptStatusDonut?.series?.reduce((a: number, b: number) => a + b, 0) || 0;
  const processedCount = (dashboardData.transcriptStatus?.datasets?.find((d: any) => d.name === "PROCESSED") as any)?.data?.reduce((a: number, b: number) => a + b, 0) || 0;
  const failedCount = (dashboardData.transcriptStatus?.datasets?.find((d: any) => d.name === "FAILED") as any)?.data?.reduce((a: number, b: number) => a + b, 0) || 0;

  // Helper to check if chart has data
  const hasChartData = (labels: string[] | undefined, datasets: any[] | undefined) => {
    return labels && labels.length > 0 && datasets && datasets.length > 0 && datasets.some(d => d?.data?.length > 0);
  };
  
  const hasDonutData = (series: number[] | undefined, labels: string[] | undefined) => {
    return series && series.length > 0 && labels && labels.length > 0 && series.some(s => s > 0);
  };

  // No Data Component
  const NoDataPlaceholder = ({ height = 280 }: { height?: number }) => (
    <div 
      className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"
      style={{ height }}
    >
      <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm font-medium">No data available</p>
      <p className="text-xs mt-1">Try adjusting your filters</p>
    </div>
  );

  // Chart options with glassmorphic styling
  const getBarChartOptions = (categories: string[]): ApexOptions => ({
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
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: { enabled: false },
    stroke: { 
      show: true,
      width: 2,
      colors: ["transparent"]
    },
    xaxis: { 
      categories: categories,
      labels: { style: { colors: "#64748b" } }
    },
    yaxis: { 
      title: { text: "Count", style: { color: "#64748b" } },
      labels: { style: { colors: "#64748b" } }
    },
    fill: { opacity: 1 },
    legend: { 
      position: "top",
      labels: { 
        colors: "#64748b",
        useSeriesColors: false,
      },
      markers: {
        shape: "circle",
      },
      formatter: function(seriesName: string) {
        return seriesName.charAt(0).toUpperCase() + seriesName.slice(1).toLowerCase();
      }
    },
    colors: ["#3C50E0", "#8FD0EF", "#80CAEE", "#F59E0B", "#EF4444"],
    grid: {
      borderColor: "rgba(148, 163, 184, 0.1)",
      strokeDashArray: 4,
      show: true,
    },
    tooltip: {
      theme: "light",
      style: {
        fontSize: "12px",
      },
      y: {
        formatter: function(val: number) {
          return val.toString();
        }
      }
    },
  });


  const getLineChartOptions = (categories: string[]): ApexOptions => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      fontFamily: "Inter, sans-serif",
      background: "transparent",
      zoom: { enabled: false },
    },
    stroke: { curve: "smooth", width: 3, show: true },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: categories,
      labels: { style: { colors: "#64748b" } }
    },
    yaxis: { 
      title: { text: "Count", style: { color: "#64748b" } },
      labels: { style: { colors: "#64748b" } }
    },
    legend: { 
      position: "top",
      labels: { 
        colors: "#64748b",
        useSeriesColors: false,
      },
      markers: {
        shape: "circle",
      },
      formatter: function(seriesName: string) {
        return seriesName.charAt(0).toUpperCase() + seriesName.slice(1).toLowerCase();
      }
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444"],
    grid: {
      borderColor: "rgba(148, 163, 184, 0.1)",
      strokeDashArray: 4,
      show: true,
    },
    tooltip: {
      theme: "light",
      style: {
        fontSize: "12px",
      },
      y: {
        formatter: function(val: number) {
          return val.toString();
        }
      }
    },
    markers: {
      size: 5,
      hover: { size: 7 }
    },
  });

  const donutChartOptions = (labels: string[]): ApexOptions => ({
    chart: { 
      type: "donut",
      fontFamily: "Inter, sans-serif",
      background: "transparent",
    },
    labels,
    legend: { 
      position: "bottom",
      labels: { 
        colors: "#64748b",
        useSeriesColors: false,
      },
      markers: {
        shape: "circle",
      },
      formatter: function(seriesName: string) {
        return seriesName.charAt(0).toUpperCase() + seriesName.slice(1).toLowerCase();
      }
    },
    colors: ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
    tooltip: {
      theme: "light",
      style: {
        fontSize: "12px",
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
        },
      },
    },
  });

  const StatCard = ({ title, value, subtitle, icon, gradient, trendData, totalData }: { title: string; value: string | number; subtitle?: string; icon?: any; gradient: string; trendData?: number[]; totalData?: number }) => {
    const colorClass = gradient.includes('blue') ? 'blue' : gradient.includes('green') ? 'green' : gradient.includes('red') ? 'red' : 'purple';
    const percentage = totalData && typeof value === 'number' ? Math.round((value / totalData) * 100) : null;
    
    // Generate mini chart data if trendData is provided
    const miniChartOptions: ApexOptions | null = trendData ? {
      chart: {
        type: "area",
        sparkline: { enabled: true },
        toolbar: { show: false },
        height: 64,
      },
      stroke: {
        curve: "smooth",
        width: 2,
        colors: [colorClass === 'blue' ? '#3C50E0' : colorClass === 'green' ? '#10B981' : colorClass === 'red' ? '#EF4444' : '#7a5af8'],
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.1,
          stops: [0, 100],
        },
      },
      series: [{ name: "Trend", data: trendData }],
      tooltip: { enabled: false },
      grid: { show: false },
      xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { show: false } },
    } : null;

    return (
      <div
        className={`group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br ${
          colorClass === 'blue' ? 'from-blue-50 via-blue-50/80 to-blue-50/60' :
          colorClass === 'green' ? 'from-green-50 via-green-50/80 to-green-50/60' :
          colorClass === 'red' ? 'from-red-50 via-red-50/80 to-red-50/60' :
          'from-purple-50 via-purple-50/80 to-purple-50/60'
        } p-5 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-${colorClass}-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-gray-900/50 dark:hover:border-${colorClass}-600`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-gray-700/20"></div>
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
              <h3 className="mb-1 text-3xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</h3>
              {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
              {percentage !== null && (
                <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {percentage}% of total
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {icon && (
                <div className={`rounded-xl p-3 shadow-lg transition-all duration-300 group-hover:scale-110 ${
                  colorClass === 'blue' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                  colorClass === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                  colorClass === 'red' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                  'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                }`}>
                  {icon}
                </div>
              )}
              {miniChartOptions && trendData && (
                <div className="h-16 w-20 -mr-2">
                  <Chart options={miniChartOptions} series={miniChartOptions.series} type="area" height={64} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageWrapper>
      <PageMeta title="School Dashboard | OSUCSC" description="School Dashboard with comprehensive analytics" />
      <PageBreadcrumb pageTitle="School Dashboard" />

      <PageContainer>
        {/* Glassmorphic Filter Section */}
        <div
          className="mb-8 rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-6 shadow-md backdrop-blur-xl transition-all duration-300 animate-fade-in dark:border-white/10 dark:bg-white/5"
          style={{
            background: filterGradient,
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[150px]">
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">School Name</label>
              <input
                type="text"
                value={filters.college_name}
                onChange={(e) => handleFilterChange("college_name", e.target.value)}
                placeholder="Search School..."
                className="w-full rounded-xl border border-gray-300 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-400"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">From Date</label>
              <input
                type="date"
                value={filters.fromdate}
                onChange={(e) => handleFilterChange("fromdate", e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">To Date</label>
              <input
                type="date"
                value={filters.todate}
                onChange={(e) => handleFilterChange("todate", e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 px-4 py-2.5 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="transition-all duration-200 hover:scale-105 whitespace-nowrap"
              >
                {loading ? "Loading..." : "Submit"}
              </Button>
              <Button 
                onClick={handleClear} 
                variant="outline" 
                className="transition-all duration-200 hover:scale-105 whitespace-nowrap"
              >
                Clear
              </Button>
              <Button 
                onClick={fetchDashboardData} 
                variant="outline" 
                startIcon={<RefreshIcon className="w-5 h-5" />} 
                className="transition-all duration-200 hover:scale-105 whitespace-nowrap"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <ThemedLoader
              size={80}
              className="text-brand-500"
              title="Loading Dashboard"
              description="Fetching your analytics and statistics..."
              showProgress={true}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Transcripts"
                value={totalTranscripts}
                subtitle="All transcript records"
                gradient="from-blue-500 to-blue-600"
                trendData={(dashboardData.transcriptSources.datasets[0] as any)?.data || []}
                totalData={totalTranscripts}
              />
              <StatCard
                title="Processed"
                value={processedCount}
                subtitle="Successfully processed"
                gradient="from-green-500 to-green-600"
                trendData={(dashboardData.transcriptStatus.datasets.find((d: any) => d.name === "PROCESSED") as any)?.data || []}
                totalData={totalTranscripts}
              />
              <StatCard
                title="Failed"
                value={failedCount}
                subtitle="Processing errors"
                gradient="from-red-500 to-red-600"
                trendData={(dashboardData.transcriptStatus.datasets.find((d: any) => d.name === "FAILED") as any)?.data || []}
                totalData={totalTranscripts}
              />
            </div>

            {/* Charts Grid - Modern Compact Layout */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Transcripts Downloaded From Sources */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-blue-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-blue-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-blue-900/20 dark:hover:border-blue-600">
                <div className="absolute top-0 right-0 h-20 w-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcripts Downloaded From Sources</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Live data indicator"></div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.transcriptSources?.labels, dashboardData.transcriptSources?.datasets) ? (
                      <Chart options={getLineChartOptions(dashboardData.transcriptSources.labels)} series={dashboardData.transcriptSources.datasets} type="line" height={280} />
                    ) : (
                      <NoDataPlaceholder height={280} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcript Status */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-purple-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-purple-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-purple-900/20 dark:hover:border-purple-600">
                <div className="absolute top-0 right-0 h-20 w-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcript Status</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
                      <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" title="Live data indicator"></div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.transcriptStatus?.labels, dashboardData.transcriptStatus?.datasets) ? (
                      <Chart options={getBarChartOptions(dashboardData.transcriptStatus.labels)} series={dashboardData.transcriptStatus.datasets} type="bar" height={280} />
                    ) : (
                      <NoDataPlaceholder height={280} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcripts Processed In Banner */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-green-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-green-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-green-900/20 dark:hover:border-green-600 lg:col-span-2">
                <div className="absolute top-0 right-0 h-20 w-20 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcripts Processed In Banner</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live data indicator"></div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.transcriptProcessed?.labels, dashboardData.transcriptProcessed?.datasets) ? (
                      <Chart options={getLineChartOptions(dashboardData.transcriptProcessed.labels)} series={dashboardData.transcriptProcessed.datasets} type="line" height={280} />
                    ) : (
                      <NoDataPlaceholder height={280} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Kickouts Charts - 2 per row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Initial Kickouts and Processed */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-orange-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-orange-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-orange-900/20 dark:hover:border-orange-600">
                <div className="absolute top-0 right-0 h-16 w-16 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Initial Kickouts</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.initialKickouts?.labels, dashboardData.initialKickouts?.datasets) ? (
                      <Chart options={getBarChartOptions(dashboardData.initialKickouts.labels)} series={dashboardData.initialKickouts.datasets} type="bar" height={250} />
                    ) : (
                      <NoDataPlaceholder height={250} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcripts Kickouts and Processed */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-indigo-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-indigo-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-indigo-900/20 dark:hover:border-indigo-600">
                <div className="absolute top-0 right-0 h-16 w-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Transcripts Kickouts</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.transcriptKickouts?.labels, dashboardData.transcriptKickouts?.datasets) ? (
                      <Chart options={getBarChartOptions(dashboardData.transcriptKickouts.labels)} series={dashboardData.transcriptKickouts.datasets} type="bar" height={250} />
                    ) : (
                      <NoDataPlaceholder height={250} />
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Donut Charts */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Transcript Status Donut */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-cyan-50/30 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-cyan-300 dark:border-gray-700/80 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-cyan-900/20 dark:hover:border-cyan-600">
                <div className="absolute top-0 right-0 h-16 w-16 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Transcript Status</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasDonutData(dashboardData.transcriptStatusDonut?.series, dashboardData.transcriptStatusDonut?.labels) ? (
                      <Chart
                        options={donutChartOptions(dashboardData.transcriptStatusDonut.labels)}
                        series={dashboardData.transcriptStatusDonut.series}
                        type="donut"
                        height={240}
                      />
                    ) : (
                      <NoDataPlaceholder height={240} />
                    )}
                  </div>
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
