import React, { useState, useEffect, useMemo } from 'react';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror } from '../../utils/toast';
import {
  downloadEciRoll,
  getEciStates,
  getEciDistricts,
  getEciAssemblyConstituencies,
} from '../../services/api';

// For each state, language options with English first, then state language(s).
const STATE_LANGUAGES: Record<string, string[]> = {
  'Tamil Nadu': ['English', 'Tamil'],
  'Karnataka': ['English', 'Kannada'],
  'Kerala': ['English', 'Malayalam'],
  'Andhra Pradesh': ['English', 'Telugu'],
  'Telangana': ['English', 'Telugu'],
  'Maharashtra': ['English', 'Marathi'],
  'Gujarat': ['English', 'Gujarati'],
  'West Bengal': ['English', 'Bengali'],
  'Odisha': ['English', 'Odia'],
  'Punjab': ['English', 'Punjabi'],
  'Bihar': ['English', 'Hindi'],
  'Uttar Pradesh': ['English', 'Hindi'],
  'Delhi': ['English', 'Hindi'],
  'Rajasthan': ['English', 'Hindi'],
  'Madhya Pradesh': ['English', 'Hindi'],
  'Jharkhand': ['English', 'Hindi'],
  'Chhattisgarh': ['English', 'Hindi'],
  'Haryana': ['English', 'Hindi'],
  'Himachal Pradesh': ['English', 'Hindi'],
  'Assam': ['English', 'Assamese'],
  'Manipur': ['English', 'Manipuri'],
  'Meghalaya': ['English', 'Khasi', 'Garo'],
  'Mizoram': ['English', 'Mizo'],
  'Nagaland': ['English', 'State language (auto)'],
  'Tripura': ['English', 'Bengali', 'Kokborok'],
  'Sikkim': ['English', 'Nepali'],
  'Arunachal Pradesh': ['English', 'State language (auto)'],
  'Goa': ['English', 'Konkani', 'Marathi'],
  'Jammu and Kashmir': ['English', 'Urdu', 'Kashmiri'],
  'Ladakh': ['English', 'Ladakhi', 'Urdu'],
  'Puducherry': ['English', 'Tamil', 'French'],
  'Chandigarh': ['English', 'Hindi', 'Punjabi'],
  'Andaman and Nicobar Islands': ['English'],
  'Dadra and Nagar Haveli and Daman and Diu': ['English', 'Gujarati', 'Hindi'],
  'Lakshadweep': ['English', 'Malayalam'],
};

const DEFAULT_LANGUAGE_OPTIONS = ['English', 'State language (auto)'];

