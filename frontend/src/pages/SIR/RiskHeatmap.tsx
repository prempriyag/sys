import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { getRiskMap, getConstituencies } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import RiskMap from '../../components/RiskMap';
import { alerterror } from '../../utils/toast';

const RiskHeatmap: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(
    Number(searchParams.get('constituency')) || null
  );
  const [booths, setBooths] = useState<any[]>([]);

  useEffect(() => {
    loadConstituencies();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      loadRiskMap(selectedConstituency);
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

  const loadRiskMap = async (constituencyId: number) => {
    setLoading(true);
    try {
      const response = await getRiskMap(constituencyId);
      setBooths(response.data || []);
    } catch (error: any) {
      alerterror('Failed to load risk map data');
    } finally {
      setLoading(false);
    }
  };

  const riskStats = {
    high_risk: booths.filter((b) => b.risk_category === 'HIGH_RISK').length,
    high_opportunity: booths.filter((b) => b.risk_category === 'HIGH_OPPORTUNITY').length,
    anomaly: booths.filter((b) => b.risk_category === 'ANOMALY').length,
    normal: booths.filter((b) => b.risk_category === 'NORMAL').length,
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <ThemedLoader size={32} label="Loading risk map..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageMeta
        title="Risk Heatmap | SIR Impact Analysis"
        description="Geospatial risk analysis of electoral booths"
      />
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Risk Heatmap</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Geospatial distribution of high-deletion and high-opportunity booths
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

        {/* Risk Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-400">High Risk</h3>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{riskStats.high_risk}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Booths</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-400">High Opportunity</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{riskStats.high_opportunity}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Booths</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="text-sm font-medium text-orange-800 dark:text-orange-400">Anomaly</h3>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{riskStats.anomaly}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Booths</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-400">Normal</h3>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{riskStats.normal}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Booths</p>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Booth Locations</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click on markers to view booth details. Colors indicate risk categories.
            </p>
          </div>
          <div className="h-[600px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {booths.length > 0 ? (
              <RiskMap booths={booths} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No booth location data available. Please ensure booths have geographic coordinates.
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">High Risk</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Deletions &gt;5% AND Turnout &gt;70%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">High Opportunity</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Additions &gt;10% in favorable demographics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Anomaly</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  &gt;15 voters per household detected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Normal</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No significant risk indicators
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default RiskHeatmap;
