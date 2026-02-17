import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getConstituencyKPI, getRiskMap, getConstituencies } from '../../services/api';
import RiskMap from '../../components/RiskMap';
import ReactApexChart from 'react-apexcharts';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alertsuccess, alerterror } from '../../utils/toast';

interface Constituency {
  id: number;
  name: string;
  district: string;
  state: string;
}

interface ConstituencyKPI {
  total_pre: number;
  total_post: number;
  total_additions: number;
  total_deletions: number;
  avg_net_change_percent: number;
  avg_deletion_velocity: number;
  avg_youth_intake_percent: number;
  avg_gender_shift_percent: number;
  total_anomaly_households: number;
  high_risk_booths: number;
  high_opportunity_booths: number;
  anomaly_booths: number;
}

const SIRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [kpi, setKpi] = useState<ConstituencyKPI>({
    total_pre: 0,
    total_post: 0,
    total_additions: 0,
    total_deletions: 0,
    avg_net_change_percent: 0,
    avg_deletion_velocity: 0,
    avg_youth_intake_percent: 0,
    avg_gender_shift_percent: 0,
    total_anomaly_households: 0,
    high_risk_booths: 0,
    high_opportunity_booths: 0,
    anomaly_booths: 0,
  });
  const [booths, setBooths] = useState<any[]>([]);

  useEffect(() => {
    loadConstituencies();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      loadDashboardData(selectedConstituency);
    }
  }, [selectedConstituency]);

  const loadConstituencies = async () => {
    try {
      const response = await getConstituencies();
      setConstituencies(response.data);
      if (response.data.length > 0) {
        setSelectedConstituency(response.data[0].id);
      }
    } catch (error: any) {
      alerterror('Failed to load constituencies');
      console.error(error);
    }
  };

  const loadDashboardData = async (constituencyId: number) => {
    setLoading(true);
    try {
      const [kpiResponse, riskMapResponse] = await Promise.all([
        getConstituencyKPI(constituencyId),
        getRiskMap(constituencyId),
      ]);
      
      setKpi(kpiResponse.data);
      setBooths(riskMapResponse.data || []);
    } catch (error: any) {
      alerterror('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { 
      type: 'bar',
      toolbar: { show: false },
    },
    xaxis: { 
      categories: ['Additions', 'Deletions'],
      labels: { style: { fontSize: '12px' } }
    },
    yaxis: {
      title: { text: 'Number of Voters' }
    },
    colors: ['#10b981', '#ef4444'],
    dataLabels: { enabled: true },
    legend: { show: false },
  };

  const chartSeries = [{
    name: 'Voters',
    data: [kpi.total_additions, kpi.total_deletions]
  }];

  const riskChartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'donut' },
    labels: ['High Risk', 'High Opportunity', 'Anomaly', 'Normal'],
    colors: ['#ef4444', '#10b981', '#f59e0b', '#6b7280'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: true },
  };

  const riskChartSeries = [
    kpi.high_risk_booths,
    kpi.high_opportunity_booths,
    kpi.anomaly_booths,
    Math.max(0, (booths.length || 0) - kpi.high_risk_booths - kpi.high_opportunity_booths - kpi.anomaly_booths)
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <ThemedLoader size={32} label="Loading dashboard data..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageMeta
        title="SIR Impact Analysis Dashboard | KTech Products"
        description="Special Intensive Revision (SIR) Impact Analysis Dashboard"
      />
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              SIR Impact Analysis Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Special Intensive Revision Electoral Roll Analysis
            </p>
          </div>
          
          {constituencies.length > 0 && (
            <select
              value={selectedConstituency || ''}
              onChange={(e) => setSelectedConstituency(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {constituencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.district}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Total Pre-SIR</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {kpi.total_pre.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Voters in Pre-SIR roll</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Total Post-SIR</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {kpi.total_post.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Voters in Post-SIR roll</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Net Change</h3>
            <p className={`text-3xl font-bold ${kpi.avg_net_change_percent > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpi.avg_net_change_percent > 0 ? '+' : ''}{kpi.avg_net_change_percent.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Average change per booth</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Deletion Velocity</h3>
            <p className={`text-3xl font-bold ${kpi.avg_deletion_velocity > 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
              {kpi.avg_deletion_velocity.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Average deletion rate</p>
          </div>
        </div>

        {/* Additional KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Youth Intake</h3>
            <p className="text-3xl font-bold text-blue-600">
              {kpi.avg_youth_intake_percent.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">New voters (18-30 years)</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Gender Shift</h3>
            <p className="text-3xl font-bold text-purple-600">
              {kpi.avg_gender_shift_percent > 0 ? '+' : ''}{kpi.avg_gender_shift_percent.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Change in gender ratio</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">High Risk Booths</h3>
            <p className="text-3xl font-bold text-red-600">
              {kpi.high_risk_booths}
            </p>
            <p className="text-xs text-gray-400 mt-1">Booths requiring attention</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">Anomaly Households</h3>
            <p className="text-3xl font-bold text-orange-600">
              {kpi.total_anomaly_households}
            </p>
            <p className="text-xs text-gray-400 mt-1">Households with &gt;15 voters</p>
          </div>
        </div>

        {/* Charts and Maps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Voter Churn Analysis</h2>
            <ReactApexChart 
              options={chartOptions} 
              series={chartSeries} 
              type="bar" 
              height={350} 
            />
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Booth Risk Distribution</h2>
            <ReactApexChart 
              options={riskChartOptions} 
              series={riskChartSeries} 
              type="donut" 
              height={350} 
            />
          </div>
        </div>

        {/* Risk Heatmap */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Risk Heatmap</h2>
            <button
              onClick={() => navigate('/booths/risk-map')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Full Map →
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Geospatial distribution of high-deletion and high-opportunity booths
          </p>
          <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <RiskMap booths={booths} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/upload/pre-sir')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Pre-SIR Roll</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload electoral roll before SIR</p>
            </button>
            <button
              onClick={() => navigate('/upload/post-sir')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition text-left"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Post-SIR Roll</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload electoral roll after SIR</p>
            </button>
            <button
              onClick={() => selectedConstituency && navigate(`/booths?constituency=${selectedConstituency}`)}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition text-left"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">View Booth Analysis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detailed booth-level KPIs</p>
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default SIRDashboard;
