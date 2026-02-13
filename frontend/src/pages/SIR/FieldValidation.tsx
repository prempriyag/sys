import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import Button from "../../components/ui/button/Button";
import PageContainer from "../../components/common/PageContainer";
import PageMeta from "../../components/common/PageMeta";
import ThemedLoader from "../../components/common/ThemedLoader";
import { getHighRiskBooths, getValidationSample, getConstituencies } from "../../services/api";
import { DownloadIcon } from "../../icons";
import Badge from "../../components/ui/badge/Badge";
import { alertsuccess, alerterror } from "../../utils/toast";

interface FieldValidationProps {
  type?: 'sampling' | 'results';
}

interface HighRiskBooth {
  booth_number: string;
  location_name: string;
  deletion_velocity: number;
  risk_category: string;
  anomaly_household_count: number;
}

interface ValidationSample {
  epic_number: string;
  name: string;
  relative_name: string;
  booth_id: number;
  age: number;
  gender: string;
}

export default function FieldValidation({ type }: FieldValidationProps) {
  const [searchParams] = useSearchParams();
  const pageType = type || (searchParams.get('type') as 'sampling' | 'results') || 'sampling';
  
  const [loading, setLoading] = useState(false);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [highRiskBooths, setHighRiskBooths] = useState<HighRiskBooth[]>([]);
  const [validationSample, setValidationSample] = useState<ValidationSample[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadConstituencies();
  }, []);

  useEffect(() => {
    if (selectedConstituency) {
      if (pageType === 'results') {
        loadHighRiskBooths(selectedConstituency);
      } else {
        loadValidationSample(selectedConstituency);
      }
    }
  }, [selectedConstituency, pageType]);

  const loadConstituencies = async () => {
    try {
      const response = await getConstituencies();
      setConstituencies(response.data);
      if (response.data.length > 0) {
        setSelectedConstituency(response.data[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load constituencies:', error);
    }
  };

  const loadHighRiskBooths = async (constituencyId: number) => {
    setLoading(true);
    try {
      const response = await getHighRiskBooths(constituencyId, 10);
      setHighRiskBooths(response.data || []);
    } catch (error: any) {
      alerterror('Failed to load high risk booths');
    } finally {
      setLoading(false);
    }
  };

  const loadValidationSample = async (constituencyId: number, samplePercent: number = 5.0) => {
    setLoading(true);
    try {
      const response = await getValidationSample(constituencyId, samplePercent);
      setValidationSample(response.data || []);
    } catch (error: any) {
      alerterror('Failed to load validation sample');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    if (validationSample.length === 0) {
      alerterror('No sample data to download');
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8,"
      + "EPIC Number,Name,Relative Name,Booth ID,Age,Gender\n"
      + validationSample.map((r) => 
          `${r.epic_number || ''},"${r.name || ''}","${r.relative_name || ''}",${r.booth_id || ''},${r.age || ''},${r.gender || ''}`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `field_validation_sample_${selectedConstituency}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alertsuccess('Sample downloaded successfully');
  };

  if (pageType === 'results') {
    return (
      <PageContainer>
        <PageMeta title="Field Validation Results | SIR Impact Analysis" description="High Risk Booths for Field Validation" />
        
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Field Validation Results</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Top 10 high-risk booths requiring physical verification
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">High Risk Booths</h2>
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
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <ThemedLoader size={32} label="Loading..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Booth No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Deletion %</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {highRiskBooths.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No high risk booths found. Run matching analysis first.
                        </td>
                      </tr>
                    ) : (
                      highRiskBooths.map((booth, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{booth.booth_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{booth.location_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 font-bold">
                            {Number(booth.deletion_velocity).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={booth.risk_category === 'ANOMALY' ? 'error' : 'warning'}>
                              {booth.risk_category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {booth.anomaly_household_count || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageMeta title="Field Validation Sampling | SIR Impact Analysis" description="Generate sampling plan for field validation" />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Field Validation Sampling</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Generate random sample of deleted voters for physical verification (5% default)
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sampling Controls</h3>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Constituency
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 
                  px-4 py-2 text-gray-900 dark:text-white focus:border-brand-500 focus:ring-brand-500"
                value={selectedConstituency || ''}
                onChange={(e) => setSelectedConstituency(Number(e.target.value))}
                disabled={loading}
              >
                <option value="">Select constituency</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.district}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Downloads</h4>
              <Button 
                variant="outline" 
                onClick={handleDownloadSample} 
                className="w-full flex items-center justify-center gap-2"
                disabled={validationSample.length === 0}
              >
                <DownloadIcon className="w-4 h-4" />
                Download Sample CSV
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Validation Sample</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {validationSample.length} records (5% of deleted voters)
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <ThemedLoader size={32} label="Loading sample..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">EPIC</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Relative Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Booth ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Age</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {validationSample.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                          No sample data available. Select a constituency to generate sample.
                        </td>
                      </tr>
                    ) : (
                      validationSample.map((record, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.epic_number || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{record.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.relative_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.booth_id || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.age || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{record.gender || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
