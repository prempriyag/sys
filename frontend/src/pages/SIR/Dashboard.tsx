import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getConstituencyKPI, getRiskMap, getConstituencies, getVoterDataSummaryByConstituencyYear } from '../../services/api';
import RiskMap from '../../components/RiskMap';
import ReactApexChart from 'react-apexcharts';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alertsuccess, alerterror } from '../../utils/toast';

interface Constituency {
  id: number | null;
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
  const [selectedConstituencyName, setSelectedConstituencyName] = useState<string | null>(null);
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
  const [voterDataSummary, setVoterDataSummary] = useState<Array<{
    constituency_name: string;
    years: Array<{ year: string; record_count: number; pdf_count: number }>;
    total_records: number;
  }>>([]);

  useEffect(() => {
    loadConstituencies();
    loadVoterDataSummary();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      loadDashboardData(selectedConstituency);
    } else if (selectedConstituencyName && !selectedConstituency) {
      setLoading(false);
    }
  }, [selectedConstituency, selectedConstituencyName]);

  const loadConstituencies = async () => {
    try {
      const response = await getConstituencies(true);
      setConstituencies(response.data);
      if (response.data.length > 0) {
        const first = response.data[0];
        if (first.id != null) {
          setSelectedConstituency(first.id);
          setSelectedConstituencyName(null);
        } else {
          setSelectedConstituency(null);
          setSelectedConstituencyName(first.name);
        }
      }
    } catch (error: any) {
      alerterror('Failed to load constituencies');
      console.error(error);
    }
  };

  const loadVoterDataSummary = async () => {
    try {
      const res = await getVoterDataSummaryByConstituencyYear();
      setVoterDataSummary((res.data as any)?.items ?? []);
    } catch {
      setVoterDataSummary([]);
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

  const selectedName = selectedConstituency != null
    ? (constituencies.find((c) => c.id === selectedConstituency)?.name ?? null)
    : selectedConstituencyName;
  const selectedBulkSummary = voterDataSummary.find(
    (s) => s.constituency_name && selectedName && s.constituency_name.toLowerCase() === selectedName.toLowerCase()
  );
  const hasYearComparison = selectedBulkSummary && selectedBulkSummary.years.length > 1;
  const yearComparisonOptions: ApexCharts.ApexOptions = hasYearComparison ? {
    chart: { type: 'bar', toolbar: { show: false } },
    xaxis: { categories: selectedBulkSummary!.years.map((y) => y.year), title: { text: 'Year' } },
    yaxis: { title: { text: 'Records' } },
    colors: ['#3b82f6'],
    dataLabels: { enabled: true },
    plotOptions: { bar: { borderRadius: 4 } },
  } : {};
  const yearComparisonSeries = hasYearComparison
    ? [{ name: 'Records', data: selectedBulkSummary!.years.map((y) => y.record_count) }]
    : [];

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
              value={selectedConstituency != null ? selectedConstituency : selectedConstituencyName ? `voter:${selectedConstituencyName}` : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('voter:')) {
                  setSelectedConstituency(null);
                  setSelectedConstituencyName(v.slice(6));
                } else {
                  setSelectedConstituency(Number(v));
                  setSelectedConstituencyName(null);
                }
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {constituencies.map((c) => (
                <option key={c.id ?? `voter-${c.name}`} value={c.id != null ? c.id : `voter:${c.name}`}>
                  {c.name} - {c.district || '(Bulk Upload)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Bulk Upload Summary by Constituency & Year */}
        {voterDataSummary.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Bulk Upload Summary by Constituency</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Voter records from bulk uploads, grouped by constituency and year
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Constituency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Year</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Records</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">PDFs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {voterDataSummary.flatMap((s) =>
                    s.years.map((y) => (
                      <tr
                        key={`${s.constituency_name}-${y.year}`}
                        className={`bg-white dark:bg-gray-800 ${
                          selectedName && s.constituency_name.toLowerCase() === selectedName.toLowerCase()
                            ? 'ring-1 ring-blue-500 dark:ring-blue-400'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{s.constituency_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{y.year}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">{y.record_count.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{y.pdf_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {hasYearComparison && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
                  Year Comparison: {selectedBulkSummary?.constituency_name}
                </h3>
                <ReactApexChart options={yearComparisonOptions} series={yearComparisonSeries} type="bar" height={280} />
              </div>
            )}
          </div>
        )}

        {/* KPI Cards - only when we have a constituency with id */}
        {selectedConstituency != null && (
        <>
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
        </>
        )}

        {/* Charts and Maps - only when we have a constituency with id */}
        {selectedConstituency != null && (
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
        )}

        {/* Risk Heatmap - only when we have a constituency with id */}
        {selectedConstituency != null && (
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
        )}

        {selectedConstituencyName != null && selectedConstituency == null && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-800 dark:text-amber-200">
            <p className="font-medium">Bulk Upload data only</p>
            <p className="text-sm mt-1">No Pre/Post SIR KPI or risk map for <strong>{selectedConstituencyName}</strong>. Select a constituency from the master list above to view full analysis.</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              onClick={() => selectedConstituency != null && navigate(`/booths?constituency=${selectedConstituency}`)}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedConstituency == null}
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">View Booth Analysis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detailed booth-level KPIs</p>
            </button>
            <button
              onClick={() => navigate('/upload/bulk-textract-extract')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition text-left"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">Bulk Upload</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Extract PDFs to voter_data by constituency</p>
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default SIRDashboard;
