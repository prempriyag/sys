import { useState, useEffect } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { API_BASE_URL, API_ENDPOINTS } from "../../../config/api";
import DatePicker from "../../../components/form/date-picker";
import Chart from "react-apexcharts";
import { RefreshIcon } from "../../../icons";
import { ApexOptions } from "apexcharts";
import { colorThemes } from "../../../config/colorConfig";
import ThemedLoader from "../../../components/common/ThemedLoader";
import SearchableMultiSelect from "../../../components/form/SearchableMultiSelect";

type ChartDataset = { name: string; data: number[] };
type ChartData = { labels: string[]; datasets: ChartDataset[] };
type DonutData = { series: number[]; labels: string[] };

type DashboardData = {
  transcriptSources: ChartData;
  transcriptStatus: ChartData;
  transcriptProcessed: ChartData;
  initialKickouts: ChartData;
  transcriptKickouts: ChartData;
  articulationKickouts: ChartData;
  articulationCoursesKickouts: ChartData;
  transcriptStatusDonut: DonutData;
  articulationStatusDonut: DonutData;
  articulationCoursesStatusDonut: DonutData;
};

const initialDashboardData: DashboardData = {
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
};

type CollegeOption = { INSTITUTION_NAME: string; INSTITUTION_ID: string };

export default function CollegeDashboard() {
  const [loading, setLoading] = useState(false);
  const [collegesList, setCollegesList] = useState<CollegeOption[]>([]);
  const [filters, setFilters] = useState({
    college_name: [] as string[],
    fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    todate: new Date().toISOString().split("T")[0],
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData);
  const [filterGradient, setFilterGradient] = useState<string>(
    "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)"
  );

  // Update gradient when dark mode changes
  useEffect(() => {
    const updateGradient = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setFilterGradient(
        isDark
          ? "linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(30, 41, 59, 0.3) 100%)"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)"
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
      college_name: [],
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
        
        // Clean null labels from the data
        const cleanData = {
          ...data,
          articulationStatusDonut: {
            ...data.articulationStatusDonut,
            labels: data.articulationStatusDonut?.labels?.filter((label: string | null) => label !== null) || []
          },
          transcriptStatusDonut: {
            ...data.transcriptStatusDonut,
            labels: data.transcriptStatusDonut?.labels?.filter((label: string | null) => label !== null) || []
          },
          articulationCoursesStatusDonut: {
            ...data.articulationCoursesStatusDonut,
            labels: data.articulationCoursesStatusDonut?.labels?.filter((label: string | null) => label !== null) || []
          }
        };
        
        setDashboardData(cleanData);
      } else {
        console.error("Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegesList = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.DASHBOARD_COLLEGES_LIST}?q=`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setCollegesList(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching colleges list:", error);
    }
  };

  useEffect(() => {
    fetchCollegesList();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Safe formatter function to handle null/undefined values
  const safeFormatter = (seriesName: string | null | undefined): string => {
    if (!seriesName) return "";
    return seriesName.charAt(0).toUpperCase() + seriesName.slice(1).toLowerCase();
  };

  // Calculate statistics with null checks
  const totalTranscripts = dashboardData.transcriptStatusDonut?.series?.reduce((a: number, b: number) => a + b, 0) || 0;
  const totalArticulations = dashboardData.articulationStatusDonut?.series?.reduce((a: number, b: number) => a + b, 0) || 0;
  const processedCount = dashboardData.transcriptStatus?.datasets?.find((d: any) => d?.name === "PROCESSED")?.data?.reduce((a: number, b: number) => a + b, 0) || 0;
  const failedCount = dashboardData.transcriptStatus?.datasets?.find((d: any) => d?.name === "FAILED")?.data?.reduce((a: number, b: number) => a + b, 0) || 0;

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
  const getBarChartOptions = (categories: string[]): ApexOptions => {
    // Calculate adaptive border radius based on number of categories
    // More categories = narrower bars = smaller radius
    const categoryCount = categories.length;
    let borderRadius = 4;
    let columnWidth = "55%";
    
    if (categoryCount > 10) {
      borderRadius = 2;
      columnWidth = "60%";
    } else if (categoryCount > 7) {
      borderRadius = 3;
      columnWidth = "57%";
    }
    
    return {
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Inter, sans-serif",
        background: "transparent",
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: columnWidth,
          borderRadius: borderRadius,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
          dataLabels: {
            position: "top",
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { 
        show: true,
        width: 1,
        colors: ["transparent"]
      },
      xaxis: { 
        categories: categories,
        labels: { 
          style: { colors: "#64748b" },
          rotate: categoryCount > 8 ? -45 : 0,
          rotateAlways: categoryCount > 8,
        }
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
      colors: ["#e57124", "#f8a962", "#fab876", "#F59E0B", "#EF4444"],
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
    };
  };

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
      categories: categories || [],
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
        return safeFormatter(seriesName);
      }
    },
    colors: ["#e57124", "#10B981", "#F59E0B", "#EF4444"],
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
    labels: labels || [],
    dataLabels: {
      enabled: true,
      style: {
        fontSize: "11px",
        fontWeight: 600,
        colors: ["#334155"],
      },
      formatter: function (val: number, opts?: any) {
        const name = opts?.w?.globals?.labels?.[opts?.seriesIndex] ?? "";
        return `${Math.round(val)}%`;
      },
      dropShadow: { enabled: false },
    },
    legend: { 
      position: "bottom",
      labels: { 
        colors: "#64748b",
        useSeriesColors: false,
      },
      markers: {
        shape: "circle",
      },
      formatter: function(seriesName: string, opts?: any) {
        return safeFormatter(seriesName);
      }
    },
    colors: ["#e57124", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
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
    plotOptions: {
      pie: {
        dataLabels: {
          offset: 25,
        },
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
        colors: [colorClass === 'blue' ? '#e57124' : colorClass === 'green' ? '#10B981' : colorClass === 'red' ? '#EF4444' : '#7a5af8'],
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
        className={`group relative overflow-hidden rounded-2xl border ${
          colorClass === 'blue' ? 'border-blue-200 dark:border-blue-700/40 bg-gradient-to-br from-blue-50 via-blue-100/90 to-indigo-100/80 dark:from-blue-900/30 dark:via-blue-800/30 dark:to-indigo-900/30' :
          colorClass === 'green' ? 'border-green-200 dark:border-green-700/40 bg-gradient-to-br from-green-50 via-green-100/90 to-emerald-100/80 dark:from-green-900/30 dark:via-green-800/30 dark:to-emerald-900/30' :
          colorClass === 'red' ? 'border-red-200 dark:border-red-700/40 bg-gradient-to-br from-red-50 via-red-100/90 to-rose-100/80 dark:from-red-900/30 dark:via-red-800/30 dark:to-rose-900/30' :
          'border-purple-200 dark:border-purple-700/40 bg-gradient-to-br from-purple-50 via-purple-100/90 to-fuchsia-100/80 dark:from-purple-900/30 dark:via-purple-800/30 dark:to-fuchsia-900/30'
        } backdrop-blur-sm p-5 shadow-lg transition-all duration-500 hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1 ${
          colorClass === 'blue' ? 'hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-blue-500/20' :
          colorClass === 'green' ? 'hover:border-green-300 dark:hover:border-green-600 hover:shadow-green-500/20' :
          colorClass === 'red' ? 'hover:border-red-300 dark:hover:border-red-600 hover:shadow-red-500/20' :
          'hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-purple-500/20'
        }`}
      >
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className={`absolute inset-0 bg-gradient-to-br opacity-5 ${
            colorClass === 'blue' ? 'from-blue-400 via-indigo-400 to-blue-500' :
            colorClass === 'green' ? 'from-green-400 via-emerald-400 to-green-500' :
            colorClass === 'red' ? 'from-red-400 via-rose-400 to-red-500' :
            'from-purple-400 via-fuchsia-400 to-purple-500'
          }`}></div>
        </div>
        
        {/* Floating Orbs */}
        <div className={`absolute -top-8 -right-8 w-28 h-28 opacity-10 ${
          colorClass === 'blue' ? 'bg-gradient-to-br from-blue-300 via-indigo-400 to-blue-500' :
          colorClass === 'green' ? 'bg-gradient-to-br from-green-300 via-emerald-400 to-green-500' :
          colorClass === 'red' ? 'bg-gradient-to-br from-red-300 via-rose-400 to-red-500' :
          'bg-gradient-to-br from-purple-300 via-fuchsia-400 to-purple-500'
        } rounded-full blur-2xl group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 animate-pulse`}></div>
        <div className={`absolute -bottom-8 -left-8 w-32 h-32 opacity-8 ${
          colorClass === 'blue' ? 'bg-gradient-to-tr from-indigo-300 via-blue-400 to-indigo-500' :
          colorClass === 'green' ? 'bg-gradient-to-tr from-teal-300 via-green-400 to-teal-500' :
          colorClass === 'red' ? 'bg-gradient-to-tr from-pink-300 via-red-400 to-pink-500' :
          'bg-gradient-to-tr from-fuchsia-300 via-purple-400 to-fuchsia-500'
        } rounded-full blur-2xl group-hover:opacity-15 group-hover:scale-110 transition-all duration-700`}></div>
        
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title Section */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`relative w-2 h-2 rounded-full ${
                  colorClass === 'blue' ? 'bg-blue-500' :
                  colorClass === 'green' ? 'bg-green-500' :
                  colorClass === 'red' ? 'bg-red-500' :
                  'bg-purple-500'
                }`}>
                  <span className={`absolute inset-0 rounded-full animate-ping ${
                    colorClass === 'blue' ? 'bg-blue-500' :
                    colorClass === 'green' ? 'bg-green-500' :
                    colorClass === 'red' ? 'bg-red-500' :
                    'bg-purple-500'
                  }`}></span>
                </div>
                <p className={`text-[11px] font-bold uppercase tracking-widest truncate ${
                  colorClass === 'blue' ? 'text-blue-700 dark:text-blue-300' :
                  colorClass === 'green' ? 'text-green-700 dark:text-green-300' :
                  colorClass === 'red' ? 'text-red-700 dark:text-red-300' :
                  'text-purple-700 dark:text-purple-300'
                }`}>{title}</p>
              </div>
              
              {/* Value Display */}
              <div className="mb-2">
                <h3 className={`text-3xl font-black leading-none tracking-tight bg-gradient-to-br bg-clip-text text-transparent ${
                  colorClass === 'blue' ? 'from-blue-700 via-indigo-700 to-blue-800 dark:from-blue-200 dark:via-indigo-200 dark:to-blue-100' :
                  colorClass === 'green' ? 'from-green-700 via-emerald-700 to-green-800 dark:from-green-200 dark:via-emerald-200 dark:to-green-100' :
                  colorClass === 'red' ? 'from-red-700 via-rose-700 to-red-800 dark:from-red-200 dark:via-rose-200 dark:to-red-100' :
                  'from-purple-700 via-fuchsia-700 to-purple-800 dark:from-purple-200 dark:via-fuchsia-200 dark:to-purple-100'
                } drop-shadow-sm`}>{value.toLocaleString()}</h3>
              </div>
              
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                {subtitle && (
                  <p className={`text-[11px] font-semibold ${
                    colorClass === 'blue' ? 'text-blue-600/90 dark:text-blue-300' :
                    colorClass === 'green' ? 'text-green-600/90 dark:text-green-300' :
                    colorClass === 'red' ? 'text-red-600/90 dark:text-red-300' :
                    'text-purple-600/90 dark:text-purple-300'
                  }`}>{subtitle}</p>
                )}
                {percentage !== null && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full backdrop-blur-md shadow-md transition-all duration-300 group-hover:scale-105 ${
                    colorClass === 'blue' ? 'bg-blue-500/15 text-blue-800 border border-blue-400/30 dark:bg-blue-400/20 dark:text-blue-200 dark:border-blue-400/40 shadow-blue-500/15' :
                    colorClass === 'green' ? 'bg-green-500/15 text-green-800 border border-green-400/30 dark:bg-green-400/20 dark:text-green-200 dark:border-green-400/40 shadow-green-500/15' :
                    colorClass === 'red' ? 'bg-red-500/15 text-red-800 border border-red-400/30 dark:bg-red-400/20 dark:text-red-200 dark:border-red-400/40 shadow-red-500/15' :
                    'bg-purple-500/15 text-purple-800 border border-purple-400/30 dark:bg-purple-400/20 dark:text-purple-200 dark:border-purple-400/40 shadow-purple-500/15'
                  }`}>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    {percentage}%
                  </span>
                )}
              </div>
            </div>
            
            {/* Icon and Chart */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {icon && (
                <div className={`relative rounded-xl p-2.5 shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 ${
                  colorClass === 'blue' ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 text-white shadow-blue-500/40 group-hover:shadow-blue-500/60' :
                  colorClass === 'green' ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 text-white shadow-green-500/40 group-hover:shadow-green-500/60' :
                  colorClass === 'red' ? 'bg-gradient-to-br from-red-500 via-rose-500 to-red-600 text-white shadow-red-500/40 group-hover:shadow-red-500/60' :
                  'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-purple-600 text-white shadow-purple-500/40 group-hover:shadow-purple-500/60'
                }`}>
                  <div className="w-5 h-5 relative z-10">
                    {icon}
                  </div>
                  <div className="absolute inset-0 bg-white/20 dark:bg-gray-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
              )}
              {miniChartOptions && trendData && (
                <div className="h-12 w-20 opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105">
                  <Chart options={miniChartOptions} series={miniChartOptions.series} type="area" height={48} />
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
      <PageMeta title="College Dashboard | OSUCSC" description="College Dashboard with comprehensive analytics" />
      <PageBreadcrumb pageTitle="College Dashboard" />

      <PageContainer>
        {/* Glassmorphic Filter Section */}
        <div
          className="mb-8 rounded-2xl naveen border border-gray-200 bg-white p-4 sm:p-6 shadow-md backdrop-blur-xl transition-all duration-300 animate-fade-in overflow-visible z-10 dark:border-gray-800 dark:bg-gray-900"
          style={{
            background: filterGradient,
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[280px]">
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">College Name</label>
              <SearchableMultiSelect
                options={collegesList.map((c) => ({
                  value: c.INSTITUTION_ID,
                  label: c.INSTITUTION_NAME || c.INSTITUTION_ID,
                }))}
                value={filters.college_name}
                onChange={(selected) => setFilters((prev) => ({ ...prev, college_name: selected }))}
                placeholder="All Colleges"
                searchPlaceholder="Search colleges..."
                maxHeight="250px"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <DatePicker
                id="college-from-date"
                label="From Date"
                defaultDate={filters.fromdate}
                placeholder="Select from date"
                onChange={(_, dateStr) => handleFilterChange("fromdate", dateStr)}
                inputClassName="w-full rounded-xl border border-gray-300 bg-white/50 py-2.5 px-4 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400 dark:focus:bg-gray-800/70"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <DatePicker
                id="college-to-date"
                label="To Date"
                defaultDate={filters.todate}
                placeholder="Select to date"
                onChange={(_, dateStr) => handleFilterChange("todate", dateStr)}
                inputClassName="w-full rounded-xl border border-gray-300 bg-white/50 py-2.5 px-4 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400 dark:focus:bg-gray-800/70"
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
                gradient="from-orange-500 to-orange-600"
                trendData={dashboardData.transcriptSources?.datasets?.[0]?.data || []}
                totalData={totalTranscripts}
              />
              <StatCard
                title="Processed"
                value={processedCount}
                subtitle="Successfully processed"
                gradient="from-green-500 to-green-600"
                trendData={dashboardData.transcriptStatus?.datasets?.find((d: any) => d?.name === "PROCESSED")?.data || []}
                totalData={totalTranscripts}
              />
              <StatCard
                title="Failed"
                value={failedCount}
                subtitle="Processing errors"
                gradient="from-red-500 to-red-600"
                trendData={dashboardData.transcriptStatus?.datasets?.find((d: any) => d?.name === "FAILED")?.data || []}
                totalData={totalTranscripts}
              />
              <StatCard
                title="Total Articulations"
                value={totalArticulations}
                subtitle="Articulation records"
                gradient="from-purple-500 to-purple-600"
                trendData={dashboardData.articulationStatusDonut?.series || []}
                totalData={totalArticulations}
              />
            </div>

            {/* Charts Grid - Modern Compact Layout */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Transcripts Downloaded From Sources */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-blue-300/60 bg-gradient-to-br from-white via-white to-blue-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-blue-400 dark:border-blue-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-blue-900/30 dark:hover:border-blue-500">
                <div className="absolute top-0 right-0 h-20 w-20 bg-blue-500/15 rounded-full blur-2xl group-hover:bg-blue-500/25 transition-all duration-300"></div>
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
                      <Chart 
                        options={getLineChartOptions(dashboardData.transcriptSources?.labels || [])} 
                        series={dashboardData.transcriptSources?.datasets || []} 
                        type="line" 
                        height={280} 
                      />
                    ) : (
                      <NoDataPlaceholder height={280} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcript Status */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-purple-300/60 bg-gradient-to-br from-white via-white to-purple-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-purple-400 dark:border-purple-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-purple-900/30 dark:hover:border-purple-500">
                <div className="absolute top-0 right-0 h-20 w-20 bg-purple-500/15 rounded-full blur-2xl group-hover:bg-purple-500/25 transition-all duration-300"></div>
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
                      <Chart 
                        options={getBarChartOptions(dashboardData.transcriptStatus?.labels || [])} 
                        series={dashboardData.transcriptStatus?.datasets || []} 
                        type="bar" 
                        height={280} 
                      />
                    ) : (
                      <NoDataPlaceholder height={280} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcripts Processed In Banner */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-green-300/60 bg-gradient-to-br from-white via-white to-green-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-green-400 dark:border-green-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-green-900/30 dark:hover:border-green-500 lg:col-span-2 mb-4">
                <div className="absolute top-0 right-0 h-20 w-20 bg-green-500/15 rounded-full blur-2xl group-hover:bg-green-500/25 transition-all duration-300"></div>
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
                      <Chart 
                        options={getLineChartOptions(dashboardData.transcriptProcessed?.labels || [])} 
                        series={dashboardData.transcriptProcessed?.datasets || []} 
                        type="line" 
                        height={280} 
                      />
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
              <div className="group relative overflow-hidden rounded-xl border-2 border-orange-300/60 bg-gradient-to-br from-white via-white to-orange-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-orange-400 dark:border-orange-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-orange-900/30 dark:hover:border-orange-500">
                <div className="absolute top-0 right-0 h-16 w-16 bg-orange-500/15 rounded-full blur-xl group-hover:bg-orange-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Initial Kickouts</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.initialKickouts?.labels, dashboardData.initialKickouts?.datasets) ? (
                      <Chart 
                        options={getBarChartOptions(dashboardData.initialKickouts?.labels || [])} 
                        series={dashboardData.initialKickouts?.datasets || []} 
                        type="bar" 
                        height={250} 
                      />
                    ) : (
                      <NoDataPlaceholder height={250} />
                    )}
                  </div>
                </div>
              </div>

              {/* Transcripts Kickouts and Processed */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-indigo-300/60 bg-gradient-to-br from-white via-white to-indigo-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-indigo-400 dark:border-indigo-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-indigo-900/30 dark:hover:border-indigo-500">
                <div className="absolute top-0 right-0 h-16 w-16 bg-indigo-500/15 rounded-full blur-xl group-hover:bg-indigo-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Transcripts Kickouts</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.transcriptKickouts?.labels, dashboardData.transcriptKickouts?.datasets) ? (
                      <Chart 
                        options={getBarChartOptions(dashboardData.transcriptKickouts?.labels || [])} 
                        series={dashboardData.transcriptKickouts?.datasets || []} 
                        type="bar" 
                        height={250} 
                      />
                    ) : (
                      <NoDataPlaceholder height={250} />
                    )}
                  </div>
                </div>
              </div>

              {/* Articulation Kickouts and Processed */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-pink-300/60 bg-gradient-to-br from-white via-white to-pink-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-pink-400 dark:border-pink-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-pink-900/30 dark:hover:border-pink-500">
                <div className="absolute top-0 right-0 h-16 w-16 bg-pink-500/15 rounded-full blur-xl group-hover:bg-pink-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Kickouts</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.articulationKickouts?.labels, dashboardData.articulationKickouts?.datasets) ? (
                      <Chart 
                        options={getBarChartOptions(dashboardData.articulationKickouts?.labels || [])} 
                        series={dashboardData.articulationKickouts?.datasets || []} 
                        type="bar" 
                        height={250} 
                      />
                    ) : (
                      <NoDataPlaceholder height={250} />
                    )}
                  </div>
                </div>
              </div>

              {/* Articulation Courses Kickouts and Processed */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-teal-300/60 bg-gradient-to-br from-white via-white to-teal-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-teal-400 dark:border-teal-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-teal-900/30 dark:hover:border-teal-500">
                <div className="absolute top-0 right-0 h-16 w-16 bg-teal-500/15 rounded-full blur-xl group-hover:bg-teal-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Courses</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasChartData(dashboardData.articulationCoursesKickouts?.labels, dashboardData.articulationCoursesKickouts?.datasets) ? (
                      <Chart 
                        options={getBarChartOptions(dashboardData.articulationCoursesKickouts?.labels || [])} 
                        series={dashboardData.articulationCoursesKickouts?.datasets || []} 
                        type="bar" 
                        height={250} 
                      />
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
                        options={donutChartOptions(dashboardData.transcriptStatusDonut?.labels || [])}
                        series={dashboardData.transcriptStatusDonut?.series || []}
                        type="donut"
                        height={240}
                      />
                    ) : (
                      <NoDataPlaceholder height={240} />
                    )}
                  </div>
                </div>
              </div>

              {/* Articulation Status Donut */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-amber-300/60 bg-gradient-to-br from-white via-white to-amber-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-amber-400 dark:border-amber-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-amber-900/30 dark:hover:border-amber-500">
                <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/15 rounded-full blur-xl group-hover:bg-amber-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Status</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasDonutData(dashboardData.articulationStatusDonut?.series, dashboardData.articulationStatusDonut?.labels) ? (
                      <Chart
                        options={donutChartOptions(dashboardData.articulationStatusDonut?.labels || [])}
                        series={dashboardData.articulationStatusDonut?.series || []}
                        type="donut"
                        height={240}
                      />
                    ) : (
                      <NoDataPlaceholder height={240} />
                    )}
                  </div>
                </div>
              </div>

              {/* Articulation Courses Status Donut */}
              <div className="group relative overflow-hidden rounded-xl border-2 border-rose-300/60 bg-gradient-to-br from-white via-white to-rose-50/40 p-5 shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-rose-400 dark:border-rose-600/50 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-rose-900/30 dark:hover:border-rose-500 sm:col-span-2 lg:col-span-1">
                <div className="absolute top-0 right-0 h-16 w-16 bg-rose-500/15 rounded-full blur-xl group-hover:bg-rose-500/25 transition-all duration-300"></div>
                <div className="relative">
                  <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Courses Status</h3>
                  <div className="rounded-lg bg-white/80 p-3 shadow-inner dark:bg-gray-900/50">
                    {hasDonutData(dashboardData.articulationCoursesStatusDonut?.series, dashboardData.articulationCoursesStatusDonut?.labels) ? (
                      <Chart
                        options={donutChartOptions(dashboardData.articulationCoursesStatusDonut?.labels || [])}
                        series={dashboardData.articulationCoursesStatusDonut?.series || []}
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