const EciDownloadPage: React.FC = () => {
  const [eciLoading, setEciLoading] = useState(false);
  const [eciManualCaptcha, setEciManualCaptcha] = useState(true);
  const [stateName, setStateName] = useState('');
  const [revyear, setRevyear] = useState('2026');
  const [district, setDistrict] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [acName, setAcName] = useState('');
  const [language, setLanguage] = useState('English');

  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [acOptions, setAcOptions] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAc, setLoadingAc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEciStates()
      .then((res) => {
        if (!cancelled && res.data?.states?.length) {
          setStateOptions(res.data.states);
          if (!stateName) setStateName(res.data.states.includes('Tamil Nadu') ? 'Tamil Nadu' : res.data.states[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setStateOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Language options for selected state: English first, then state language(s)
  const languageOptions = useMemo(() => {
    if (!stateName.trim()) return DEFAULT_LANGUAGE_OPTIONS;
    const list = STATE_LANGUAGES[stateName.trim()];
    return list && list.length > 0 ? list : DEFAULT_LANGUAGE_OPTIONS;
  }, [stateName]);

  // When state changes, reset language to English (first priority) and load district options
  useEffect(() => {
    if (!stateName.trim()) {
      setDistrictOptions([]);
      setDistrict('');
      setManualDistrict('');
      setAcOptions([]);
      setAcName('');
      setLanguage('English');
      return;
    }
    setLanguage('English');
    let cancelled = false;
    setLoadingDistricts(true);
    getEciDistricts(stateName.trim())
      .then((res) => {
        if (!cancelled) {
          const list = res.data?.districts ?? [];
          setDistrictOptions(list);
          setDistrict('');
          setManualDistrict('');
          setAcOptions([]);
          setAcName('');
        }
      })
      .catch(() => {
        if (!cancelled) setDistrictOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDistricts(false);
      });
    return () => { cancelled = true; };
  }, [stateName]);

  const effectiveDistrict = district === '__manual__' ? manualDistrict.trim() : district.trim();

  // When state and district are set, load assembly constituency options
  useEffect(() => {
    if (!stateName.trim() || !effectiveDistrict) {
      setAcOptions([]);
      setAcName('');
      return;
    }
    let cancelled = false;
    setLoadingAc(true);
    getEciAssemblyConstituencies(stateName.trim(), effectiveDistrict)
      .then((res) => {
        if (!cancelled) {
          const list = res.data?.assembly_constituencies ?? [];
          setAcOptions(list);
          setAcName('');
        }
      })
      .catch(() => {
        if (!cancelled) setAcOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAc(false);
      });
    return () => { cancelled = true; };
  }, [stateName, effectiveDistrict]);

  const allRequiredFilled =
    stateName.trim() !== '' &&
    effectiveDistrict !== '' &&
    acName.trim() !== '' &&
    revyear.trim() !== '' &&
    language.trim() !== '';

  const handleEciDownload = async () => {
    if (!stateName.trim()) {
      alerterror('Please select a state.');
      return;
    }
    if (!revyear.trim()) {
      alerterror('Please select year of revision.');
      return;
    }
    if (!effectiveDistrict) {
      alerterror('Please select or enter a district.');
      return;
    }
    if (!acName.trim()) {
      alerterror('Please select or enter an Assembly Constituency.');
      return;
    }
    if (!language.trim()) {
      alerterror('Please select a language.');
      return;
    }
    setEciLoading(true);
    try {
      const blob = await downloadEciRoll({
        state: stateName.trim(),
        revyear: revyear.trim(),
        district: effectiveDistrict,
        ac_name: acName.trim(),
        language: language.trim(),
        manual_captcha: eciManualCaptcha,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eci_electoral_roll.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      let msg = e?.message || 'ECI download failed';
      if (e?.response?.data) {
        const d = e.response.data;
        if (typeof d === 'string') msg = d;
        else if (d.detail) msg = typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
        else if (d.message) msg = d.message;
        else if (d instanceof Blob) {
          try {
            const t = await d.text();
            const j = JSON.parse(t);
            msg = j.detail || j.message || t;
          } catch {
            /* ignore */
          }
        }
      }
      alerterror(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setEciLoading(false);
    }
  };

  const acSelectOrInput = acOptions.length > 0;
  const districtIsManual = district === '__manual__';

  return (
    <PageContainer>
      <PageMeta
        title="Download from ECI"
        description="Download electoral roll PDFs from the ECI portal."
      />

      <div className="bg-white">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Download from ECI Portal</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State <span className="text-red-500">*</span>
            </label>
            <select
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={eciLoading || loadingStates}
            >
              <option value="">Select state</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year of Revision <span className="text-red-500">*</span>
            </label>
            <select
              value={revyear}
              onChange={(e) => setRevyear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={eciLoading}
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              District <span className="text-red-500">*</span>
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={eciLoading || !stateName}
            >
              <option value="">
                {!stateName ? 'Select state first' : loadingDistricts ? 'Loading districts...' : 'Select district'}
              </option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              {stateName && !loadingDistricts && districtOptions.length === 0 && (
                <option value="__manual__">— Enter district name manually —</option>
              )}
            </select>
            {districtIsManual && (
              <input
                value={manualDistrict}
                onChange={(e) => setManualDistrict(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter district name (required)"
                disabled={eciLoading}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assembly Constituency <span className="text-red-500">*</span>
            </label>
            {acSelectOrInput ? (
              <select
                value={acName}
                onChange={(e) => setAcName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                disabled={eciLoading || loadingAc || !effectiveDistrict}
              >
                <option value="">Select Assembly Constituency</option>
                {acOptions.map((ac) => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
            ) : (
              <input
                value={acName}
                onChange={(e) => setAcName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter Assembly Constituency name"
                disabled={eciLoading || !effectiveDistrict}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Language <span className="text-red-500">*</span>
            </label>
            <select
              value={languageOptions.includes(language) ? language : 'English'}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={eciLoading || !stateName}
            >
              {languageOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={eciManualCaptcha}
              onChange={(e) => setEciManualCaptcha(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enter captcha manually</span>
          </label>
        </div>
        <button
          type="button"
          onClick={handleEciDownload}
          disabled={eciLoading || !allRequiredFilled}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {eciLoading ? (
            <span className="flex gap-2">
              <ThemedLoader size={16} />
              {'Downloading from ECI...'}
            </span>
          ) : (
            'Download from ECI'
          )}
        </button>
      </div>
    </PageContainer>
  );
};

export default EciDownloadPage;
