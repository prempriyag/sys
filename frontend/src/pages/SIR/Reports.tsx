import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { getConstituencyKPI, getBoothsKPI, getConstituencies, getHighRiskBooths } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { DownloadIcon } from '../../icons';
import { alertsuccess, alerterror } from '../../utils/toast';

interface ReportsProps {
  type?: 'summary' | 'action-plan' | 'constituency';
}

// Dummy data for demonstration
const DUMMY_CONSTITUENCY_KPI = {
  total_pre: 150000,
  total_post: 152000,
  total_additions: 5000,
  total_deletions: 3000,
  avg_net_change_percent: 1.33,
  avg_deletion_velocity: 2.0,
  avg_youth_intake_percent: 3.5,
  avg_gender_shift_percent: 0.5,
  total_anomaly_households: 15,
  high_risk_booths: 5,
  high_opportunity_booths: 8,
  anomaly_booths: 3,
};

const DUMMY_HIGH_RISK_BOOTHS = [
  {
    booth_number: '101',
    location_name: 'Primary School, Main Street',
    deletion_velocity: 6.5,
    risk_category: 'HIGH_RISK',
    anomaly_household_count: 2,
  },
  {
    booth_number: '102',
    location_name: 'Community Hall, Park Road',
    deletion_velocity: 5.8,
    risk_category: 'HIGH_RISK',
    anomaly_household_count: 1,
  },
  {
    booth_number: '103',
    location_name: 'Government Office, Market Street',
    deletion_velocity: 7.2,
    risk_category: 'ANOMALY',
    anomaly_household_count: 5,
  },
  {
    booth_number: '104',
    location_name: 'Temple Complex, Temple Road',
    deletion_velocity: 5.5,
    risk_category: 'HIGH_RISK',
    anomaly_household_count: 0,
  },
  {
    booth_number: '105',
    location_name: 'School Ground, Education Street',
    deletion_velocity: 6.0,
    risk_category: 'HIGH_RISK',
    anomaly_household_count: 1,
  },
];

