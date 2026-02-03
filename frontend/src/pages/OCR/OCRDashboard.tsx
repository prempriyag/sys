import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import ThemedLoader from "../../components/common/ThemedLoader";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { API_ENDPOINTS, api } from "../../config/api";
import { RefreshIcon } from "../../icons";

type DashboardCounts = {
  total_tr: number;
  college_tr: number;
  school_tr: number;
  abbyy_tr: number;
  portal_tr: number;
  assigned_tr: number;
  unassigned_tr: number;
  schoolverified_tr: number;
  schooltobeverified_tr: number;
  schoolprocessed_tr: number;
  collegeverified_tr: number;
  collegetobeverified_tr: number;
  collegeprocessed_tr: number;
};

const defaultCounts: DashboardCounts = {
  total_tr: 0,
  college_tr: 0,
  school_tr: 0,
  abbyy_tr: 0,
  portal_tr: 0,
  assigned_tr: 0,
  unassigned_tr: 0,
  schoolverified_tr: 0,
  schooltobeverified_tr: 0,
  schoolprocessed_tr: 0,
  collegeverified_tr: 0,
  collegetobeverified_tr: 0,
  collegeprocessed_tr: 0,
};

export default function OCRDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts>(defaultCounts);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const data = await api.get(API_ENDPOINTS.OCR_DASHBOARD_COUNTS);
      setCounts({ ...defaultCounts, ...data });
    } catch (e) {
      console.error("Failed to fetch OCR dashboard counts", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const barChartOptions = (): ApexOptions => ({
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
    dataLabels: { enabled: true },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    xaxis: {
      categories: ["Total"],
      labels: { style: { colors: "#64748b" } },
    },
    yaxis: {
      title: { text: "Count", style: { color: "#64748b" } },
      labels: { style: { colors: "#64748b" } },
      tickAmount: 5,
    },
    fill: { opacity: 1 },
    legend: {
      position: "top",
      labels: { colors: "#64748b", useSeriesColors: false },
      markers: { shape: "circle" },
    },
    colors: ["#ce8ee8", "#56e0c4", "#7fc0eb", "#f0b67d", "#ef9183"],
    grid: {
      borderColor: "rgba(148, 163, 184, 0.1)",
      strokeDashArray: 4,
      show: true,
    },
    tooltip: {
      theme: "light",
      y: { formatter: (val: number) => val.toString() },
    },
  });

  const collegeBarOptions = (): ApexOptions => ({
    ...barChartOptions(),
    colors: ["#62DDBD", "#A9B1BC", "#73B1F4", "#B3A5EF"],
  });

  const schoolBarOptions = (): ApexOptions => ({
    ...barChartOptions(),
    colors: ["#62DDBD", "#A9B1BC", "#73B1F4", "#B3A5EF"],
  });

  const transcriptsExtractedSeries = [
    { name: "Total Transcripts", data: [counts.total_tr] },
    { name: "Abbyy", data: [counts.abbyy_tr] },
    { name: "Portal", data: [counts.portal_tr] },
    { name: "Assigned", data: [counts.assigned_tr] },
    { name: "Un-Assigned", data: [counts.unassigned_tr] },
  ];

  const collegeTranscriptsSeries = [
    { name: "Transcripts", data: [counts.college_tr] },
    { name: "Verified", data: [counts.collegeverified_tr] },
    { name: "To Be Verified", data: [counts.collegetobeverified_tr] },
    { name: "Processed", data: [counts.collegeprocessed_tr] },
  ];

  const schoolTranscriptsSeries = [
    { name: "Transcripts", data: [counts.school_tr] },
    { name: "Verified", data: [counts.schoolverified_tr] },
    { name: "To Be Verified", data: [counts.schooltobeverified_tr] },
    { name: "Processed", data: [counts.schoolprocessed_tr] },
  ];

  return (
    <PageWrapper>
      <PageMeta title="OCR Dashboard" description="OCR Verify module dashboard" />
      <PageBreadcrumb pageTitle="OCR Dashboard" />

      <PageContainer>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            OCR Dashboard
          </h3>
          <button
            type="button"
            onClick={fetchCounts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <ThemedLoader size={48} className="text-brand-500" label="Loading dashboard" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Transcripts Extracted & Assigned */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
              <h4 className="mb-4 text-center text-lg font-semibold text-gray-800 dark:text-white">
                Transcripts Extracted & Assigned
              </h4>
              <div className="h-[300px]">
                <Chart
                  options={barChartOptions()}
                  series={transcriptsExtractedSeries}
                  type="bar"
                  height="100%"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* College Transcripts */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <h4 className="mb-4 text-center text-lg font-semibold text-gray-800 dark:text-white">
                  College Transcripts
                </h4>
                <div className="h-[250px]">
                  <Chart
                    options={collegeBarOptions()}
                    series={collegeTranscriptsSeries}
                    type="bar"
                    height="100%"
                  />
                </div>
              </div>

              {/* School Transcripts */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <h4 className="mb-4 text-center text-lg font-semibold text-gray-800 dark:text-white">
                  School Transcripts
                </h4>
                <div className="h-[250px]">
                  <Chart
                    options={schoolBarOptions()}
                    series={schoolTranscriptsSeries}
                    type="bar"
                    height="100%"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}
