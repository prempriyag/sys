import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import DataTable from 'react-data-table-component';
import { getBoothsKPI, getConstituencies } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror } from '../../utils/toast';

interface BoothKPI {
  booth_id: number;
  booth_number: string;
  location_name: string;
  total_pre: number;
  total_post: number;
  additions: number;
  deletions: number;
  net_change_percent: number;
  deletion_velocity: number;
  youth_intake_percent: number;
  gender_shift_percent: number;
  anomaly_household_count: number;
  risk_category: string;
}

const BoothKPIs: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(
    Number(searchParams.get('constituency')) || null
  );
  const [booths, setBooths] = useState<BoothKPI[]>([]);

  useEffect(() => {
    loadConstituencies();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      loadBoothKPIs(selectedConstituency);
    }
  }, [selectedConstituency]);

  const loadConstituencies = async () => {
    try {
      const response = await getConstituencies();
      setConstituencies(response.data);
      if (!selectedConstituency && response.data.length > 0) {
        setSelectedConstituency(response.data[0].id);
      }
    } catch (error: any) {
      alerterror('Failed to load constituencies');
    }
  };

  const loadBoothKPIs = async (constituencyId: number) => {
    setLoading(true);
    try {
      const response = await getBoothsKPI(constituencyId);
      setBooths(response.data);
    } catch (error: any) {
      alerterror('Failed to load booth KPIs');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { id: 'booth_number', name: 'Booth Number', selector: (row: BoothKPI) => row.booth_number, sortable: true },
    { id: 'location_name', name: 'Location', selector: (row: BoothKPI) => row.location_name || '-', sortable: true },
    { id: 'total_pre', name: 'Pre-SIR', selector: (row: BoothKPI) => row.total_pre, sortable: true, format: (row: BoothKPI) => row.total_pre.toLocaleString() },
    { id: 'total_post', name: 'Post-SIR', selector: (row: BoothKPI) => row.total_post, sortable: true, format: (row: BoothKPI) => row.total_post.toLocaleString() },
    { id: 'additions', name: 'Additions', selector: (row: BoothKPI) => row.additions, sortable: true, format: (row: BoothKPI) => row.additions.toLocaleString() },
    { id: 'deletions', name: 'Deletions', selector: (row: BoothKPI) => row.deletions, sortable: true, format: (row: BoothKPI) => row.deletions.toLocaleString() },
    { id: 'net_change_percent', name: 'Net Change %', selector: (row: BoothKPI) => row.net_change_percent, sortable: true, format: (row: BoothKPI) => (<span className={row.net_change_percent > 0 ? 'text-green-600' : 'text-red-600'}>{row.net_change_percent > 0 ? '+' : ''}{row.net_change_percent.toFixed(2)}%</span>) },
    { id: 'deletion_velocity', name: 'Deletion Velocity', selector: (row: BoothKPI) => row.deletion_velocity, sortable: true, format: (row: BoothKPI) => (<span className={row.deletion_velocity > 5 ? 'text-red-600 font-semibold' : ''}>{row.deletion_velocity.toFixed(2)}%</span>) },
    { id: 'youth_intake_percent', name: 'Youth Intake %', selector: (row: BoothKPI) => row.youth_intake_percent, sortable: true, format: (row: BoothKPI) => `${row.youth_intake_percent.toFixed(2)}%` },
    { id: 'gender_shift_percent', name: 'Gender Shift %', selector: (row: BoothKPI) => row.gender_shift_percent, sortable: true, format: (row: BoothKPI) => (<span className={row.gender_shift_percent !== 0 ? 'text-blue-600' : ''}>{row.gender_shift_percent > 0 ? '+' : ''}{row.gender_shift_percent.toFixed(2)}%</span>) },
    { id: 'anomaly_household_count', name: 'Anomaly Households', selector: (row: BoothKPI) => row.anomaly_household_count, sortable: true, format: (row: BoothKPI) => (<span className={row.anomaly_household_count > 0 ? 'text-orange-600 font-semibold' : ''}>{row.anomaly_household_count}</span>) },
    { id: 'risk_category', name: 'Risk Category', selector: (row: BoothKPI) => row.risk_category, sortable: true, format: (row: BoothKPI) => { const colors: Record<string, string> = { HIGH_RISK: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', HIGH_OPPORTUNITY: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', ANOMALY: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400', NORMAL: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' }; return (<span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[row.risk_category] || colors.NORMAL}`}>{row.risk_category}</span>); } },
    { id: 'actions', name: 'Actions', cell: (row: BoothKPI) => (<button onClick={() => navigate(`/booth-analysis/${row.booth_id}`)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">View Details</button>) },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <ThemedLoader size={32} label="Loading booth KPIs..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageMeta
        title="Booth KPIs | SIR Impact Analysis"
        description="Booth-level Key Performance Indicators"
      />
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Booth KPIs</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Detailed booth-level performance indicators and risk analysis
            </p>
          </div>
          
          {constituencies.length > 0 && (
            <select
              value={selectedConstituency || ''}
              onChange={(e) => setSelectedConstituency(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {constituencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.district}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <DataTable
            data={booths}
            columns={columns}
            title="Booth Analysis"
            pagination
            defaultSortFieldId="booth_number"
            responsive
            striped
            dense
          />
        </div>
      </div>
    </PageContainer>
  );
};

export default BoothKPIs;