const Reports: React.FC<ReportsProps> = ({ type }) => {
  const [searchParams] = useSearchParams();
  const pageType = type || (searchParams.get('type') as 'summary' | 'action-plan' | 'constituency') || 'summary';
  
  const [loading, setLoading] = useState(true);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [useDummyData, setUseDummyData] = useState(false);

  useEffect(() => {
    loadConstituencies();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      loadReportData(selectedConstituency);
    } else {
      // If no constituency selected, use dummy data after a short delay
      const timer = setTimeout(() => {
        setUseDummyData(true);
        if (pageType === 'summary') {
          setReportData(DUMMY_CONSTITUENCY_KPI);
        } else if (pageType === 'action-plan') {
          setReportData({
            kpi: DUMMY_CONSTITUENCY_KPI,
            booths: [],
            highRisk: DUMMY_HIGH_RISK_BOOTHS,
          });
        } else {
          setReportData(DUMMY_CONSTITUENCY_KPI);
        }
        setLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedConstituency, pageType]);

  const loadConstituencies = async () => {
    try {
      const response = await getConstituencies();
      if (response.data && response.data.length > 0) {
        setConstituencies(response.data);
        setSelectedConstituency(response.data[0].id);
      } else {
        // No constituencies, use dummy data
        setUseDummyData(true);
        setConstituencies([{ id: 1, name: 'Sample Constituency', district: 'Sample District', state: 'Tamil Nadu' }]);
        setSelectedConstituency(1);
      }
    } catch (error: any) {
      console.warn('Failed to load constituencies, using dummy data:', error);
      // Use dummy data on error
      setUseDummyData(true);
      setConstituencies([{ id: 1, name: 'Sample Constituency', district: 'Sample District', state: 'Tamil Nadu' }]);
      setSelectedConstituency(1);
    }
  };

  const loadReportData = async (constituencyId: number) => {
    setLoading(true);
    setUseDummyData(false);
    try {
      if (pageType === 'summary') {
        const response = await getConstituencyKPI(constituencyId);
        setReportData(response.data);
      } else if (pageType === 'action-plan') {
        const [kpiResponse, boothsResponse, riskResponse] = await Promise.all([
          getConstituencyKPI(constituencyId),
          getBoothsKPI(constituencyId),
          getHighRiskBooths(constituencyId, 20),
        ]);
        setReportData({
          kpi: kpiResponse.data,
          booths: boothsResponse.data,
          highRisk: riskResponse.data || [],
        });
      } else {
        const response = await getConstituencyKPI(constituencyId);
        setReportData(response.data);
      }
    } catch (error: any) {
      console.warn('Failed to load report data, using dummy data:', error);
      // Use dummy data on error
      setUseDummyData(true);
      if (pageType === 'summary') {
        setReportData(DUMMY_CONSTITUENCY_KPI);
      } else if (pageType === 'action-plan') {
        setReportData({
          kpi: DUMMY_CONSTITUENCY_KPI,
          booths: [],
          highRisk: DUMMY_HIGH_RISK_BOOTHS,
        });
      } else {
        setReportData(DUMMY_CONSTITUENCY_KPI);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportData) {
      alerterror('No report data available');
      return;
    }

    let csvContent = '';
    let filename = '';

    if (pageType === 'summary') {
      filename = `sir_executive_summary_${selectedConstituency || 'sample'}.csv`;
      csvContent = "Metric,Value\n"
        + `Total Pre-SIR,${reportData.total_pre}\n`
        + `Total Post-SIR,${reportData.total_post}\n`
        + `Total Additions,${reportData.total_additions}\n`
        + `Total Deletions,${reportData.total_deletions}\n`
        + `Average Net Change %,${reportData.avg_net_change_percent.toFixed(2)}\n`
        + `Average Deletion Velocity,${reportData.avg_deletion_velocity.toFixed(2)}\n`
        + `Average Youth Intake %,${reportData.avg_youth_intake_percent.toFixed(2)}\n`
        + `Average Gender Shift %,${reportData.avg_gender_shift_percent.toFixed(2)}\n`
        + `High Risk Booths,${reportData.high_risk_booths}\n`
        + `High Opportunity Booths,${reportData.high_opportunity_booths}\n`
        + `Anomaly Booths,${reportData.anomaly_booths}\n`;
    } else if (pageType === 'action-plan') {
      filename = `sir_action_plan_${selectedConstituency || 'sample'}.csv`;
      csvContent = "Booth Number,Location,Deletion Velocity,Risk Category,Anomaly Households,Action Required\n"
        + (reportData.highRisk || []).map((b: any) => 
            `${b.booth_number || ''},"${b.location_name || ''}",${b.deletion_velocity || 0},"${b.risk_category || ''}",${b.anomaly_household_count || 0},"Field Verification Required"`
          ).join("\n");
    } else {
      filename = `sir_constituency_report_${selectedConstituency || 'sample'}.csv`;
      csvContent = "Metric,Value\n"
        + Object.entries(reportData).map(([key, value]) => 
            `${key},${value}`
          ).join("\n");
    }

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alertsuccess('Report downloaded successfully');
  };

  if (loading && !reportData) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <ThemedLoader size={32} label="Loading report..." />
        </div>
      </PageContainer>
    );
  }

  const renderSummary = () => {
    if (!reportData) return null;

    return (
      <div className="space-y-6">
        {useDummyData && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Note:</strong> Displaying sample data. Upload Pre-SIR and Post-SIR rolls to see actual data.
            </p>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Executive Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Pre-SIR Voters</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.total_pre.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Post-SIR Voters</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.total_post.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Change</p>
              <p className={`text-2xl font-bold ${reportData.avg_net_change_percent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {reportData.avg_net_change_percent > 0 ? '+' : ''}{reportData.avg_net_change_percent.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Deletion Velocity</p>
              <p className={`text-2xl font-bold ${reportData.avg_deletion_velocity > 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {reportData.avg_deletion_velocity.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Youth Intake</p>
              <p className="text-2xl font-bold text-blue-600">{reportData.avg_youth_intake_percent.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gender Shift</p>
              <p className="text-2xl font-bold text-purple-600">
                {reportData.avg_gender_shift_percent > 0 ? '+' : ''}{reportData.avg_gender_shift_percent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Risk Assessment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-400">High Risk Booths</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{reportData.high_risk_booths}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-400">High Opportunity Booths</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{reportData.high_opportunity_booths}</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-400">Anomaly Booths</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{reportData.anomaly_booths}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActionPlan = () => {
    if (!reportData || !reportData.highRisk) return null;

    return (
      <div className="space-y-6">
        {useDummyData && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Note:</strong> Displaying sample data. Upload Pre-SIR and Post-SIR rolls to see actual data.
            </p>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Booth Action Plan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            List of specific booths requiring legal or ground intervention
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Booth</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Deletion %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Anomalies</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {reportData.highRisk.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No high risk booths found.
                    </td>
                  </tr>
                ) : (
                  reportData.highRisk.map((booth: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{booth.booth_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{booth.location_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 font-bold">
                        {Number(booth.deletion_velocity || 0).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          booth.risk_category === 'HIGH_RISK' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                          booth.risk_category === 'ANOMALY' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}>
                          {booth.risk_category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{booth.anomaly_household_count || 0}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">Field Verification Required</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderConstituency = () => {
    return renderSummary(); // Same as summary for now
  };

  return (
    <PageContainer>
      <PageMeta
        title={`${pageType === 'summary' ? 'Executive Summary' : pageType === 'action-plan' ? 'Action Plan' : 'Constituency Report'} | SIR Impact Analysis`}
        description="SIR Impact Analysis Reports"
      />
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {pageType === 'summary' ? 'Executive Summary' : 
               pageType === 'action-plan' ? 'Booth Action Plan' : 
               'Constituency Report'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {pageType === 'summary' ? 'High-level impact assessment and win/loss estimation' :
               pageType === 'action-plan' ? 'List of specific booths requiring legal or ground intervention' :
               'Detailed constituency-level analysis report'}
            </p>
          </div>
          
          <div className="flex gap-4">
            {constituencies.length > 0 && (
              <select
                value={selectedConstituency || ''}
                onChange={(e) => setSelectedConstituency(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                disabled={loading}
              >
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.district}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                transition flex items-center gap-2"
              disabled={!reportData}
            >
              <DownloadIcon className="w-4 h-4" />
              Download Report
            </button>
          </div>
        </div>

        {pageType === 'summary' && renderSummary()}
        {pageType === 'action-plan' && renderActionPlan()}
        {pageType === 'constituency' && renderConstituency()}
      </div>
    </PageContainer>
  );
};

export default Reports;
