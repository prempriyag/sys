import { useState, useEffect } from "react";
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
  EyeIcon,
  SearchIcon,
  LockIcon,
  MailIcon,
} from "../../../icons";

// Simple SVG icon components for missing icons
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const ServerIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const CpuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DollarSignIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Define TypeScript interfaces
interface PerformanceMetric {
  id: number;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface College {
  id: number;
  name: string;
  transcripts: number;
  successRate: number;
  processingTime: number;
  articulationRate: number;
  trend: string;
  status: 'active' | 'idle' | 'error';
}

interface Alert {
  id: number;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  time: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
}

interface PredictiveAnalytic {
  metric: string;
  current: number;
  predicted: number;
  confidence: number;
  recommendation: string;
}

export default function AdvancedDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("30days");
  const [selectedCollege, setSelectedCollege] = useState("all");
  const [selectedView, setSelectedView] = useState("overview");
  const [realtimeData, setRealtimeData] = useState({
    activeProcesses: 42,
    queueLength: 128,
    memoryUsage: 76,
    cpuUsage: 45,
    apiCalls: 1250,
    concurrentUsers: 89,
  });
  const [expandedSections, setExpandedSections] = useState({
    predictive: true,
    performance: true,
    alerts: true,
    geospatial: false,
  });

  // Advanced static data with more metrics
  const staticData = {
    overview: {
      totalTranscripts: 15420,
      processed: 12850,
      pending: 1850,
      failed: 720,
      rerun: 450,
      kickout: 550,
      successRate: 83.3,
      avgProcessingTime: 2.4,
      totalArticulations: 8920,
      coursesMapped: 12450,
      efficiencyScore: 88.7,
      costPerTranscript: 1.25,
    },
    
    // Advanced metrics
    kpis: {
      accuracyRate: 96.8,
      automationRate: 89.2,
      humanIntervention: 10.8,
      throughputPerHour: 892,
      errorRate: 4.7,
      slaCompliance: 99.2,
      customerSatisfaction: 4.8,
      roi: 245,
    },
    
    trends: {
      dailyProcessing: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        processed: [245, 312, 289, 356, 298, 234, 198],
        failed: [12, 18, 15, 22, 16, 14, 11],
        pending: [35, 42, 38, 47, 39, 32, 28],
      },
      weeklyComparison: {
        current: [1200, 1350, 1280, 1420, 1380, 1250, 1180],
        previous: [1100, 1220, 1180, 1300, 1260, 1150, 1100],
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      },
      monthlyTrends: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        volumes: [12500, 13200, 14100, 13800, 15200, 16100, 15700, 16500, 17200, 16800, 17500, 18000],
        successes: [10375, 10956, 11603, 11394, 12616, 13363, 13031, 13795, 14324, 14028, 14700, 15120],
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
    
    // Enhanced colleges data
    colleges: [
      { 
        id: 1, 
        name: "Ohio State University", 
        transcripts: 3420, 
        successRate: 87.5, 
        trend: "+5.2%",
        processingTime: 2.1,
        articulationRate: 92.3,
        status: 'active',
        region: "Midwest",
        efficiency: 94.2
      },
      { 
        id: 2, 
        name: "Miami University", 
        transcripts: 2890, 
        successRate: 85.3, 
        trend: "+3.8%",
        processingTime: 2.4,
        articulationRate: 89.7,
        status: 'active',
        region: "Midwest",
        efficiency: 91.5
      },
      { 
        id: 3, 
        name: "University of Cincinnati", 
        transcripts: 2560, 
        successRate: 82.1, 
        trend: "-1.2%",
        processingTime: 2.9,
        articulationRate: 85.4,
        status: 'warning',
        region: "Midwest",
        efficiency: 87.3
      },
      { 
        id: 4, 
        name: "Kent State University", 
        transcripts: 2130, 
        successRate: 88.9, 
        trend: "+7.1%",
        processingTime: 1.9,
        articulationRate: 93.8,
        status: 'active',
        region: "Midwest",
        efficiency: 95.6
      },
      { 
        id: 5, 
        name: "Bowling Green State", 
        transcripts: 1890, 
        successRate: 79.6, 
        trend: "+2.4%",
        processingTime: 3.2,
        articulationRate: 82.1,
        status: 'warning',
        region: "Midwest",
        efficiency: 84.7
      },
      { 
        id: 6, 
        name: "University of Toledo", 
        transcripts: 1560, 
        successRate: 91.2, 
        trend: "+8.3%",
        processingTime: 1.8,
        articulationRate: 94.5,
        status: 'active',
        region: "Midwest",
        efficiency: 96.8
      },
      { 
        id: 7, 
        name: "Cleveland State", 
        transcripts: 1420, 
        successRate: 76.8, 
        trend: "-2.1%",
        processingTime: 3.5,
        articulationRate: 79.3,
        status: 'critical',
        region: "Midwest",
        efficiency: 82.4
      },
      { 
        id: 8, 
        name: "University of Akron", 
        transcripts: 1280, 
        successRate: 84.5, 
        trend: "+1.7%",
        processingTime: 2.6,
        articulationRate: 87.9,
        status: 'active',
        region: "Midwest",
        efficiency: 89.2
      },
    ],
    
    errorBreakdown: [
      { type: "OCR Errors", count: 320, percentage: 44.4, color: "#EF4444", avgTime: 45, trend: -12 },
      { type: "Data Validation", count: 180, percentage: 25.0, color: "#F59E0B", avgTime: 23, trend: -5 },
      { type: "Articulation Mapping", count: 120, percentage: 16.7, color: "#8B5CF6", avgTime: 67, trend: +8 },
      { type: "System Errors", count: 100, percentage: 13.9, color: "#64748B", avgTime: 15, trend: -3 },
      { type: "Network Issues", count: 85, percentage: 11.8, color: "#3B82F6", avgTime: 12, trend: -15 },
      { type: "Format Errors", count: 65, percentage: 9.0, color: "#10B981", avgTime: 18, trend: +4 },
    ],
    
    recentActivity: [
      { id: 1, action: "Batch Processed", college: "Ohio State", count: 245, time: "2 hours ago", status: "success", duration: "45s" },
      { id: 2, action: "Articulation Completed", college: "Miami University", count: 189, time: "3 hours ago", status: "success", duration: "1m 23s" },
      { id: 3, action: "Error Detected", college: "UC", count: 12, time: "4 hours ago", status: "error", duration: "N/A" },
      { id: 4, action: "Batch Uploaded", college: "Kent State", count: 156, time: "5 hours ago", status: "success", duration: "38s" },
      { id: 5, action: "Rerun Initiated", college: "BGSU", count: 45, time: "6 hours ago", status: "pending", duration: "1m 15s" },
      { id: 6, action: "System Update", college: "System", count: 1, time: "8 hours ago", status: "info", duration: "15m" },
      { id: 7, action: "API Rate Limit", college: "System", count: 230, time: "12 hours ago", status: "warning", duration: "5m" },
    ],
    
    performanceMetrics: {
      avgResponseTime: 1.8,
      systemUptime: 99.8,
      dailyThroughput: 892,
      peakHour: "2:00 PM",
      bottleneck: "Articulation Processing",
      memoryUsage: 76,
      cpuUsage: 45,
      diskUsage: 62,
      networkLatency: 24,
      cacheHitRate: 89.3,
      databaseQueries: 12500,
    },
    
    // New modules
    predictiveAnalytics: [
      { metric: "Transcript Volume", current: 15420, predicted: 16850, confidence: 92, recommendation: "Scale up OCR processors" },
      { metric: "Error Rate", current: 4.7, predicted: 3.9, confidence: 85, recommendation: "Improve validation rules" },
      { metric: "Processing Time", current: 2.4, predicted: 2.1, confidence: 78, recommendation: "Optimize algorithms" },
      { metric: "Cost per Transcript", current: 1.25, predicted: 1.18, confidence: 88, recommendation: "Automate more tasks" },
    ],
    
    costAnalysis: {
      totalCost: 19275,
      costBreakdown: [
        { category: "Processing", cost: 11565, percentage: 60 },
        { category: "Storage", cost: 3855, percentage: 20 },
        { category: "Infrastructure", cost: 2891, percentage: 15 },
        { category: "Support", cost: 1927, percentage: 10 },
      ],
      savings: 4820,
      roi: 245,
    },
    
    compliance: {
      gdpr: 100,
      ferpa: 100,
      hipaa: 95,
      accessibility: 92,
      dataRetention: 100,
    },
    
    alerts: [
      { id: 1, type: 'error', message: 'OCR service degraded by 15%', time: '10:30 AM', source: 'Processor 3', priority: 'high' },
      { id: 2, type: 'warning', message: 'Memory usage above threshold', time: '09:45 AM', source: 'Server A', priority: 'medium' },
      { id: 3, type: 'info', message: 'Scheduled maintenance tonight', time: '08:15 AM', source: 'System', priority: 'low' },
      { id: 4, type: 'success', message: 'All systems operational', time: '07:30 AM', source: 'Monitor', priority: 'low' },
    ],
    
    // Geospatial data
    regionalPerformance: [
      { region: "Northeast", transcripts: 4200, successRate: 86.4, avgTime: 2.3 },
      { region: "Midwest", transcripts: 6800, successRate: 85.1, avgTime: 2.5 },
      { region: "South", transcripts: 3100, successRate: 84.2, avgTime: 2.7 },
      { region: "West", transcripts: 1320, successRate: 82.7, avgTime: 2.9 },
    ],
  };

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeData(prev => ({
        ...prev,
        activeProcesses: Math.floor(Math.random() * 30) + 30,
        queueLength: Math.floor(Math.random() * 100) + 80,
        memoryUsage: Math.floor(Math.random() * 20) + 70,
        cpuUsage: Math.floor(Math.random() * 30) + 40,
        apiCalls: prev.apiCalls + Math.floor(Math.random() * 100),
        concurrentUsers: Math.floor(Math.random() * 20) + 80,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Enhanced chart configurations
  const lineChartOptions: ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      toolbar: { show: true },
      zoom: { enabled: true },
      animations: { enabled: true, speed: 800 },
    },
    stroke: {
      curve: "smooth",
      width: 3,
      dashArray: [0, 5],
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
      axisBorder: { show: true },
      axisTicks: { show: true },
    },
    yaxis: [
      {
        title: { text: "Processed", style: { color: "#10B981", fontSize: "12px" } },
        labels: {
          style: { colors: "#64748B", fontSize: "12px" },
        },
      },
      {
        opposite: true,
        title: { text: "Failed", style: { color: "#EF4444", fontSize: "12px" } },
        labels: {
          style: { colors: "#64748B", fontSize: "12px" },
        },
      },
    ],
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: "#64748B" },
      itemMargin: { horizontal: 20 },
    },
    colors: ["#10B981", "#EF4444", "#F59E0B"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (val) => val.toLocaleString() },
    },
  };

  const areaChartOptions: ApexOptions = {
    chart: {
      type: "area",
      height: 350,
      toolbar: { show: true },
      zoom: { enabled: true },
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
        stops: [0, 90, 100],
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
      title: { text: "Transcripts", style: { fontSize: "12px" } },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      labels: { colors: "#64748B" },
    },
    colors: ["#3C50E0", "#8B5CF6", "#10B981"],
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: { formatter: (val) => val.toLocaleString() },
    },
  };

  const radarChartOptions: ApexOptions = {
    chart: {
      type: "radar",
      height: 350,
      toolbar: { show: false },
    },
    xaxis: {
      categories: ["Processing Speed", "Accuracy", "Uptime", "Cost Efficiency", "Scalability", "Security"],
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
    },
    stroke: {
      width: 2,
    },
    fill: {
      opacity: 0.1,
    },
    markers: {
      size: 4,
    },
    tooltip: {
      y: { formatter: (val) => `${val}%` },
    },
  };

  const donutChartOptions = (labels: string[], title: string): ApexOptions => ({
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
      formatter: function(seriesName, opts) {
        return `${seriesName}: ${opts.w.globals.series[opts.seriesIndex].toLocaleString()}`;
      },
    },
    colors: ["#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#3C50E0"],
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: { show: true, fontSize: "16px", color: "#64748B" },
            value: { 
              show: true, 
              fontSize: "24px", 
              fontWeight: "bold",
              color: "#1E293B",
              formatter: (val) => `${parseInt(val).toLocaleString()}`
            },
            total: {
              show: true,
              label: title,
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
      toolbar: { show: true },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "70%",
        borderRadius: 8,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { 
      enabled: true,
      formatter: (val) => `${val}%`,
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ["#1E293B"]
      }
    },
    xaxis: {
      categories: staticData.errorBreakdown.map((e) => e.type),
      labels: {
        style: { colors: "#64748B", fontSize: "11px" },
        rotate: -45,
      },
    },
    yaxis: {
      labels: {
        style: { colors: "#64748B", fontSize: "12px" },
      },
      title: { text: "Error Count", style: { fontSize: "12px" } },
    },
    colors: staticData.errorBreakdown.map((e) => e.color),
    grid: {
      borderColor: "#E2E8F0",
      strokeDashArray: 5,
    },
    tooltip: {
      y: { formatter: (val) => `${val} errors (${((val/720)*100).toFixed(1)}%)` },
    },
  };

  const heatmapOptions: ApexOptions = {
    chart: {
      type: "heatmap",
      height: 300,
      toolbar: { show: false },
    },
    dataLabels: {
      enabled: false,
    },
    colors: ["#10B981"],
    xaxis: {
      categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    yaxis: {
      categories: ["6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM", "12 AM"],
    },
    plotOptions: {
      heatmap: {
        shadeIntensity: 0.5,
        radius: 4,
        useFillColorAsStroke: true,
        colorScale: {
          ranges: [
            { from: 0, to: 50, color: "#10B981", name: "Low" },
            { from: 51, to: 100, color: "#F59E0B", name: "Medium" },
            { from: 101, to: 200, color: "#EF4444", name: "High" },
          ],
        },
      },
    },
  };

  // Custom Components
  const StatCard = ({
    title,
    value,
    change,
    icon,
    color,
    subtitle,
    trend,
    onClick,
  }: {
    title: string;
    value: string | number;
    change?: string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    onClick?: () => void;
  }) => (
    <div 
      className={`rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark hover:shadow-lg transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
            {title}
            {trend === 'up' && <ArrowUpIcon className="w-3 h-3 text-green-500" />}
            {trend === 'down' && <ArrowDownIcon className="w-3 h-3 text-red-500" />}
          </span>
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
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${color} bg-opacity-10`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const MetricCard = ({ title, value, target, unit, status }: PerformanceMetric) => (
    <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <div className={`w-2 h-2 rounded-full ${
          status === 'excellent' ? 'bg-green-500' :
          status === 'good' ? 'bg-blue-500' :
          status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <h4 className="text-xl font-bold text-black dark:text-white">{value}{unit}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Target: {target}{unit}</p>
        </div>
        <span className={`text-sm font-medium ${
          value >= target ? 'text-green-600' : 'text-red-600'
        }`}>
          {((value / target) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div 
          className={`h-full rounded-full ${
            value >= target ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
        />
      </div>
    </div>
  );

  const AlertCard = ({ alert }: { alert: Alert }) => (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${
      alert.type === 'error' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
      alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20' :
      alert.type === 'info' ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' :
      'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
    }`}>
      <div className={`p-2 rounded-full ${
        alert.type === 'error' ? 'bg-red-100 dark:bg-red-800' :
        alert.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-800' :
        alert.type === 'info' ? 'bg-blue-100 dark:bg-blue-800' :
        'bg-green-100 dark:bg-green-800'
      }`}>
        {alert.type === 'error' && <ErrorIcon className="w-4 h-4 text-red-600 dark:text-red-300" />}
        {alert.type === 'warning' && <AlertTriangleIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />}
        {alert.type === 'info' && <BellIcon className="w-4 h-4 text-blue-600 dark:text-blue-300" />}
        {alert.type === 'success' && <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-300" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{alert.message}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            alert.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' :
            alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
            'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
          }`}>
            {alert.priority}
          </span>
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{alert.source}</span> • <span>{alert.time}</span>
        </div>
      </div>
    </div>
  );

  const PredictiveCard = ({ analytic }: { analytic: PredictiveAnalytic }) => (
    <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{analytic.metric}</span>
        <div className="flex items-center gap-1">
          <TrendingUpIcon className={`w-4 h-4 ${
            analytic.predicted > analytic.current ? 'text-green-500' : 'text-red-500'
          }`} />
          <span className={`text-xs font-medium ${
            analytic.predicted > analytic.current ? 'text-green-600' : 'text-red-600'
          }`}>
            {((analytic.predicted - analytic.current) / analytic.current * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
          <p className="text-lg font-bold text-black dark:text-white">{analytic.current}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Predicted</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{analytic.predicted}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Confidence: {analytic.confidence}%</span>
          <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 rounded-full">
            AI
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{analytic.recommendation}</p>
      </div>
    </div>
  );

  const handleExport = (format: "pdf" | "excel" | "csv" | "json") => {
    // Placeholder for export functionality
    console.log(`Exporting report as ${format}`);
    alert(`Export functionality will be implemented. Format: ${format}`);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <PageWrapper>
      <PageMeta title="Advanced Analytics Dashboard | OSUCSC" description="Comprehensive analytics and reporting dashboard with real-time insights" />
      <PageBreadcrumb pageTitle="Advanced Analytics Dashboard" />

      <PageContainer>
        {/* Enhanced Header with Quick Actions */}
        <div className="mb-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-black dark:text-white">Advanced Analytics Dashboard</h1>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                  Real-time
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comprehensive insights, predictive analytics, and performance monitoring
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-stroke dark:border-strokedark">
                {["overview", "performance", "predictive", "reports"].map((view) => (
                  <button
                    key={view}
                    onClick={() => setSelectedView(view)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      selectedView === view
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

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
                <option value="custom">Custom Range</option>
              </select>

              {/* Export Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => handleExport("pdf")}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Export Report
                </Button>
              </div>

              <Button
                className="flex items-center gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>

          {/* Real-time Stats Bar */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Active Processes</span>
                <ActivityIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">{realtimeData.activeProcesses}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Queue</span>
                <DatabaseIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-green-900 dark:text-green-100">{realtimeData.queueLength}</div>
            </div>
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Memory</span>
                <ServerIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-yellow-900 dark:text-yellow-100">{realtimeData.memoryUsage}%</div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-red-700 dark:text-red-300">CPU</span>
                <CpuIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-red-900 dark:text-red-100">{realtimeData.cpuUsage}%</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">API Calls</span>
                <ZapIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-purple-900 dark:text-purple-100">{realtimeData.apiCalls}/min</div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Users</span>
                <UsersIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="mt-1 text-xl font-bold text-indigo-900 dark:text-indigo-100">{realtimeData.concurrentUsers}</div>
            </div>
          </div>
        </div>

        {/* Enhanced Key Metrics Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Transcripts"
            value={staticData.overview.totalTranscripts}
            change="+12.5%"
            icon={<FileIcon className="w-7 h-7 text-blue-500" />}
            color="bg-blue-500"
            subtitle="Year-to-date"
            trend="up"
            onClick={() => console.log('View transcripts')}
          />
          <StatCard
            title="Success Rate"
            value={`${staticData.overview.successRate}%`}
            change="+2.3%"
            icon={<CheckCircleIcon className="w-7 h-7 text-green-500" />}
            color="bg-green-500"
            subtitle="Above target (82%)"
            trend="up"
          />
          <StatCard
            title="Avg Processing Time"
            value={`${staticData.overview.avgProcessingTime}s`}
            change="-0.5s"
            icon={<ClockIcon className="w-7 h-7 text-purple-500" />}
            color="bg-purple-500"
            subtitle="Industry avg: 3.2s"
            trend="up"
          />
          <StatCard
            title="Cost Efficiency"
            value={`$${staticData.overview.costPerTranscript}`}
            change="-12%"
            icon={<DollarSignIcon className="w-7 h-7 text-green-500" />}
            color="bg-green-500"
            subtitle="Per transcript"
            trend="up"
          />
        </div>

        {/* Secondary Performance Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Automation Rate"
            value={`${staticData.kpis.automationRate}%`}
            icon={<BoltIcon className="w-6 h-6 text-blue-500" />}
            color="bg-blue-500"
            subtitle="AI-driven processing"
          />
          <StatCard
            title="SLA Compliance"
            value={`${staticData.kpis.slaCompliance}%`}
            icon={<ShieldIcon className="w-6 h-6 text-green-500" />}
            color="bg-green-500"
            subtitle="Service Level Agreement"
          />
          <StatCard
            title="ROI"
            value={`${staticData.costAnalysis.roi}%`}
            change="+15%"
            icon={<TrendingUpIcon className="w-6 h-6 text-purple-500" />}
            color="bg-purple-500"
            subtitle="Return on Investment"
            trend="up"
          />
        </div>

        {/* Main Dashboard Sections */}
        <div className="space-y-8">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Daily Processing Trend with Enhanced Controls */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">Processing Performance</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Real-time monitoring with trend analysis</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <FilterIcon className="w-4 h-4" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <DownloadIcon className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="h-[350px]">
                <Chart
                  options={lineChartOptions}
                  series={[
                    { name: "Processed", data: staticData.trends.dailyProcessing.processed },
                    { name: "Failed", data: staticData.trends.dailyProcessing.failed },
                    { name: "Pending", data: staticData.trends.dailyProcessing.pending },
                  ]}
                  type="line"
                  height="100%"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{Math.max(...staticData.trends.dailyProcessing.processed)}</div>
                  <div className="text-xs text-gray-500">Peak Daily</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {staticData.trends.dailyProcessing.processed.reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Weekly Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {staticData.trends.dailyProcessing.failed.reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-xs text-gray-500">Weekly Errors</div>
                </div>
              </div>
            </div>

            {/* Weekly Comparison with Forecast */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">Volume Trends & Forecast</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monthly comparison with predictive analytics</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    <TrendingUpIcon className="inline w-4 h-4 mr-1" />
                    +15.8% Growth
                  </span>
                </div>
              </div>
              <div className="h-[350px]">
                <Chart
                  options={areaChartOptions}
                  series={[
                    { name: "Current Month", data: staticData.trends.weeklyComparison.current },
                    { name: "Previous Month", data: staticData.trends.weeklyComparison.previous },
                    { name: "Forecast", data: staticData.trends.weeklyComparison.current.map(v => v * 1.15) },
                  ]}
                  type="area"
                  height="100%"
                />
              </div>
            </div>
          </div>

          {/* Status Distribution and Performance Metrics */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Status Distribution */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4">
                <h4 className="text-lg font-bold text-black dark:text-white">Status Distribution</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Real-time status overview</p>
              </div>
              <div className="h-[300px]">
                <Chart
                  options={donutChartOptions(staticData.statusDistribution.transcript.labels, "Total Transcripts")}
                  series={staticData.statusDistribution.transcript.series}
                  type="donut"
                  height="100%"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                  <div className="text-xs text-green-700 dark:text-green-300">Success Rate</div>
                  <div className="text-lg font-bold text-green-900 dark:text-green-100">{staticData.overview.successRate}%</div>
                </div>
                <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                  <div className="text-xs text-red-700 dark:text-red-300">Error Rate</div>
                  <div className="text-lg font-bold text-red-900 dark:text-red-100">
                    {((staticData.overview.failed / staticData.overview.totalTranscripts) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Error Analysis */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-black dark:text-white">Error Analysis</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Detailed error breakdown</p>
                  </div>
                  <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
              <div className="h-[300px]">
                <Chart
                  options={barChartOptions}
                  series={[{ name: "Errors", data: staticData.errorBreakdown.map((e) => e.count) }]}
                  type="bar"
                  height="100%"
                />
              </div>
              <div className="mt-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Top Issues</div>
                <div className="mt-2 space-y-2">
                  {staticData.errorBreakdown.slice(0, 3).map((error, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{error.type}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{error.count} errors</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Performance Radar */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4">
                <h4 className="text-lg font-bold text-black dark:text-white">System Performance</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Multi-dimensional analysis</p>
              </div>
              <div className="h-[300px]">
                <Chart
                  options={radarChartOptions}
                  series={[
                    {
                      name: "Current Performance",
                      data: [85, 96, 99, 88, 92, 95],
                    },
                    {
                      name: "Target",
                      data: [90, 95, 99, 85, 90, 98],
                    },
                  ]}
                  type="radar"
                  height="100%"
                />
              </div>
            </div>
          </div>

          {/* Predictive Analytics Section */}
          <div className="rounded-xl border border-stroke bg-white dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke px-6 py-4 dark:border-strokedark">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">Predictive Analytics</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered insights and recommendations</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('predictive')}
                >
                  {expandedSections.predictive ? 'Collapse' : 'Expand'}
                </Button>
              </div>
            </div>
            {expandedSections.predictive && (
              <div className="p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {staticData.predictiveAnalytics.map((analytic, index) => (
                    <PredictiveCard key={index} analytic={analytic} />
                  ))}
                </div>
                <div className="mt-6 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 p-4 dark:from-purple-900/20 dark:to-blue-900/20">
                  <div className="flex items-center gap-3">
                    <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">AI Recommendation</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Based on current trends, consider implementing additional OCR validation to reduce errors by 15%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colleges Performance & Alerts */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Enhanced Colleges Table */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-black dark:text-white">Colleges Performance</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ranked by efficiency score</p>
                </div>
                <Button variant="outline" size="sm">
                  <TableIcon className="w-4 h-4" />
                  View All
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stroke dark:border-strokedark">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">College</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Transcripts</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Success</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Efficiency</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staticData.colleges.map((college) => (
                      <tr key={college.id} className="border-b border-stroke hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              college.status === 'active' ? 'bg-green-500' :
                              college.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="font-medium text-gray-900 dark:text-white">{college.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">{college.transcripts.toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{college.successRate}%</span>
                            <span className={`text-xs ${
                              college.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {college.trend}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                              <div 
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${college.efficiency}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white">{college.efficiency}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            college.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                            college.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                            'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          }`}>
                            {college.status.charAt(0).toUpperCase() + college.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real-time Alerts & Activity */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-black dark:text-white">System Alerts</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Real-time monitoring and notifications</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <BellIcon className="w-4 h-4" />
                    Mute
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {staticData.alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
              <div className="mt-6">
                <h5 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Recent Activity</h5>
                <div className="space-y-3">
                  {staticData.recentActivity.slice(0, 4).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          activity.status === 'success' ? 'bg-green-100 dark:bg-green-800' :
                          activity.status === 'error' ? 'bg-red-100 dark:bg-red-800' :
                          activity.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-800' :
                          'bg-blue-100 dark:bg-blue-800'
                        }`}>
                          {activity.status === 'success' && <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-300" />}
                          {activity.status === 'error' && <ErrorIcon className="w-4 h-4 text-red-600 dark:text-red-300" />}
                          {activity.status === 'pending' && <ClockIcon className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />}
                          {activity.status === 'info' && <BellIcon className="w-4 h-4 text-blue-600 dark:text-blue-300" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{activity.college} • {activity.time}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{activity.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cost Analysis & Compliance */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Cost Analysis */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4">
                <h4 className="text-lg font-bold text-black dark:text-white">Cost Analysis</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Budget allocation and ROI</p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">${staticData.costAnalysis.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex h-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      {staticData.costAnalysis.costBreakdown.map((item, index) => (
                        <div
                          key={index}
                          className="h-full"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: index === 0 ? '#10B981' : 
                                          index === 1 ? '#3B82F6' : 
                                          index === 2 ? '#8B5CF6' : '#F59E0B'
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {staticData.costAnalysis.costBreakdown.map((item, index) => (
                        <div key={index} className="text-center">
                          <div className="text-xs font-medium text-gray-900 dark:text-white">{item.category}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.percentage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <div className="text-sm text-green-700 dark:text-green-300">Estimated Savings</div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">${staticData.costAnalysis.savings.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
                    <div className="text-sm text-purple-700 dark:text-purple-300">Return on Investment</div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{staticData.costAnalysis.roi}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Metrics */}
            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="mb-4">
                <h4 className="text-lg font-bold text-black dark:text-white">Compliance & Security</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Regulatory compliance metrics</p>
              </div>
              <div className="space-y-4">
                {Object.entries(staticData.compliance).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div 
                          className={`h-full rounded-full ${
                            value >= 95 ? 'bg-green-500' : 
                            value >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        value >= 95 ? 'text-green-600' : 
                        value >= 90 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {value}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <h5 className="font-medium text-green-900 dark:text-green-100">All systems compliant</h5>
                    <p className="text-sm text-green-700 dark:text-green-300">No compliance issues detected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Performance Heatmap */}
          <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-black dark:text-white">Regional Performance</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Geographical distribution and performance</p>
              </div>
              <Button variant="outline" size="sm">
                <GlobeIcon className="w-4 h-4" />
                View Map
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="h-[300px]">
                <Chart
                  options={heatmapOptions}
                  series={[
                    {
                      name: "Processing Volume",
                      data: [
                        { x: "Mon", y: "6 AM", value: 65 },
                        { x: "Mon", y: "9 AM", value: 128 },
                        { x: "Mon", y: "12 PM", value: 245 },
                        { x: "Mon", y: "3 PM", value: 198 },
                        { x: "Mon", y: "6 PM", value: 156 },
                        { x: "Mon", y: "9 PM", value: 89 },
                        { x: "Mon", y: "12 AM", value: 42 },
                      ]
                    }
                  ]}
                  type="heatmap"
                  height="100%"
                />
              </div>
              <div className="space-y-4">
                {staticData.regionalPerformance.map((region, index) => (
                  <div key={index} className="rounded-lg border border-stroke p-4 dark:border-strokedark">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">{region.region}</h5>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{region.transcripts.toLocaleString()} transcripts</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{region.successRate}%</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{region.avgTime}s avg time</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </PageWrapper>
  );
}

// Add missing icon component
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);