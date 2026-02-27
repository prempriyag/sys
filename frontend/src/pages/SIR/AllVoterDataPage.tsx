import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../../components/common/PageContainer";
import PageMeta from "../../components/common/PageMeta";
import ThemedLoader from "../../components/common/ThemedLoader";
import { alerterror } from "../../utils/toast";
import { getBulkVoterData, getBulkVoterDataQuality, VoterDataItem, VoterDataQualityRow } from "../../services/api";

const PAGE_SIZE = 100;

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));

const AllVoterDataPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [items, setItems] = useState<VoterDataItem[]>([]);
  const [qualityRows, setQualityRows] = useState<VoterDataQualityRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [qInput, setQInput] = useState("");
  const [pdfInput, setPdfInput] = useState("");
  const [q, setQ] = useState("");
  const [pdfName, setPdfName] = useState("");

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const rangeLabel = useMemo(() => {
    if (!total) return "0 records";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(total, page * PAGE_SIZE);
    return `${start}-${end} of ${total.toLocaleString()} records`;
  }, [page, total]);

  const loadPage = async (nextPage: number) => {
    setLoading(true);
    try {
      const res = await getBulkVoterData({
        page: nextPage,
        page_size: PAGE_SIZE,
        q: q || undefined,
        pdf_name: pdfName || undefined,
      });
      setItems(res.data.items || []);
      setPage(res.data.page || 1);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 0);
    } catch (e: any) {
      alerterror(e?.response?.data?.detail || "Failed to load voter data");
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const loadQuality = async () => {
    setQualityLoading(true);
    try {
      const res = await getBulkVoterDataQuality(50);
      setQualityRows(res.data.items || []);
    } catch {
      setQualityRows([]);
    } finally {
      setQualityLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
    loadQuality();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pdfName]);

  return (
    <PageContainer>
      <PageMeta title="All voter data | SIR" description="View all voter_data rows with pagination and quality summary." />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All voter data</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Paginated view of records saved in <code>voter_data</code>.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search EPIC / name / constituency / booth"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              value={pdfInput}
              onChange={(e) => setPdfInput(e.target.value)}
              placeholder="Filter by PDF name"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                setQ(qInput.trim());
                setPdfName(pdfInput.trim());
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply filters
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">{rangeLabel}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => canPrev && loadPage(page - 1)}
                disabled={!canPrev || loading}
                className="px-3 py-1.5 border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">Page {page} / {Math.max(1, totalPages)}</span>
              <button
                type="button"
                onClick={() => canNext && loadPage(page + 1)}
                disabled={!canNext || loading}
                className="px-3 py-1.5 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><ThemedLoader size={28} label="Loading voter data..." /></div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No records found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">EPIC</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Relative</th>
                    <th className="px-3 py-2 text-left">Age</th>
                    <th className="px-3 py-2 text-left">Gender</th>
                    <th className="px-3 py-2 text-left">House</th>
                    <th className="px-3 py-2 text-left">Booth</th>
                    <th className="px-3 py-2 text-left">Constituency</th>
                    <th className="px-3 py-2 text-left">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2">{fmt(r.epic_number)}</td>
                      <td className="px-3 py-2">{fmt(r.name)}</td>
                      <td className="px-3 py-2">{fmt(r.relative_name)}</td>
                      <td className="px-3 py-2">{fmt(r.age)}</td>
                      <td className="px-3 py-2">{fmt(r.gender)}</td>
                      <td className="px-3 py-2">{fmt(r.house_no)}</td>
                      <td className="px-3 py-2">{fmt(r.booth_number)}</td>
                      <td className="px-3 py-2">{fmt(r.constituency_name)}</td>
                      <td className="px-3 py-2 max-w-[320px] truncate" title={r.pdf_name || ""}>{fmt(r.pdf_name)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Per-PDF data completeness</h2>
          {qualityLoading ? (
            <ThemedLoader size={24} label="Loading quality summary..." />
          ) : qualityRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No quality rows available.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">PDF</th>
                    <th className="px-3 py-2 text-left">Records</th>
                    <th className="px-3 py-2 text-left">EPIC %</th>
                    <th className="px-3 py-2 text-left">Name %</th>
                    <th className="px-3 py-2 text-left">Age %</th>
                    <th className="px-3 py-2 text-left">Gender %</th>
                    <th className="px-3 py-2 text-left">Avg confidence %</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityRows.map((r, i) => (
                    <tr key={`${r.pdf_name || "unknown"}-${i}`} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2 max-w-[320px] truncate" title={r.pdf_name || ""}>{fmt(r.pdf_name)}</td>
                      <td className="px-3 py-2">{fmt(r.total_records)}</td>
                      <td className="px-3 py-2">{r.epic_present_pct}</td>
                      <td className="px-3 py-2">{r.name_present_pct}</td>
                      <td className="px-3 py-2">{r.age_present_pct}</td>
                      <td className="px-3 py-2">{r.gender_present_pct}</td>
                      <td className="px-3 py-2">{r.avg_confidence_pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default AllVoterDataPage;
