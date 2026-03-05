import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { uploadPreSir, uploadPostSir, uploadPreSirPdf, uploadPostSirPdf, runMatching, getConstituencies, parseElectoralRollPdf } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alertsuccess, alerterror } from '../../utils/toast';

interface UploadPageProps {
  type?: 'pre' | 'post' | 'matching';
}

const UploadPage: React.FC<UploadPageProps> = ({ type }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pageType = type || (searchParams.get('type') as 'pre' | 'post' | 'matching') || 'pre';
  
  const [preFile, setPreFile] = useState<File | null>(null);
  const [postFile, setPostFile] = useState<File | null>(null);
  const [pdfConstituencyName, setPdfConstituencyName] = useState('');
  const [pdfBoothNumber, setPdfBoothNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [electoralPdf, setElectoralPdf] = useState<File | null>(null);
  const [electoralConstituency, setElectoralConstituency] = useState('');
  const [electoralBooth, setElectoralBooth] = useState('');
  const [parsingElectoral, setParsingElectoral] = useState(false);

  useEffect(() => {
    loadConstituencies();
  }, []);

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

  const handleUpload = async (uploadType: 'pre' | 'post') => {
    const file = uploadType === 'pre' ? preFile : postFile;
    if (!file) {
      alerterror('Please select a file to upload');
      return;
    }

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const formData = new FormData();
    formData.append('file', file);
    if (isPdf) {
      if (pdfConstituencyName.trim()) formData.append('constituency_name', pdfConstituencyName.trim());
      if (pdfBoothNumber.trim()) formData.append('booth_number', pdfBoothNumber.trim());
    }

    try {
      setUploading(true);
      setStatus(`${isPdf ? 'Extracting from PDF and uploading' : 'Uploading'} ${uploadType.toUpperCase()}-SIR data...`);

      const response = isPdf
        ? (uploadType === 'pre' ? await uploadPreSirPdf(formData) : await uploadPostSirPdf(formData))
        : (uploadType === 'pre' ? await uploadPreSir(formData) : await uploadPostSir(formData));

      const msg = response.data.message || `${uploadType.toUpperCase()}-SIR ${isPdf ? 'extracted and ' : ''}uploaded successfully!`;
      if (response.data.records_processed !== undefined) {
        alertsuccess(`${msg} (${response.data.records_processed} records)`);
      } else {
        alertsuccess(msg);
      }
      setStatus('');

      if (uploadType === 'pre') setPreFile(null);
      else setPostFile(null);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Upload failed';
      alerterror(Array.isArray(errorMsg) ? errorMsg.map((x: any) => x?.msg || x).join(', ') : errorMsg);
      setStatus('');
    } finally {
      setUploading(false);
    }
  };

  const handleRunMatching = async () => {
    if (!selectedConstituency) {
      alerterror('Please select a constituency');
      return;
    }

    try {
      setMatching(true);
      setStatus('Running matching algorithm...');
      
      const response = await runMatching(selectedConstituency);
      alertsuccess(response.data.message || 'Matching completed successfully!');
      setStatus('');
      
      // Navigate to dashboard after matching
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Matching failed';
      alerterror(errorMsg);
      setStatus('');
    } finally {
      setMatching(false);
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="SIR Data Upload | KTech Products"
        description="Upload Pre-SIR and Post-SIR electoral rolls"
      />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Upload</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Upload electoral rolls and run matching analysis
          </p>
        </div>

        {/* Workflow reminder */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Do in this order:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-amber-900 dark:text-amber-100">
            <li><strong>Upload Pre-SIR Roll</strong> – roll before Special Intensive Revision (CSV or PDF).</li>
            <li><strong>Upload Post-SIR Roll</strong> – roll after revision (same format).</li>
            <li><strong>Run Matching</strong> – compare both rolls, classify voters, compute booth KPIs. <em>Required before Reports and Booth Analysis.</em></li>
          </ol>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">After matching, use <strong>Dashboard</strong>, <strong>Booth Analysis</strong>, <strong>Field Validation</strong>, and <strong>Reports</strong> for validation and reports.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 max-w-4xl">
          {/* Pre-SIR Upload */}
          {(pageType === 'pre' || pageType === 'matching') && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                1. Upload Pre-SIR Electoral Roll
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload the electoral roll before Special Intensive Revision (SIR). 
                CSV: columns epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name. 
                PDF: ECI-style electoral roll (table with EPIC No, Name, Relative, Age, Sex, House No, Address).
              </p>
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".csv,.pdf"
                  onChange={(e) => setPreFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4 file:rounded-lg
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/20 dark:file:text-blue-400
                    hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
                    cursor-pointer"
                  disabled={uploading}
                />
                {preFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Selected: {preFile.name} ({(preFile.size / 1024).toFixed(2)} KB)
                    {preFile.name.toLowerCase().endsWith('.pdf') && ' — optional: set constituency/booth below if not in PDF.'}
                  </p>
                )}
                {preFile?.name.toLowerCase().endsWith('.pdf') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Constituency name (optional)</label>
                      <input type="text" value={pdfConstituencyName} onChange={(e) => setPdfConstituencyName(e.target.value)} placeholder="e.g. Chennai North" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booth / Part number (optional)</label>
                      <input type="text" value={pdfBoothNumber} onChange={(e) => setPdfBoothNumber(e.target.value)} placeholder="e.g. 20" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleUpload('pre')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                    transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!preFile || uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Pre-SIR'}
                </button>
              </div>
            </div>
          )}

          {/* Post-SIR Upload */}
          {(pageType === 'post' || pageType === 'matching') && (
            <div className={`${pageType === 'matching' ? 'border-t pt-8' : ''} mb-8`}>
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                2. Upload Post-SIR Electoral Roll
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload the electoral roll after Special Intensive Revision (SIR). 
                Same CSV or PDF format as Pre-SIR.
              </p>
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".csv,.pdf"
                  onChange={(e) => setPostFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4 file:rounded-lg
                    file:border-0 file:text-sm file:font-semibold
                    file:bg-green-50 file:text-green-700 dark:file:bg-green-900/20 dark:file:text-green-400
                    hover:file:bg-green-100 dark:hover:file:bg-green-900/30
                    cursor-pointer"
                  disabled={uploading}
                />
                {postFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Selected: {postFile.name} ({(postFile.size / 1024).toFixed(2)} KB)
                    {postFile.name.toLowerCase().endsWith('.pdf') && ' — optional: set constituency/booth above (shared with Pre-SIR) if not in PDF.'}
                  </p>
                )}
                {postFile?.name.toLowerCase().endsWith('.pdf') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Constituency name (optional)</label>
                      <input type="text" value={pdfConstituencyName} onChange={(e) => setPdfConstituencyName(e.target.value)} placeholder="e.g. Chennai North" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booth / Part number (optional)</label>
                      <input type="text" value={pdfBoothNumber} onChange={(e) => setPdfBoothNumber(e.target.value)} placeholder="e.g. 20" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleUpload('post')}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                    transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!postFile || uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Post-SIR'}
                </button>
              </div>
            </div>
          )}

          {/* Single tool: Electoral Roll PDF → CSV (digital or scanned) */}
          <div className="border-t pt-8 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Electoral Roll PDF to CSV
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Upload any ECI electoral roll PDF (digital or scanned voter cards). Text is extracted from digital PDFs; scanned PDFs are processed with OCR. Optionally add constituency name and booth/part number. Downloaded CSV is ready to upload as Pre-SIR or Post-SIR.
            </p>
            <div className="space-y-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setElectoralPdf(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold
                  file:bg-amber-50 file:text-amber-700 dark:file:bg-amber-900/20 dark:file:text-amber-400
                  hover:file:bg-amber-100 dark:hover:file:bg-amber-900/30 cursor-pointer"
                disabled={parsingElectoral}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Constituency name (optional)</label>
                  <input
                    type="text"
                    value={electoralConstituency}
                    onChange={(e) => setElectoralConstituency(e.target.value)}
                    placeholder="e.g. Chennai North"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={parsingElectoral}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booth / Part number (optional)</label>
                  <input
                    type="text"
                    value={electoralBooth}
                    onChange={(e) => setElectoralBooth(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={parsingElectoral}
                  />
                </div>
              </div>
              {electoralPdf && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selected: {electoralPdf.name} ({(electoralPdf.size / 1024).toFixed(2)} KB)
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setElectoralPdf(null); setElectoralConstituency(''); setElectoralBooth(''); setStatus(''); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm"
                >
                  Clear
                </button>
                <button
                  onClick={async () => {
                    if (!electoralPdf) { alerterror('Please select a PDF'); return; }
                    const fd = new FormData();
                    fd.append('file', electoralPdf, electoralPdf.name);
                    fd.append('constituency_name', electoralConstituency);
                    fd.append('booth_number', electoralBooth);
                    setParsingElectoral(true);
                    setStatus('Parsing electoral roll PDF...');
                    try {
                      const res = await parseElectoralRollPdf(fd);
                      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = (electoralPdf.name.replace(/\.pdf$/i, '') || 'electoral_roll') + '_parsed.csv';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                      alertsuccess('CSV downloaded. You can upload it as Pre-SIR or Post-SIR.');
                      setStatus('');
                      setElectoralPdf(null);
                      setElectoralConstituency('');
                      setElectoralBooth('');
                    } catch (e: any) {
                      const msg = e.response?.data?.detail || e.message || 'Parse failed';
                      alerterror(typeof msg === 'string' ? msg : JSON.stringify(msg));
                      setStatus('');
                    } finally {
                      setParsingElectoral(false);
                    }
                  }}
                  className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
                  disabled={!electoralPdf || parsingElectoral}
                >
                  {parsingElectoral ? 'Parsing...' : 'Convert PDF to CSV'}
                </button>
              </div>
            </div>
          </div>

          {/* Run Matching */}
          {pageType === 'matching' && (
            <div className="border-t pt-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                3. Run Matching Analysis
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                After uploading both Pre-SIR and Post-SIR rolls, run the matching algorithm to:
                classify voters (UNCHANGED, ADDED, DELETED, MODIFIED, MIGRATED), calculate booth KPIs, and generate risk scores.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Constituency
                  </label>
                  <select
                    value={selectedConstituency || ''}
                    onChange={(e) => setSelectedConstituency(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    disabled={matching}
                  >
                    <option value="">Select a constituency</option>
                    {constituencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.district}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleRunMatching}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                    transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedConstituency || matching}
                >
                  {matching ? (
                    <span className="flex items-center gap-2">
                      <ThemedLoader size={16} />
                      Running Matching...
                    </span>
                  ) : (
                    'Run Matching Analysis'
                  )}
                </button>
              </div>
            </div>
          )}

          {status && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-center rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-700 dark:text-blue-300">{status}</p>
            </div>
          )}

          {/* Navigation Links */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              {pageType !== 'pre' && (
                <button
                  onClick={() => navigate('/upload/pre-sir')}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  ← Upload Pre-SIR
                </button>
              )}
              {pageType !== 'post' && (
                <button
                  onClick={() => navigate('/upload/post-sir')}
                  className="text-sm text-green-600 hover:text-green-700 dark:text-green-400"
                >
                  Upload Post-SIR →
                </button>
              )}
              {pageType !== 'matching' && (
                <button
                  onClick={() => navigate('/upload/matching')}
                  className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  Run Matching →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default UploadPage;
