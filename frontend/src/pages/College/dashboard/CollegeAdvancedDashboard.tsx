import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { api, API_BASE_URL, API_ENDPOINTS } from "../../../config/api";
import DatePicker from "../../../components/form/date-picker";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { RefreshIcon } from "../../../icons";
import ThemedLoader from "../../../components/common/ThemedLoader";
import SearchableMultiSelect from "../../../components/form/SearchableMultiSelect";

// ─── Types ───────────────────────────────────────────────────────────
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
  sourceTypeDistribution: DonutData;
  downloadStatusDistribution: DonutData;
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
  sourceTypeDistribution: { series: [], labels: [] },
  downloadStatusDistribution: { series: [], labels: [] },
};

type CollegeOption = { INSTITUTION_NAME: string; INSTITUTION_ID: string };

// ─── Inline SVG Icons ────────────────────────────────────────────────
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BoltIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

// ─── Component ───────────────────────────────────────────────────────
export default function CollegeAdvancedDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [collegesList, setCollegesList] = useState<CollegeOption[]>([]);
  const [selectedView, setSelectedView] = useState<"overview" | "trends" | "analysis" | "recon">("overview");
  const [filters, setFilters] = useState({
    college_name: [] as string[],
    fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    todate: new Date().toISOString().split("T")[0],
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData);
  const [reconData, setReconData] = useState<any>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [filterGradient, setFilterGradient] = useState<string>(
    "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)"
  );

  // Dark mode gradient
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
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") updateGradient();
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
    if (selectedView === "recon") fetchReconReport();
  };

  const handleClear = () => {
    setFilters({
      college_name: [],
      fromdate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      todate: new Date().toISOString().split("T")[0],
    });
    setTimeout(() => { fetchDashboardData(); if (selectedView === "recon") fetchReconReport(); }, 100);
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
        const cleanData = {
          ...data,
          articulationStatusDonut: {
            ...data.articulationStatusDonut,
            labels: data.articulationStatusDonut?.labels?.filter((l: string | null) => l !== null) || [],
          },
          transcriptStatusDonut: {
            ...data.transcriptStatusDonut,
            labels: data.transcriptStatusDonut?.labels?.filter((l: string | null) => l !== null) || [],
          },
          articulationCoursesStatusDonut: {
            ...data.articulationCoursesStatusDonut,
            labels: data.articulationCoursesStatusDonut?.labels?.filter((l: string | null) => l !== null) || [],
          },
          sourceTypeDistribution: {
            labels: data.sourceTypeDistribution?.labels?.filter((l: string | null) => l !== null) || [],
            series: data.sourceTypeDistribution?.series || [],
          },
          downloadStatusDistribution: {
            labels: data.downloadStatusDistribution?.labels?.filter((l: string | null) => l !== null) || [],
            series: data.downloadStatusDistribution?.series || [],
          },
        };
        setDashboardData(cleanData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegesList = async () => {
    try {
      const data = await api.get(`${API_ENDPOINTS.DASHBOARD_COLLEGES_LIST}?q=`);
      setCollegesList(Array.isArray(data) ? data : []);
    } catch {
      setCollegesList([]);
    }
  };

  const fetchReconReport = async () => {
    setReconLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/recon-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ fromdate: filters.fromdate, todate: filters.todate }),
      });
      if (response.ok) {
        const data = await response.json();
        setReconData(data);
      }
    } catch (error) {
      console.error("Error fetching recon report:", error);
    } finally {
      setReconLoading(false);
    }
  };

  useEffect(() => { fetchCollegesList(); }, []);
  useEffect(() => { fetchDashboardData(); }, []);
  useEffect(() => { if (selectedView === "recon") fetchReconReport(); }, [selectedView]);

  // ─── Computed metrics ──────────────────────────────────────────────
  const totalTranscripts = dashboardData.transcriptStatusDonut?.series?.reduce((a, b) => a + b, 0) || 0;
  const totalArticulations = dashboardData.articulationStatusDonut?.series?.reduce((a, b) => a + b, 0) || 0;
  const totalArtCourses = dashboardData.articulationCoursesStatusDonut?.series?.reduce((a, b) => a + b, 0) || 0;
  const processedCount = dashboardData.transcriptStatus?.datasets?.find((d) => d?.name === "PROCESSED")?.data?.reduce((a, b) => a + b, 0) || 0;
  const failedCount = dashboardData.transcriptStatus?.datasets?.find((d) => d?.name === "FAILED")?.data?.reduce((a, b) => a + b, 0) || 0;
  const newCount = dashboardData.transcriptStatus?.datasets?.find((d) => d?.name === "NEW")?.data?.reduce((a, b) => a + b, 0) || 0;
  const rerunCount = dashboardData.transcriptStatus?.datasets?.find((d) => d?.name === "RERUN" || d?.name === "Rerun")?.data?.reduce((a, b) => a + b, 0) || 0;
  const duplicateCount = dashboardData.transcriptStatus?.datasets?.find((d) => d?.name === "DUPLICATE")?.data?.reduce((a, b) => a + b, 0) || 0;
  const successRate = totalTranscripts > 0 ? ((processedCount / totalTranscripts) * 100).toFixed(1) : "0.0";
  const errorRate = totalTranscripts > 0 ? ((failedCount / totalTranscripts) * 100).toFixed(1) : "0.0";

  // Initial kickouts total
  const totalInitialKickouts = dashboardData.initialKickouts?.datasets?.reduce((sum, ds) => sum + (ds?.data?.reduce((a, b) => a + b, 0) || 0), 0) || 0;
  // Transcript kickouts total
  const totalTranscriptKickouts = dashboardData.transcriptKickouts?.datasets?.reduce((sum, ds) => sum + (ds?.data?.reduce((a, b) => a + b, 0) || 0), 0) || 0;

  // Source type & download status totals
  const totalSourceTypes = dashboardData.sourceTypeDistribution?.series?.reduce((a, b) => a + b, 0) || 0;
  const totalDownloadStatuses = dashboardData.downloadStatusDistribution?.series?.reduce((a, b) => a + b, 0) || 0;

  // ─── Chart helpers ─────────────────────────────────────────────────
  const hasChartData = (labels: string[] | undefined, datasets: ChartDataset[] | undefined) =>
    labels && labels.length > 0 && datasets && datasets.length > 0 && datasets.some((d) => d?.data?.length > 0);

  const hasDonutData = (series: number[] | undefined, labels: string[] | undefined) =>
    series && series.length > 0 && labels && labels.length > 0 && series.some((s) => s > 0);

  const LABEL_COLORS: Record<string, string> = {
    NEW: "#adc5ff", RERUN: "#A9B1BC", Rerun: "#A9B1BC", PROCESSED: "#86f886",
    DUPLICATE: "#7cffeb", FAILED: "#ff8f8f", Failed: "#ff8f8f",
    Parchment: "#daa3f1", NSC: "#adc5ff", Scanned: "#86f886", ScannedUnofficial: "#ffb272",
    Downloaded: "#86f886", SOAPCOL: "#b1a2ff", SHATAEQ: "#ffa6e2", BDMS: "#7cffeb",
    "Transcript Kickouts": "#ff8f8f", "Transcript Processed": "#86f886",
    "PARTIALLY PROCESSED": "#ffe17a", "PROCESSED & ROLLED": "#B3A5EF",
    Success: "#86f886",
    // Source types
    Parchment_donut: "#daa3f1", NSC_donut: "#adc5ff", Scanned_donut: "#86f886", ScannedUnofficial_donut: "#ffb272",
    // Download statuses
    COMPLETED: "#86f886", PENDING: "#ffe17a", "IN PROGRESS": "#adc5ff", ERROR: "#ff8f8f",
  };

  const getColorsForDatasets = (datasets: { name: string }[] | undefined): string[] => {
    const fallback = ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];
    if (!datasets || datasets.length === 0) return fallback;
    return datasets.map((ds, i) => LABEL_COLORS[ds.name] ?? fallback[i % fallback.length]);
  };

  const getDonutColors = (labels: string[] | undefined): string[] => {
    const fallback = ["#e57124", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    if (!labels || labels.length === 0) return fallback;
    return labels.map((l, i) => LABEL_COLORS[l] ?? fallback[i % fallback.length]);
  };

  // ─── Chart Options ─────────────────────────────────────────────────
  const safeFormatter = (s: string | null | undefined): string => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const getBarChartOptions = (categories: string[], customColors?: string[]): ApexOptions => {
    const categoryCount = categories.length;
    let borderRadius = 4;
    let columnWidth = "55%";
    if (categoryCount > 10) { borderRadius = 2; columnWidth = "60%"; }
    else if (categoryCount > 7) { borderRadius = 3; columnWidth = "57%"; }
    return {
      chart: { type: "bar", toolbar: { show: true }, fontFamily: "Inter, sans-serif", background: "transparent" },
      plotOptions: { bar: { horizontal: false, columnWidth, borderRadius, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 1, colors: ["transparent"] },
      xaxis: {
        categories,
        labels: { style: { colors: "#64748b" }, rotate: categoryCount > 8 ? -45 : 0, rotateAlways: categoryCount > 8 },
      },
      yaxis: { title: { text: "Count", style: { color: "#64748b" } }, labels: { style: { colors: "#64748b" } } },
      fill: { opacity: 1 },
      legend: {
        position: "top", labels: { colors: "#64748b", useSeriesColors: false }, markers: { shape: "circle" },
        formatter: (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      },
      colors: customColors || ["#adc5ff", "#a9b1bc", "#86f886", "#7cffeb", "#EF4444"],
      grid: { borderColor: "rgba(148, 163, 184, 0.1)", strokeDashArray: 4, show: true },
      tooltip: { theme: "light", style: { fontSize: "12px" }, y: { formatter: (val: number) => val.toString() } },
    };
  };

  const getLineChartOptions = (categories: string[], customColors?: string[]): ApexOptions => ({
    chart: { type: "line", toolbar: { show: true }, fontFamily: "Inter, sans-serif", background: "transparent", zoom: { enabled: true } },
    stroke: { curve: "smooth", width: 3, show: true },
    dataLabels: { enabled: false },
    xaxis: { categories: categories || [], labels: { style: { colors: "#64748b" } } },
    yaxis: { title: { text: "Count", style: { color: "#64748b" } }, labels: { style: { colors: "#64748b" } } },
    legend: {
      position: "top", labels: { colors: "#64748b", useSeriesColors: false }, markers: { shape: "circle" },
      formatter: (s: string) => safeFormatter(s),
    },
    colors: customColors || ["#e57124", "#10B981", "#F59E0B", "#EF4444"],
    grid: { borderColor: "rgba(148, 163, 184, 0.1)", strokeDashArray: 4, show: true },
    tooltip: { theme: "light", style: { fontSize: "12px" }, y: { formatter: (val: number) => val.toString() } },
    markers: { size: 5, hover: { size: 7 } },
  });

  const getAreaChartOptions = (categories: string[], customColors?: string[]): ApexOptions => ({
    chart: { type: "area", toolbar: { show: true }, fontFamily: "Inter, sans-serif", background: "transparent", zoom: { enabled: true } },
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1, stops: [0, 90, 100] } },
    dataLabels: { enabled: false },
    xaxis: { categories: categories || [], labels: { style: { colors: "#64748b" } } },
    yaxis: { title: { text: "Count", style: { color: "#64748b" } }, labels: { style: { colors: "#64748b" } } },
    legend: {
      position: "top", labels: { colors: "#64748b", useSeriesColors: false }, markers: { shape: "circle" },
      formatter: (s: string) => safeFormatter(s),
    },
    colors: customColors || ["#3C50E0", "#10B981", "#F59E0B"],
    grid: { borderColor: "rgba(148, 163, 184, 0.1)", strokeDashArray: 4, show: true },
    tooltip: { theme: "light", shared: true, intersect: false, y: { formatter: (val: number) => val.toString() } },
  });

  const getHorizontalBarOptions = (categories: string[], customColors?: string[]): ApexOptions => ({
    chart: { type: "bar", toolbar: { show: true }, fontFamily: "Inter, sans-serif", background: "transparent" },
    plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: "65%", borderRadiusApplication: "end" } },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toLocaleString(),
      style: { fontSize: "12px", fontWeight: 600, colors: ["#334155"] },
      offsetX: 5,
    },
    xaxis: { labels: { style: { colors: "#64748b" } } },
    yaxis: { labels: { style: { colors: "#64748b", fontSize: "12px", fontWeight: 600 } } },
    colors: customColors || ["#3C50E0", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
    grid: { borderColor: "rgba(148, 163, 184, 0.1)", strokeDashArray: 4, show: true },
    tooltip: { theme: "light", style: { fontSize: "12px" }, y: { formatter: (val: number) => val.toLocaleString() } },
    legend: { show: false },
  });

  const donutChartOptions = (labels: string[]): ApexOptions => ({
    chart: { type: "donut", fontFamily: "Inter, sans-serif", background: "transparent" },
    labels: labels || [],
    dataLabels: {
      enabled: true,
      style: { fontSize: "11px", fontWeight: 600, colors: ["#334155"] },
      formatter: (val: number) => `${Math.round(val)}%`,
      dropShadow: { enabled: false },
    },
    legend: {
      position: "bottom", labels: { colors: "#64748b", useSeriesColors: false }, markers: { shape: "circle" },
      formatter: (s: string) => safeFormatter(s),
    },
    colors: getDonutColors(labels),
    tooltip: { theme: "light", style: { fontSize: "12px" }, y: { formatter: (val: number) => val.toString() } },
    plotOptions: { pie: { dataLabels: { offset: 25 }, donut: { size: "70%" } } },
  });

  const radarChartOptions: ApexOptions = {
    chart: { type: "radar", height: 300, toolbar: { show: false } },
    xaxis: { categories: ["Transcripts", "Processed", "Articulations", "Art. Courses", "Success Rate", "Efficiency"] },
    yaxis: { min: 0, max: 100, tickAmount: 5 },
    stroke: { width: 2 },
    fill: { opacity: 0.15 },
    markers: { size: 4 },
    colors: ["#3C50E0", "#10B981"],
    tooltip: { y: { formatter: (val) => `${val}%` } },
    legend: { position: "top", labels: { colors: "#64748b" } },
  };

  // ─── No Data Placeholder ──────────────────────────────────────────
  const NoDataPlaceholder = ({ height = 280 }: { height?: number }) => (
    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500" style={{ height }}>
      <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm font-medium">No data available</p>
      <p className="text-xs mt-1">Try adjusting your filters</p>
    </div>
  );

  // ─── Stat Card ─────────────────────────────────────────────────────
  const StatCard = ({
    title, value, subtitle, icon, colorClass, percentage,
  }: {
    title: string; value: string | number; subtitle?: string; icon: React.ReactNode;
    colorClass: "blue" | "green" | "red" | "purple" | "orange" | "indigo" | "teal";
    percentage?: number | null;
  }) => {
    const colorMap = {
      blue: { bg: "from-blue-50 via-blue-100/90 to-indigo-100/80 dark:from-blue-900/30 dark:via-blue-800/30 dark:to-indigo-900/30", border: "border-blue-200 dark:border-blue-700/40", text: "text-blue-700 dark:text-blue-300", value: "from-blue-700 via-indigo-700 to-blue-800 dark:from-blue-200 dark:via-indigo-200 dark:to-blue-100", dot: "bg-blue-500", iconBg: "from-blue-500 via-indigo-500 to-blue-600 shadow-blue-500/40", badge: "bg-blue-500/15 text-blue-800 border-blue-400/30 dark:bg-blue-400/20 dark:text-blue-200" },
      green: { bg: "from-green-50 via-green-100/90 to-emerald-100/80 dark:from-green-900/30 dark:via-green-800/30 dark:to-emerald-900/30", border: "border-green-200 dark:border-green-700/40", text: "text-green-700 dark:text-green-300", value: "from-green-700 via-emerald-700 to-green-800 dark:from-green-200 dark:via-emerald-200 dark:to-green-100", dot: "bg-green-500", iconBg: "from-green-500 via-emerald-500 to-green-600 shadow-green-500/40", badge: "bg-green-500/15 text-green-800 border-green-400/30 dark:bg-green-400/20 dark:text-green-200" },
      red: { bg: "from-red-50 via-red-100/90 to-rose-100/80 dark:from-red-900/30 dark:via-red-800/30 dark:to-rose-900/30", border: "border-red-200 dark:border-red-700/40", text: "text-red-700 dark:text-red-300", value: "from-red-700 via-rose-700 to-red-800 dark:from-red-200 dark:via-rose-200 dark:to-red-100", dot: "bg-red-500", iconBg: "from-red-500 via-rose-500 to-red-600 shadow-red-500/40", badge: "bg-red-500/15 text-red-800 border-red-400/30 dark:bg-red-400/20 dark:text-red-200" },
      purple: { bg: "from-purple-50 via-purple-100/90 to-fuchsia-100/80 dark:from-purple-900/30 dark:via-purple-800/30 dark:to-fuchsia-900/30", border: "border-purple-200 dark:border-purple-700/40", text: "text-purple-700 dark:text-purple-300", value: "from-purple-700 via-fuchsia-700 to-purple-800 dark:from-purple-200 dark:via-fuchsia-200 dark:to-purple-100", dot: "bg-purple-500", iconBg: "from-purple-500 via-fuchsia-500 to-purple-600 shadow-purple-500/40", badge: "bg-purple-500/15 text-purple-800 border-purple-400/30 dark:bg-purple-400/20 dark:text-purple-200" },
      orange: { bg: "from-orange-50 via-orange-100/90 to-amber-100/80 dark:from-orange-900/30 dark:via-orange-800/30 dark:to-amber-900/30", border: "border-orange-200 dark:border-orange-700/40", text: "text-orange-700 dark:text-orange-300", value: "from-orange-700 via-amber-700 to-orange-800 dark:from-orange-200 dark:via-amber-200 dark:to-orange-100", dot: "bg-orange-500", iconBg: "from-orange-500 via-amber-500 to-orange-600 shadow-orange-500/40", badge: "bg-orange-500/15 text-orange-800 border-orange-400/30 dark:bg-orange-400/20 dark:text-orange-200" },
      indigo: { bg: "from-indigo-50 via-indigo-100/90 to-violet-100/80 dark:from-indigo-900/30 dark:via-indigo-800/30 dark:to-violet-900/30", border: "border-indigo-200 dark:border-indigo-700/40", text: "text-indigo-700 dark:text-indigo-300", value: "from-indigo-700 via-violet-700 to-indigo-800 dark:from-indigo-200 dark:via-violet-200 dark:to-indigo-100", dot: "bg-indigo-500", iconBg: "from-indigo-500 via-violet-500 to-indigo-600 shadow-indigo-500/40", badge: "bg-indigo-500/15 text-indigo-800 border-indigo-400/30 dark:bg-indigo-400/20 dark:text-indigo-200" },
      teal: { bg: "from-teal-50 via-teal-100/90 to-cyan-100/80 dark:from-teal-900/30 dark:via-teal-800/30 dark:to-cyan-900/30", border: "border-teal-200 dark:border-teal-700/40", text: "text-teal-700 dark:text-teal-300", value: "from-teal-700 via-cyan-700 to-teal-800 dark:from-teal-200 dark:via-cyan-200 dark:to-teal-100", dot: "bg-teal-500", iconBg: "from-teal-500 via-cyan-500 to-teal-600 shadow-teal-500/40", badge: "bg-teal-500/15 text-teal-800 border-teal-400/30 dark:bg-teal-400/20 dark:text-teal-200" },
    };
    const c = colorMap[colorClass];
    return (
      <div className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} backdrop-blur-sm p-5 shadow-lg transition-all duration-500 hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1`}>
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`relative w-2 h-2 rounded-full ${c.dot}`}>
                <span className={`absolute inset-0 rounded-full animate-ping ${c.dot}`}></span>
              </div>
              <p className={`text-[11px] font-bold uppercase tracking-widest truncate ${c.text}`}>{title}</p>
            </div>
            <h3 className={`text-3xl font-black leading-none tracking-tight bg-gradient-to-br bg-clip-text text-transparent ${c.value} drop-shadow-sm`}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </h3>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {subtitle && <p className={`text-[11px] font-semibold ${c.text}`}>{subtitle}</p>}
              {percentage !== null && percentage !== undefined && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${c.badge}`}>
                  {percentage}%
                </span>
              )}
            </div>
          </div>
          <div className={`relative rounded-xl p-2.5 shadow-xl transition-all duration-500 group-hover:scale-110 bg-gradient-to-br ${c.iconBg} text-white`}>
            <div className="w-5 h-5">{icon}</div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Radar data based on real metrics ──────────────────────────────
  const radarCurrentData = [
    totalTranscripts > 0 ? Math.min(100, Math.round((totalTranscripts / Math.max(totalTranscripts, 1)) * 100)) : 0,
    totalTranscripts > 0 ? Math.round((processedCount / totalTranscripts) * 100) : 0,
    totalArticulations > 0 ? Math.min(100, Math.round((totalArticulations / Math.max(totalTranscripts, 1)) * 100)) : 0,
    totalArtCourses > 0 ? Math.min(100, Math.round((totalArtCourses / Math.max(totalTranscripts, 1)) * 100)) : 0,
    parseFloat(successRate),
    totalTranscripts > 0 ? Math.round(((processedCount + totalArticulations) / (totalTranscripts + totalArticulations || 1)) * 100) : 0,
  ];

  // ─── Recon Table Component ──────────────────────────────────────
  const ReconTable = ({
    title, subtitle, data, statusKey, countKey, colorMap,
  }: {
    title: string; subtitle: string;
    data: any[]; statusKey: string; countKey: string;
    colorMap: Record<string, string>;
  }) => {
    const total = data.reduce((s, r) => s + (r[countKey] || 0), 0);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-0.5 text-base font-bold text-gray-800 dark:text-white">{title}</h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        {data.length > 0 ? (
          <div className="space-y-2">
            {data.map((row, i) => {
              const status = row[statusKey] || "Unknown";
              const count = row[countKey] || 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
              const dotColor = colorMap[status.toUpperCase()] || colorMap[status] || "bg-gray-400";
              return (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColor}`}></span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{status}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div className={`h-full rounded-full ${dotColor}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[60px] text-right">{count.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[45px] text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{total.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No data available</p>
        )}
      </div>
    );
  };

  return (
    <PageWrapper>
      <PageMeta title="Advanced Dashboard | OSUCSC" description="Advanced analytics dashboard with comprehensive insights" />
      <PageBreadcrumb pageTitle="Advanced Dashboard" />

      <PageContainer>
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/college/dashboard")}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Dashboard
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-black dark:text-white">Advanced Analytics</h1>
                <span className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-medium text-white">
                  Real-time
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comprehensive insights with trend analysis and advanced metrics
              </p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["overview", "trends", "analysis", "recon"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  selectedView === view
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Section */}
        <div
          className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-md backdrop-blur-xl transition-all duration-300 animate-fade-in overflow-visible relative z-[60] dark:border-gray-800 dark:bg-gray-900"
          style={{ background: filterGradient, backdropFilter: "blur(20px)" }}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col flex-1 min-w-[280px]">
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">College Name</label>
              <SearchableMultiSelect
                options={collegesList.map((c) => ({ value: c.INSTITUTION_ID, label: c.INSTITUTION_NAME || c.INSTITUTION_ID }))}
                value={filters.college_name}
                onChange={(selected) => setFilters((prev) => ({ ...prev, college_name: selected }))}
                placeholder="All Colleges"
                searchPlaceholder="Search colleges..."
                maxHeight="250px"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <DatePicker
                id="adv-from-date"
                label="From Date"
                defaultDate={filters.fromdate}
                placeholder="Select from date"
                onChange={(_, dateStr) => handleFilterChange("fromdate", dateStr)}
                inputClassName="w-full rounded-xl border border-gray-300 bg-white/50 py-2.5 px-4 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400 dark:focus:bg-gray-800/70"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <DatePicker
                id="adv-to-date"
                label="To Date"
                defaultDate={filters.todate}
                placeholder="Select to date"
                onChange={(_, dateStr) => handleFilterChange("todate", dateStr)}
                inputClassName="w-full rounded-xl border border-gray-300 bg-white/50 py-2.5 px-4 text-sm text-gray-800 backdrop-blur-sm transition-all duration-200 focus:border-brand-500 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white/90 dark:focus:border-brand-400 dark:focus:bg-gray-800/70"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button onClick={handleSubmit} disabled={loading} className="transition-all duration-200 hover:scale-105 whitespace-nowrap">
                {loading ? "Loading..." : "Submit"}
              </Button>
              <Button onClick={handleClear} variant="outline" className="transition-all duration-200 hover:scale-105 whitespace-nowrap">
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
            <ThemedLoader size={80} className="text-brand-500" title="Loading Advanced Analytics" description="Crunching numbers and generating insights..." showProgress={true} />
          </div>
        ) : (
          <div className="space-y-6 relative z-0">

            {/* ── Overview View ──────────────────────────────────── */}
            {selectedView === "overview" && (
              <>
                {/* Key Metrics - 2 rows */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard title="Total Transcripts" value={totalTranscripts} subtitle="All transcript records" icon={<ChartBarIcon className="w-5 h-5" />} colorClass="blue" percentage={100} />
                  <StatCard title="Processed" value={processedCount} subtitle="Successfully processed" icon={<CheckCircleIcon className="w-5 h-5" />} colorClass="green" percentage={totalTranscripts > 0 ? Math.round((processedCount / totalTranscripts) * 100) : null} />
                  <StatCard title="Failed" value={failedCount} subtitle="Processing errors" icon={<AlertTriangleIcon className="w-5 h-5" />} colorClass="red" percentage={totalTranscripts > 0 ? Math.round((failedCount / totalTranscripts) * 100) : null} />
                  <StatCard title="Total Articulations" value={totalArticulations} subtitle="Articulation records" icon={<BoltIcon className="w-5 h-5" />} colorClass="purple" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard title="Success Rate" value={`${successRate}%`} subtitle="Transcript success" icon={<ShieldIcon className="w-5 h-5" />} colorClass="teal" />
                  <StatCard title="Error Rate" value={`${errorRate}%`} subtitle="Transcript errors" icon={<AlertTriangleIcon className="w-5 h-5" />} colorClass="orange" />
                  <StatCard title="Art. Courses" value={totalArtCourses} subtitle="Total articulation courses" icon={<SparklesIcon className="w-5 h-5" />} colorClass="indigo" />
                  <StatCard title="Total Kickouts" value={totalInitialKickouts + totalTranscriptKickouts} subtitle="Combined kickouts" icon={<ClockIcon className="w-5 h-5" />} colorClass="red" />
                </div>

                {/* Main charts - Line + Bar side by side */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* Transcript Sources - Line */}
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcripts Downloaded From Sources</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Trend</span>
                    </div>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.transcriptSources?.labels, dashboardData.transcriptSources?.datasets) ? (
                        <Chart
                          options={getLineChartOptions(dashboardData.transcriptSources?.labels || [], getColorsForDatasets(dashboardData.transcriptSources?.datasets))}
                          series={dashboardData.transcriptSources?.datasets || []}
                          type="line"
                          height={300}
                        />
                      ) : <NoDataPlaceholder height={300} />}
                    </div>
                  </div>

                  {/* Transcript Status - Bar */}
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcript Status</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Distribution</span>
                    </div>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.transcriptStatus?.labels, dashboardData.transcriptStatus?.datasets) ? (
                        <Chart
                          options={getBarChartOptions(dashboardData.transcriptStatus?.labels || [], getColorsForDatasets(dashboardData.transcriptStatus?.datasets))}
                          series={dashboardData.transcriptStatus?.datasets || []}
                          type="bar"
                          height={300}
                        />
                      ) : <NoDataPlaceholder height={300} />}
                    </div>
                  </div>
                </div>

                {/* Transcripts Processed in Banner - Full width area chart */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcripts Processed In Banner</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                    {hasChartData(dashboardData.transcriptProcessed?.labels, dashboardData.transcriptProcessed?.datasets) ? (
                      <Chart
                        options={getAreaChartOptions(dashboardData.transcriptProcessed?.labels || [], getColorsForDatasets(dashboardData.transcriptProcessed?.datasets))}
                        series={dashboardData.transcriptProcessed?.datasets || []}
                        type="area"
                        height={320}
                      />
                    ) : <NoDataPlaceholder height={320} />}
                  </div>
                </div>

                {/* Donut charts + Radar chart */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Transcript Status</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasDonutData(dashboardData.transcriptStatusDonut?.series, dashboardData.transcriptStatusDonut?.labels) ? (
                        <Chart options={donutChartOptions(dashboardData.transcriptStatusDonut?.labels || [])} series={dashboardData.transcriptStatusDonut?.series || []} type="donut" height={240} />
                      ) : <NoDataPlaceholder height={240} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Status</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasDonutData(dashboardData.articulationStatusDonut?.series, dashboardData.articulationStatusDonut?.labels) ? (
                        <Chart options={donutChartOptions(dashboardData.articulationStatusDonut?.labels || [])} series={dashboardData.articulationStatusDonut?.series || []} type="donut" height={240} />
                      ) : <NoDataPlaceholder height={240} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Art. Courses Status</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasDonutData(dashboardData.articulationCoursesStatusDonut?.series, dashboardData.articulationCoursesStatusDonut?.labels) ? (
                        <Chart options={donutChartOptions(dashboardData.articulationCoursesStatusDonut?.labels || [])} series={dashboardData.articulationCoursesStatusDonut?.series || []} type="donut" height={240} />
                      ) : <NoDataPlaceholder height={240} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Performance Radar</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {totalTranscripts > 0 ? (
                        <Chart
                          options={radarChartOptions}
                          series={[
                            { name: "Current", data: radarCurrentData },
                            { name: "Target", data: [100, 90, 80, 80, 85, 90] },
                          ]}
                          type="radar"
                          height={240}
                        />
                      ) : <NoDataPlaceholder height={240} />}
                    </div>
                  </div>
                </div>

                {/* Download Reports - Source Type & Status Distribution */}
                <div className="rounded-xl border-2 border-dashed border-purple-300/60 bg-gradient-to-br from-white via-white to-purple-50/30 p-6 shadow-lg dark:border-purple-600/40 dark:from-gray-800/90 dark:via-gray-800/90 dark:to-purple-900/20">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 p-2 shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white">Transcript Download Reports</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Source type and download status distribution for the selected period</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Source Type Distribution - Donut */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-900">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Source Type Distribution</h4>
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{totalSourceTypes.toLocaleString()} total</span>
                      </div>
                      <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                        {hasDonutData(dashboardData.sourceTypeDistribution?.series, dashboardData.sourceTypeDistribution?.labels) ? (
                          <Chart
                            options={donutChartOptions(dashboardData.sourceTypeDistribution?.labels || [])}
                            series={dashboardData.sourceTypeDistribution?.series || []}
                            type="donut"
                            height={280}
                          />
                        ) : <NoDataPlaceholder height={280} />}
                      </div>
                      {/* Source type breakdown list */}
                      {hasDonutData(dashboardData.sourceTypeDistribution?.series, dashboardData.sourceTypeDistribution?.labels) && (
                        <div className="mt-3 space-y-2">
                          {dashboardData.sourceTypeDistribution.labels.map((label, i) => {
                            const count = dashboardData.sourceTypeDistribution.series[i] || 0;
                            const pct = totalSourceTypes > 0 ? ((count / totalSourceTypes) * 100).toFixed(1) : "0.0";
                            return (
                              <div key={label} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 dark:text-gray-400">{count.toLocaleString()}</span>
                                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Download Status Distribution - Horizontal Bar */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-900">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Download Status Distribution</h4>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{totalDownloadStatuses.toLocaleString()} total</span>
                      </div>
                      <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                        {hasDonutData(dashboardData.downloadStatusDistribution?.series, dashboardData.downloadStatusDistribution?.labels) ? (
                          <Chart
                            options={getHorizontalBarOptions(
                              dashboardData.downloadStatusDistribution?.labels || [],
                              getDonutColors(dashboardData.downloadStatusDistribution?.labels)
                            )}
                            series={[{ name: "Count", data: dashboardData.downloadStatusDistribution?.series || [] }]}
                            type="bar"
                            height={280}
                          />
                        ) : <NoDataPlaceholder height={280} />}
                      </div>
                      {/* Status breakdown list */}
                      {hasDonutData(dashboardData.downloadStatusDistribution?.series, dashboardData.downloadStatusDistribution?.labels) && (
                        <div className="mt-3 space-y-2">
                          {dashboardData.downloadStatusDistribution.labels.map((label, i) => {
                            const count = dashboardData.downloadStatusDistribution.series[i] || 0;
                            const pct = totalDownloadStatuses > 0 ? ((count / totalDownloadStatuses) * 100).toFixed(1) : "0.0";
                            return (
                              <div key={label} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: getDonutColors([label])[0] }}></span>
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(parseFloat(pct), 100)}%`, backgroundColor: getDonutColors([label])[0] }} />
                                  </div>
                                  <span className="text-gray-500 dark:text-gray-400 min-w-[60px] text-right">{count.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Trends View ────────────────────────────────────── */}
            {selectedView === "trends" && (
              <>
                {/* All kickouts side by side */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Initial Kickouts</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.initialKickouts?.labels, dashboardData.initialKickouts?.datasets) ? (
                        <Chart
                          options={getBarChartOptions(dashboardData.initialKickouts?.labels || [], getColorsForDatasets(dashboardData.initialKickouts?.datasets))}
                          series={dashboardData.initialKickouts?.datasets || []}
                          type="bar"
                          height={280}
                        />
                      ) : <NoDataPlaceholder height={280} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Transcript Kickouts</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.transcriptKickouts?.labels, dashboardData.transcriptKickouts?.datasets) ? (
                        <Chart
                          options={getBarChartOptions(dashboardData.transcriptKickouts?.labels || [], getColorsForDatasets(dashboardData.transcriptKickouts?.datasets))}
                          series={dashboardData.transcriptKickouts?.datasets || []}
                          type="bar"
                          height={280}
                        />
                      ) : <NoDataPlaceholder height={280} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Kickouts</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.articulationKickouts?.labels, dashboardData.articulationKickouts?.datasets) ? (
                        <Chart
                          options={getBarChartOptions(dashboardData.articulationKickouts?.labels || [], getColorsForDatasets(dashboardData.articulationKickouts?.datasets))}
                          series={dashboardData.articulationKickouts?.datasets || []}
                          type="bar"
                          height={280}
                        />
                      ) : <NoDataPlaceholder height={280} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Courses Kickouts</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasChartData(dashboardData.articulationCoursesKickouts?.labels, dashboardData.articulationCoursesKickouts?.datasets) ? (
                        <Chart
                          options={getBarChartOptions(dashboardData.articulationCoursesKickouts?.labels || [], getColorsForDatasets(dashboardData.articulationCoursesKickouts?.datasets))}
                          series={dashboardData.articulationCoursesKickouts?.datasets || []}
                          type="bar"
                          height={280}
                        />
                      ) : <NoDataPlaceholder height={280} />}
                    </div>
                  </div>
                </div>

                {/* Combined line chart with all source datasets */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <h3 className="mb-4 text-base font-bold text-gray-800 dark:text-white">Transcript Sources vs Status (Combined Trend)</h3>
                  <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                    {hasChartData(dashboardData.transcriptSources?.labels, dashboardData.transcriptSources?.datasets) ? (
                      <Chart
                        options={getAreaChartOptions(dashboardData.transcriptSources?.labels || [], getColorsForDatasets(dashboardData.transcriptSources?.datasets))}
                        series={dashboardData.transcriptSources?.datasets || []}
                        type="area"
                        height={350}
                      />
                    ) : <NoDataPlaceholder height={350} />}
                  </div>
                </div>
              </>
            )}

            {/* ── Analysis View ──────────────────────────────────── */}
            {selectedView === "analysis" && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard title="New Transcripts" value={newCount} subtitle="Awaiting processing" icon={<ClockIcon className="w-5 h-5" />} colorClass="blue" />
                  <StatCard title="Rerun Count" value={rerunCount} subtitle="Reprocessed transcripts" icon={<RefreshIcon className="w-5 h-5" />} colorClass="orange" />
                  <StatCard title="Duplicates" value={duplicateCount} subtitle="Duplicate records" icon={<ChartBarIcon className="w-5 h-5" />} colorClass="indigo" />
                </div>

                {/* Detailed Breakdown Table */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <h3 className="mb-4 text-base font-bold text-gray-800 dark:text-white">Status Breakdown Analysis</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Metric</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Percentage</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distribution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {[
                          { label: "Processed", count: processedCount, color: "bg-green-500" },
                          { label: "Failed", count: failedCount, color: "bg-red-500" },
                          { label: "New", count: newCount, color: "bg-blue-500" },
                          { label: "Rerun", count: rerunCount, color: "bg-orange-500" },
                          { label: "Duplicate", count: duplicateCount, color: "bg-indigo-500" },
                          { label: "Initial Kickouts", count: totalInitialKickouts, color: "bg-yellow-500" },
                          { label: "Transcript Kickouts", count: totalTranscriptKickouts, color: "bg-pink-500" },
                          { label: "Total Downloads (Source)", count: totalSourceTypes, color: "bg-purple-500" },
                          { label: "Total Downloads (Status)", count: totalDownloadStatuses, color: "bg-cyan-500" },
                        ].map((row) => {
                          const pct = totalTranscripts > 0 ? ((row.count / totalTranscripts) * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={row.label} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${row.color}`}></span>
                                {row.label}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{row.count.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{pct}%</td>
                              <td className="px-4 py-3">
                                <div className="h-2 w-full max-w-[200px] rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Insights Section */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-4 flex items-center gap-3">
                    <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-base font-bold text-gray-800 dark:text-white">AI-Powered Insights</h3>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-100">Beta</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Insight cards based on real data */}
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <h5 className="font-semibold text-green-900 dark:text-green-100">Processing Efficiency</h5>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {parseFloat(successRate) >= 80
                          ? `Success rate at ${successRate}% - performing well above average. Continue current processing configuration.`
                          : `Success rate at ${successRate}% - consider reviewing error patterns to improve throughput.`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <h5 className="font-semibold text-orange-900 dark:text-orange-100">Kickout Analysis</h5>
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        {totalInitialKickouts + totalTranscriptKickouts > 0
                          ? `${(totalInitialKickouts + totalTranscriptKickouts).toLocaleString()} total kickouts detected. Initial: ${totalInitialKickouts.toLocaleString()}, Transcript: ${totalTranscriptKickouts.toLocaleString()}. Review validation rules.`
                          : "No kickouts detected in the selected period. Excellent data quality!"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h5 className="font-semibold text-blue-900 dark:text-blue-100">Volume Summary</h5>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {totalTranscripts > 0
                          ? `${totalTranscripts.toLocaleString()} transcripts processed with ${totalArticulations.toLocaleString()} articulations and ${totalArtCourses.toLocaleString()} course mappings in the selected period.`
                          : "No data available for the selected period. Adjust filters to see insights."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Side-by-side radar + donut */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Multi-Dimensional Performance</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {totalTranscripts > 0 ? (
                        <Chart
                          options={radarChartOptions}
                          series={[
                            { name: "Current", data: radarCurrentData },
                            { name: "Target", data: [100, 90, 80, 80, 85, 90] },
                          ]}
                          type="radar"
                          height={300}
                        />
                      ) : <NoDataPlaceholder height={300} />}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="mb-4 text-sm font-bold text-gray-800 dark:text-white">Articulation Courses Breakdown</h3>
                    <div className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                      {hasDonutData(dashboardData.articulationCoursesStatusDonut?.series, dashboardData.articulationCoursesStatusDonut?.labels) ? (
                        <Chart
                          options={donutChartOptions(dashboardData.articulationCoursesStatusDonut?.labels || [])}
                          series={dashboardData.articulationCoursesStatusDonut?.series || []}
                          type="donut"
                          height={300}
                        />
                      ) : <NoDataPlaceholder height={300} />}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Recon Report View ──────────────────────────────── */}
            {selectedView === "recon" && (
              <>
                {reconLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <ThemedLoader size={60} className="text-brand-500" title="Loading Recon Report" description="Fetching pipeline reconciliation data..." showProgress={true} />
                  </div>
                ) : reconData ? (
                  <div className="space-y-6">
                    {/* Pipeline Summary Header */}
                    <div className="rounded-xl border-2 border-dashed border-cyan-300/60 bg-gradient-to-r from-cyan-50 via-white to-blue-50 p-6 dark:border-cyan-600/40 dark:from-cyan-900/20 dark:via-gray-900 dark:to-blue-900/20">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2 shadow-lg">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Reconciliation Report</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Pipeline flow: Download → OCR → Data → Processing → Articulation ({filters.fromdate} to {filters.todate})
                          </p>
                        </div>
                        <button onClick={fetchReconReport} className="ml-auto flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          <RefreshIcon className="w-3.5 h-3.5" /> Refresh
                        </button>
                      </div>

                      {/* Pipeline flow cards */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {[
                          { label: "Download", data: reconData.downloadStatus, color: "blue", icon: "↓" },
                          { label: "OCR [P1]", data: reconData.ocrStatus, color: "purple", icon: "⊙" },
                          { label: "Data [P2]", data: reconData.hdrDataStatus, color: "indigo", icon: "≡" },
                          { label: "Processing", data: reconData.transcriptStatusByProject, color: "green", icon: "✓" },
                          { label: "Articulation", data: reconData.articulationStatusByProject, color: "orange", icon: "⇋" },
                        ].map((stage) => {
                          const total = (stage.data || []).reduce((s: number, r: any) => s + (r.count || 0), 0);
                          const colorMap: Record<string, string> = {
                            blue: "from-blue-500 to-blue-600", purple: "from-purple-500 to-purple-600",
                            indigo: "from-indigo-500 to-indigo-600", green: "from-green-500 to-green-600",
                            orange: "from-orange-500 to-orange-600",
                          };
                          const bgMap: Record<string, string> = {
                            blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700",
                            purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700",
                            indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700",
                            green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700",
                            orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700",
                          };
                          return (
                            <div key={stage.label} className={`rounded-xl border p-4 ${bgMap[stage.color]}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${colorMap[stage.color]} text-white text-xs font-bold shadow`}>{stage.icon}</span>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{stage.label}</span>
                              </div>
                              <div className="text-2xl font-black text-gray-900 dark:text-white">{total.toLocaleString()}</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{(stage.data || []).length} status types</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 1: Transcript Processing Status + Articulation Status */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <ReconTable
                        title="Transcript Processing Status"
                        subtitle="DIGISCRIPT_LOG – TRANSCRIPT_STATUS_FLAG"
                        data={reconData.transcriptStatusByProject || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ PROCESSED: "bg-green-500", FAILED: "bg-red-500", NEW: "bg-blue-500", RERUN: "bg-orange-500", DUPLICATE: "bg-indigo-500" }}
                      />
                      <ReconTable
                        title="Articulation Status"
                        subtitle="DIGISCRIPT_LOG – ARTICULATION_STATUS_FLAG"
                        data={reconData.articulationStatusByProject || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ PROCESSED: "bg-green-500", FAILED: "bg-red-500", "PARTIALLY PROCESSED": "bg-yellow-500", "PROCESSED & ROLLED": "bg-purple-500", RERUN: "bg-orange-500" }}
                      />
                    </div>

                    {/* Section 2: Download Status + OCR Status */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <ReconTable
                        title="Download Status"
                        subtitle="TRANSCRIPT_DOWNLOAD – STATUS"
                        data={reconData.downloadStatus || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ COMPLETED: "bg-green-500", PENDING: "bg-yellow-500", FAILED: "bg-red-500", "IN PROGRESS": "bg-blue-500" }}
                      />
                      <ReconTable
                        title="OCR Status [P1]"
                        subtitle="TRANSCRIPT_HDR_OCR – STATUS_FLAG"
                        data={reconData.ocrStatus || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ SUCCESS: "bg-green-500", FAILED: "bg-red-500", PENDING: "bg-yellow-500" }}
                      />
                    </div>

                    {/* Section 3: HDR Data Status + HDR Data After OCR Success */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <ReconTable
                        title="Header Data Status [P2]"
                        subtitle="TRANSCRIPT_HDR_DATA – STATUS_FLAG"
                        data={reconData.hdrDataStatus || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ SUCCESS: "bg-green-500", FAILED: "bg-red-500", PENDING: "bg-yellow-500" }}
                      />
                      <ReconTable
                        title="Header Data (After OCR Success)"
                        subtitle="TRANSCRIPT_HDR_DATA WHERE OCR = SUCCESS"
                        data={reconData.hdrDataAfterOcrSuccess || []}
                        statusKey="status"
                        countKey="count"
                        colorMap={{ SUCCESS: "bg-green-500", FAILED: "bg-red-500", PENDING: "bg-yellow-500" }}
                      />
                    </div>

                    {/* Section 4: Download Source + Status Cross-tab */}
                    {reconData.downloadSourceStatus && reconData.downloadSourceStatus.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                        <h3 className="mb-1 text-base font-bold text-gray-800 dark:text-white">Download Source × Status</h3>
                        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">TRANSCRIPT_DOWNLOAD grouped by SOURCE_TYPE and STATUS</p>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distribution</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {reconData.downloadSourceStatus.map((row: any, i: number) => {
                                const maxCount = Math.max(...reconData.downloadSourceStatus.map((r: any) => r.count || 0));
                                const pct = maxCount > 0 ? ((row.count / maxCount) * 100).toFixed(0) : "0";
                                return (
                                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.sourceType}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        row.status === "COMPLETED" || row.status === "SUCCESS" ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" :
                                        row.status === "FAILED" ? "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" :
                                        "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                                      }`}>{row.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{row.count.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                      <div className="h-2 w-full max-w-[200px] rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Section 5: Error Categories */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      {/* Transcript Errors */}
                      {reconData.transcriptErrorCategories && reconData.transcriptErrorCategories.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-lg dark:border-red-700/40 dark:bg-gray-900">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                            <h3 className="text-base font-bold text-gray-800 dark:text-white">Transcript Error Categories</h3>
                          </div>
                          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">FAILED transcripts grouped by error category</p>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {reconData.transcriptErrorCategories.map((err: any, i: number) => {
                              const totalErrors = reconData.transcriptErrorCategories.reduce((s: number, e: any) => s + (e.count || 0), 0);
                              const pct = totalErrors > 0 ? ((err.count / totalErrors) * 100).toFixed(1) : "0.0";
                              return (
                                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[70%]" title={err.category}>{err.category || "Unknown"}</span>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{err.count.toLocaleString()} ({pct}%)</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                                  </div>
                                  {err.reason && err.reason !== err.category && (
                                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 truncate" title={err.reason}>{err.reason}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Articulation Errors */}
                      {reconData.articulationErrorCategories && reconData.articulationErrorCategories.length > 0 && (
                        <div className="rounded-xl border border-orange-200 bg-white p-6 shadow-lg dark:border-orange-700/40 dark:bg-gray-900">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangleIcon className="w-5 h-5 text-orange-500" />
                            <h3 className="text-base font-bold text-gray-800 dark:text-white">Articulation Error Categories</h3>
                          </div>
                          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">FAILED / PARTIALLY PROCESSED articulation error categories</p>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {reconData.articulationErrorCategories.map((err: any, i: number) => {
                              const totalErrors = reconData.articulationErrorCategories.reduce((s: number, e: any) => s + (e.count || 0), 0);
                              const pct = totalErrors > 0 ? ((err.count / totalErrors) * 100).toFixed(1) : "0.0";
                              return (
                                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[70%]" title={err.category}>{err.category || "Unknown"}</span>
                                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{err.count.toLocaleString()} ({pct}%)</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                                  </div>
                                  {err.reason && err.reason !== err.category && (
                                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 truncate" title={err.reason}>{err.reason}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    <p className="text-sm font-medium">No recon data loaded</p>
                    <p className="text-xs mt-1">Click Submit or Refresh to load the report</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </PageContainer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.6s ease-out; }
      `}</style>
    </PageWrapper>
  );
}
