import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { api, API_ENDPOINTS } from "../../config/api";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import Button from "../../components/ui/button/Button";

export default function CollegeHDRBatch() {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batch_id") || "";
  const verify = searchParams.get("verify") || "no";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{
    batch_id: string;
    prev_batch_id: string | null;
    next_batch_id: string | null;
    rec: Record<string, unknown> | null;
    linedata: Record<string, unknown>[];
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (batchId) {
      fetchBatch();
    } else {
      setLoading(false);
      setError("Batch ID is required");
    }
  }, [batchId, verify]);

  const fetchBatch = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API_ENDPOINTS.OCR_COLLEGE_HDR_BATCH}?batch_id=${encodeURIComponent(batchId)}&verify=${encodeURIComponent(verify)}`;
      const response = await api.get(url);
      setBatch({
        batch_id: response.batch_id ?? batchId,
        prev_batch_id: response.prev_batch_id ?? null,
        next_batch_id: response.next_batch_id ?? null,
        rec: response.rec ?? null,
        linedata: Array.isArray(response.linedata) ? response.linedata : [],
      });
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Error loading batch";
      setError(message);
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHeader = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!batch?.rec || !batchId) return;
    const form = e.currentTarget;
    const payload = {
      BATCH_ID: batchId,
      INSTITUTION_ID: (form.querySelector('[name="INSTITUTION_ID"]') as HTMLInputElement)?.value ?? "",
      STUDENT_FULL_NAME: (form.querySelector('[name="STUDENT_FULL_NAME"]') as HTMLInputElement)?.value ?? "",
      STUDENT_FIRST_NAME: (form.querySelector('[name="STUDENT_FIRST_NAME"]') as HTMLInputElement)?.value ?? "",
      STUDENT_MIDDLE_NAME: (form.querySelector('[name="STUDENT_MIDDLE_NAME"]') as HTMLInputElement)?.value ?? "",
      STUDENT_LAST_NAME: (form.querySelector('[name="STUDENT_LAST_NAME"]') as HTMLInputElement)?.value ?? "",
      EXTERNAL_INSTITUTION_ZIPCODE: (form.querySelector('[name="EXTERNAL_INSTITUTION_ZIPCODE"]') as HTMLInputElement)?.value ?? "",
      DATE_OF_BIRTH: (form.querySelector('[name="DATE_OF_BIRTH"]') as HTMLInputElement)?.value ?? "",
      SSN: (form.querySelector('[name="SSN"]') as HTMLInputElement)?.value ?? "",
      TOTAL_CREDITS_EARNED: (form.querySelector('[name="TOTAL_CREDITS_EARNED"]') as HTMLInputElement)?.value ?? "",
      Dual_Credit_Flag: (form.querySelector('[name="Dual_Credit_Flag"]') as HTMLInputElement)?.value ?? "",
      INTERNATIONAL_FLAG: (form.querySelector('[name="INTERNATIONAL_FLAG"]') as HTMLInputElement)?.value ?? "",
      AP_CREDITS_YN: (form.querySelector('[name="AP_CREDITS_YN"]') as HTMLInputElement)?.value ?? "",
      CLEP_CREDITS_YN: (form.querySelector('[name="CLEP_CREDITS_YN"]') as HTMLInputElement)?.value ?? "",
      ENDORSEMENT_FLAG: (form.querySelector('[name="ENDORSEMENT_FLAG"]') as HTMLInputElement)?.value ?? "",
      WEIGHTED_GPA_SCALE: (form.querySelector('[name="WEIGHTED_GPA_SCALE"]') as HTMLInputElement)?.value ?? "",
      WEIGHTED_GPA: (form.querySelector('[name="WEIGHTED_GPA"]') as HTMLInputElement)?.value ?? "",
      UNWEIGHTED_GPA_SCALE: (form.querySelector('[name="UNWEIGHTED_GPA_SCALE"]') as HTMLInputElement)?.value ?? "",
      UNWEIGHTED_GPA: (form.querySelector('[name="UNWEIGHTED_GPA"]') as HTMLInputElement)?.value ?? "",
      CGPA_SCALE: (form.querySelector('[name="CGPA_SCALE"]') as HTMLInputElement)?.value ?? "",
      CGPA: (form.querySelector('[name="CGPA"]') as HTMLInputElement)?.value ?? "",
      WEIGHTED_CLASS_RANK: (form.querySelector('[name="WEIGHTED_CLASS_RANK"]') as HTMLInputElement)?.value ?? "",
      WEIGHTED_CLASS_SIZE: (form.querySelector('[name="WEIGHTED_CLASS_SIZE"]') as HTMLInputElement)?.value ?? "",
      UNWEIGHTED_CLASS_RANK: (form.querySelector('[name="UNWEIGHTED_CLASS_RANK"]') as HTMLInputElement)?.value ?? "",
      UNWEIGHTED_CLASS_SIZE: (form.querySelector('[name="UNWEIGHTED_CLASS_SIZE"]') as HTMLInputElement)?.value ?? "",
    };
    try {
      await api.post(API_ENDPOINTS.OCR_COLLEGE_HDR_UPDATE_BATCH_HDR, payload);
      setSaveMessage("Header updated successfully.");
      setTimeout(() => setSaveMessage(null), 3000);
      fetchBatch();
    } catch {
      setSaveMessage("Failed to update header.");
    }
  };

  const handleDeleteLine = async (autoSeqno: number) => {
    if (!batchId || !window.confirm("Delete this line?")) return;
    try {
      await api.post(API_ENDPOINTS.OCR_COLLEGE_HDR_DELETE_LINE, {
        BATCH_ID: batchId,
        AUTO_SEQNO: String(autoSeqno),
      });
      setSaveMessage("Line deleted.");
      setTimeout(() => setSaveMessage(null), 2000);
      fetchBatch();
    } catch {
      setSaveMessage("Failed to delete line.");
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <PageMeta title="College HDR Batch | OCR" description="College HDR batch view" />
        <PageBreadcrumb pageTitle="College HDR Batch" />
        <PageContainer>
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading batch...</span>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  if (error || !batch?.rec) {
    return (
      <PageWrapper>
        <PageMeta title="College HDR Batch | OCR" description="College HDR batch view" />
        <PageBreadcrumb pageTitle="College HDR Batch" />
        <PageContainer>
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-6 text-center">
            <p className="text-red-700 dark:text-red-300">{error || "Batch not found or access denied."}</p>
            <Link to="/ocrverify/collegehdrdata" className="mt-4 inline-block text-brand-600 hover:underline">
              Back to College Header Data
            </Link>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  const rec = batch.rec as Record<string, string | number | null | undefined>;
  const linedata = batch.linedata as Record<string, string | number | null | undefined>[];

  return (
    <PageWrapper>
      <PageMeta title={`College HDR Batch: ${batchId} | OCR`} description="College HDR batch view" />
      <PageBreadcrumb pageTitle={`College HDR Batch: ${batchId}`} />

      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/ocrverify/collegehdrdata" className="text-brand-600 hover:underline">
            ← College Header Data
          </Link>
          {batch.prev_batch_id && (
            <Link
              to={`/ocrverify/collegehdrbatch?batch_id=${encodeURIComponent(batch.prev_batch_id)}&verify=${verify}`}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              ← Prev
            </Link>
          )}
          <span className="font-medium text-gray-700 dark:text-gray-300">Batch: {batchId}</span>
          {batch.next_batch_id && (
            <Link
              to={`/ocrverify/collegehdrbatch?batch_id=${encodeURIComponent(batch.next_batch_id)}&verify=${verify}`}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Next →
            </Link>
          )}
        </div>

        {saveMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            {saveMessage}
          </div>
        )}

        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold dark:border-gray-700 dark:text-white">
              Header Data
            </h2>
            <form onSubmit={handleSaveHeader} className="p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Student Full Name</label>
                  <input name="STUDENT_FULL_NAME" defaultValue={rec.STUDENT_FULL_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">First Name</label>
                  <input name="STUDENT_FIRST_NAME" defaultValue={rec.STUDENT_FIRST_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Middle Name</label>
                  <input name="STUDENT_MIDDLE_NAME" defaultValue={rec.STUDENT_MIDDLE_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Last Name</label>
                  <input name="STUDENT_LAST_NAME" defaultValue={rec.STUDENT_LAST_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Institution ID</label>
                  <input name="INSTITUTION_ID" defaultValue={rec.INSTITUTION_ID ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Date of Birth</label>
                  <input name="DATE_OF_BIRTH" defaultValue={rec.DATE_OF_BIRTH ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">SSN</label>
                  <input name="SSN" defaultValue={rec.SSN ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Total Credits Earned</label>
                  <input name="TOTAL_CREDITS_EARNED" defaultValue={rec.TOTAL_CREDITS_EARNED ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">CGPA</label>
                  <input name="CGPA" defaultValue={rec.CGPA ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">CGPA Scale</label>
                  <input name="CGPA_SCALE" defaultValue={rec.CGPA_SCALE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="mt-4">
                <Button type="submit" variant="primary">Save Header</Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold dark:border-gray-700 dark:text-white">
              Line Data
            </h2>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="p-2 text-left">AUTO_SEQNO</th>
                    <th className="p-2 text-left">SUBJECT</th>
                    <th className="p-2 text-left">COURSE_ID</th>
                    <th className="p-2 text-left">COURSE_TITLE</th>
                    <th className="p-2 text-left">START_TERM</th>
                    <th className="p-2 text-left">END_TERM</th>
                    <th className="p-2 text-left">CREDIT_HOURS_EARNED</th>
                    <th className="p-2 text-left">GRADE</th>
                    <th className="p-2 text-left">PAGE_NBR</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {linedata.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-gray-500">No line data.</td>
                    </tr>
                  ) : (
                    linedata.map((line) => (
                      <tr key={String(line.AUTO_SEQNO)} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2">{line.AUTO_SEQNO ?? ""}</td>
                        <td className="p-2">{line.SUBJECT ?? ""}</td>
                        <td className="p-2">{line.COURSE_ID ?? ""}</td>
                        <td className="p-2">{line.COURSE_TITLE ?? ""}</td>
                        <td className="p-2">{line.START_TERM ?? ""}</td>
                        <td className="p-2">{line.END_TERM ?? ""}</td>
                        <td className="p-2">{line.CREDIT_HOURS_EARNED ?? ""}</td>
                        <td className="p-2">{line.GRADE ?? ""}</td>
                        <td className="p-2">{line.PAGE_NBR ?? ""}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(Number(line.AUTO_SEQNO))}
                            className="text-red-600 hover:underline dark:text-red-400"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </PageContainer>
    </PageWrapper>
  );
}
