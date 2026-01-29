import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { API_BASE_URL, api, API_ENDPOINTS } from "../../config/api";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import Button from "../../components/ui/button/Button";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select Status" },
  { value: "VERIFIED", label: "Verified" },
  { value: "TOBEVERIFIED", label: "To Be Verified" },
  { value: "RECONFIRM", label: "Reconfirm" },
  { value: "To Be Reviewed By OSU-OKM", label: "To Be Reviewed By OSU-OKM" },
];

const TRANSCRIPT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select Transcript Type" },
  { value: "College", label: "College" },
  { value: "High School", label: "High School" },
];

type LineRow = {
  AUTO_SEQNO?: number;
  EXTERNAL_INSTITUTION_NAME?: string;
  SUBJECT?: string;
  COURSE_ID?: string;
  COURSE_TITLE?: string;
  START_TERM?: string;
  END_TERM?: string;
  CREDIT_HOURS_EARNED?: string;
  GRADE?: string;
  BOT_Verification?: string;
  BOT_OCR_VERIFICATION?: string;
  PAGE_NBR?: string;
};

type TabType = "left" | "right" | "middle";

export default function CollegeOCRBatch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const batchId = searchParams.get("batch_id") || "";
  const verify = searchParams.get("verify") || "no";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<{
    batch_id: string;
    hdr_data: Record<string, unknown> | null;
    left_data: LineRow[];
    right_data: LineRow[];
    middle_data: LineRow[];
    error_msg: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("left");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [botModalContent, setBotModalContent] = useState("");
  const [resolutionModalContent, setResolutionModalContent] = useState("");
  const [addRowsModalOpen, setAddRowsModalOpen] = useState(false);
  const [newRows, setNewRows] = useState<LineRow[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);

  useEffect(() => {
    if (batchId) fetchBatch();
    else setBatch(null);
  }, [batchId]);

  const fetchBatch = async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      setError(null);
      const url = `${API_ENDPOINTS.OCR_COLLEGE_OCR_BATCH}?batch_id=${encodeURIComponent(batchId)}`;
      const response = await api.get(url);
      setBatch({
        batch_id: response.batch_id ?? batchId,
        hdr_data: response.hdr_data ?? null,
        left_data: Array.isArray(response.left_data) ? response.left_data : [],
        right_data: Array.isArray(response.right_data) ? response.right_data : [],
        middle_data: Array.isArray(response.middle_data) ? response.middle_data : [],
        error_msg: response.error_msg === true,
      });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Error loading batch";
      setError(msg);
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchInput.trim();
    if (id) setSearchParams({ batch_id: id, verify });
  };

  const handleStatusChange = async (value: string, traType: string) => {
    if (!value || !batchId) return;
    if (!window.confirm("Do you want to change the status?")) return;
    try {
      const res = await api.post(API_ENDPOINTS.OCR_CHANGE_ADDITIONAL_STATUS, {
        status: value,
        batch_id: batchId,
        traType,
      });
      if (res === "Success") {
        showMessage("success", "Status changed successfully");
        fetchBatch();
      } else showMessage("error", "Error changing status");
    } catch {
      showMessage("error", "Error changing status");
    }
  };

  const getFormVal = (form: HTMLFormElement, name: string) =>
    (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value ?? "";

  const handleSaveHeader = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!batchId) return;
    const form = e.currentTarget;
    const extInst = getFormVal(form, "EXTERNAL_INSTITUTION_NAME").trim();
    const studentName = getFormVal(form, "STUDENT_FULL_NAME").trim();
    const totalCredits = getFormVal(form, "TOTAL_CREDITS_EARNED").trim();
    const dob = getFormVal(form, "DATE_OF_BIRTH").trim();
    const cgpa = getFormVal(form, "CGPA").trim();
    if (!extInst) {
      showMessage("error", "External Institution Name is required.");
      return;
    }
    if (!studentName) {
      showMessage("error", "Student Full Name is required.");
      return;
    }
    if (!totalCredits) {
      showMessage("error", "Total Credits Earned is required.");
      return;
    }
    if (!dob) {
      showMessage("error", "Date of Birth is required.");
      return;
    }
    if (!cgpa) {
      showMessage("error", "CGPA is required.");
      return;
    }
    const degreeDate = getFormVal(form, "DEGREE_RECEIVED_DATE").trim();
    if (!degreeDate || degreeDate.toUpperCase() === "NULL") {
      if (!window.confirm("Degree Received Date is empty. Are you sure you want to submit?")) return;
    }
    const payload: Record<string, string> = {
      BATCH_ID: batchId,
      FILE_NAME: getFormVal(form, "FILE_NAME"),
      EXTERNAL_INSTITUTION_NAME: extInst,
      STUDENT_FULL_NAME: studentName,
      EXTERNAL_INSTITUTION_ZIPCODE: getFormVal(form, "EXTERNAL_INSTITUTION_ZIPCODE"),
      DATE_OF_BIRTH: dob,
      SSN: getFormVal(form, "SSN"),
      CEEB_CODE: getFormVal(form, "CEEB_CODE"),
      DEGREE: getFormVal(form, "DEGREE"),
      DEGREE_RECEIVED_DATE: degreeDate || getFormVal(form, "DEGREE_RECEIVED_DATE"),
      SECOND_DEGREE_NAME: getFormVal(form, "SECOND_DEGREE_NAME"),
      SECOND_DEGREE_RECEIVED_DATE: getFormVal(form, "SECOND_DEGREE_RECEIVED_DATE"),
      TOTAL_CREDITS_EARNED: totalCredits,
      TOTAL_CREDITS_ATTENDED: getFormVal(form, "TOTAL_CREDITS_ATTENDED"),
      CGPA: cgpa,
      CLEP_CREDITS_YN: getFormVal(form, "CLEP_CREDITS_YN"),
      AP_CREDITS_YN: getFormVal(form, "AP_CREDITS_YN"),
      INTERNATIONAL_FLAG: getFormVal(form, "INTERNATIONAL_FLAG"),
    };
    try {
      await api.post(API_ENDPOINTS.OCR_UPDATE_BATCH_DATA_HDR, payload);
      showMessage("success", "Header updated successfully");
      fetchBatch();
    } catch {
      showMessage("error", "Failed to update header");
    }
  };

  const getLineData = (): LineRow[] => {
    if (!batch) return [];
    if (activeTab === "left") return batch.left_data;
    if (activeTab === "right") return batch.right_data;
    return batch.middle_data;
  };

  const handleSaveLine = async (
    type: TabType,
    row: LineRow,
    getValues: () => Record<string, string>
  ) => {
    if (!batchId) return;
    const v = getValues();
    try {
      const res = await api.post(API_ENDPOINTS.OCR_UPDATE_BATCH_DATA_LINE, {
        BATCH_ID: batchId,
        AUTO_SEQNO: row.AUTO_SEQNO ?? "",
        SUBJECT: v.SUBJECT ?? "",
        COURSE_ID: v.COURSE_ID ?? "",
        COURSE_TITLE: v.COURSE_TITLE ?? "",
        START_TERM: v.START_TERM ?? "",
        END_TERM: v.END_TERM ?? "",
        EXTERNAL_INSTITUTION_NAME: v.EXTERNAL_INSTITUTION_NAME ?? "",
        CREDIT_HOURS_EARNED: v.CREDIT_HOURS_EARNED ?? "",
        GRADE: v.GRADE ?? "",
        PAGE_NBR: v.PAGE_NBR ?? "",
        Type: type,
      });
      showMessage("success", "Line saved");
      if (row.AUTO_SEQNO == null) setNewRows([]);
      fetchBatch();
    } catch {
      showMessage("error", "Failed to save line");
    }
  };

  const handleDeleteLine = async (type: TabType, autoSeqno: number) => {
    if (!batchId || !window.confirm("Delete this line?")) return;
    try {
      await api.post(API_ENDPOINTS.OCR_DELETE_LINE_DATA, {
        BATCH_ID: batchId,
        AUTO_SEQNO: autoSeqno,
        Type: type,
      });
      showMessage("success", "Line deleted");
      fetchBatch();
    } catch {
      showMessage("error", "Failed to delete line");
    }
  };

  const handleBulkDelete = async () => {
    if (!batchId || selectedLineIds.size === 0) {
      showMessage("error", "Please select at least one row to delete.");
      return;
    }
    if (!window.confirm(`Delete ${selectedLineIds.size} selected row(s)?`)) return;
    try {
      await api.post(API_ENDPOINTS.OCR_DELETE_SEQUENCE, {
        sequencerow_ids: Array.from(selectedLineIds),
        table: activeTab,
      });
      showMessage("success", "Selected rows deleted.");
      setSelectedLineIds(new Set());
      fetchBatch();
    } catch {
      showMessage("error", "Failed to delete rows.");
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!batchId) return;
    const form = e.currentTarget;
    const autoSeqEls = form.querySelectorAll('input[name="AUTO_SEQNO[]"]');
    const subjEls = form.querySelectorAll('input[name="SUBJECT[]"]');
    const autoSeqNos = Array.from(autoSeqEls).map((el) => (el as HTMLInputElement).value);
    const subjects = Array.from(subjEls).map((el) => (el as HTMLInputElement).value);
    const courseIds = Array.from(form.querySelectorAll('input[name="COURSE_ID[]"]')).map((el) => (el as HTMLInputElement).value);
    const courseTitles = Array.from(form.querySelectorAll('input[name="COURSE_TITLE[]"]')).map((el) => (el as HTMLInputElement).value);
    const startTerms = Array.from(form.querySelectorAll('input[name="START_TERM[]"]')).map((el) => (el as HTMLInputElement).value);
    const endTerms = Array.from(form.querySelectorAll('input[name="END_TERM[]"]')).map((el) => (el as HTMLInputElement).value);
    const creditHours = Array.from(form.querySelectorAll('input[name="CREDIT_HOURS_EARNED[]"]')).map((el) => (el as HTMLInputElement).value);
    const grades = Array.from(form.querySelectorAll('input[name="GRADE[]"]')).map((el) => (el as HTMLInputElement).value);
    const pageNbrs = Array.from(form.querySelectorAll('input[name="PAGE_NBR[]"]')).map((el) => (el as HTMLInputElement).value);
    try {
      const res = await api.post(API_ENDPOINTS.OCR_MULTIPLE_UPDATE, {
        BATCH_ID: batchId,
        table: activeTab,
        AUTO_SEQNO: autoSeqNos,
        SUBJECT: subjects,
        COURSE_ID: courseIds,
        COURSE_TITLE: courseTitles,
        START_TERM: startTerms,
        END_TERM: endTerms,
        CREDIT_HOURS_EARNED: creditHours,
        GRADE: grades,
        PAGE_NBR: pageNbrs,
      });
      if (res?.code === 1) {
        showMessage("success", res.message ?? "Rows updated.");
        setBulkEditMode(false);
        fetchBatch();
      } else {
        showMessage("error", res?.message ?? "Update failed.");
      }
    } catch {
      showMessage("error", "Failed to update rows.");
    }
  };

  const toggleSelectAll = () => {
    const data = getLineData().filter((r) => r.AUTO_SEQNO != null) as { AUTO_SEQNO: number }[];
    const ids = data.map((r) => r.AUTO_SEQNO);
    if (selectedLineIds.size >= ids.length) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(ids));
    }
  };

  const handleAddRow = () => {
    setNewRows((prev) => [...prev, {}]);
  };

  const handleAddRowsFromModal = async (numRows: number, values: Record<string, string>) => {
    if (!batchId || numRows < 1 || numRows > 20) return;
    try {
      for (let i = 0; i < numRows; i++) {
        await api.post(API_ENDPOINTS.OCR_UPDATE_BATCH_DATA_LINE, {
          BATCH_ID: batchId,
          AUTO_SEQNO: "",
          SUBJECT: values.SUBJECT ?? "",
          COURSE_ID: values.COURSE_ID ?? "",
          COURSE_TITLE: values.COURSE_TITLE ?? "",
          START_TERM: values.START_TERM ?? "",
          END_TERM: values.END_TERM ?? "",
          EXTERNAL_INSTITUTION_NAME: values.EXTERNAL_INSTITUTION_NAME ?? "",
          CREDIT_HOURS_EARNED: values.CREDIT_HOURS_EARNED ?? "",
          GRADE: values.GRADE ?? "",
          PAGE_NBR: values.PAGE_NBR ?? "",
          Type: activeTab,
        });
      }
      showMessage("success", `${numRows} row(s) added`);
      setAddRowsModalOpen(false);
      fetchBatch();
    } catch {
      showMessage("error", "Failed to add rows");
    }
  };

  const displayLineData = (): LineRow[] => {
    const data = getLineData();
    return [...data, ...newRows];
  };

  const parseResolution = (resolution: string | undefined) => {
    if (!resolution) return { high: false, low: false, text: "" };
    const xMatch = resolution.match(/XResolution\s*=\s*(\d+)/);
    const yMatch = resolution.match(/YResolution\s*=\s*(\d+)/);
    const x = xMatch ? parseInt(xMatch[1], 10) : 0;
    const y = yMatch ? parseInt(yMatch[1], 10) : 0;
    const high = x >= 300 || y >= 300;
    const low = x <= 299 || y <= 299;
    return { high, low, text: resolution };
  };

  if (loading) {
    return (
      <PageWrapper>
        <PageMeta title="College OCR Batch | OCR" description="College OCR batch" />
        <PageBreadcrumb pageTitle="College OCR Batch" />
        <PageContainer>
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading batch...</span>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  if (!batchId) {
    return (
      <PageWrapper>
        <PageMeta title="College OCR Batch | OCR" description="College OCR batch" />
        <PageBreadcrumb pageTitle="College OCR Batch" />
        <PageContainer>
          <div className="mb-4">
            <Link to="/ocrverify/collegeassignedbatches" className="text-brand-600 hover:underline">
              ← College Assigned Batches
            </Link>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Search Batch ID</h3>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Batch ID"
                className="rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white flex-1"
              />
              <Button type="submit">Search</Button>
            </form>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  if (error || !batch || batch.error_msg || !batch.hdr_data) {
    return (
      <PageWrapper>
        <PageMeta title="College OCR Batch | OCR" description="College OCR batch" />
        <PageBreadcrumb pageTitle="College OCR Batch" />
        <PageContainer>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:bg-red-900/20 dark:border-red-800 text-center">
            <p className="text-red-700 dark:text-red-300">
              {error || `Batch ID ${batchId} not found`}
            </p>
            <form onSubmit={handleSearch} className="mt-4 flex justify-center gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Batch ID"
                className="rounded border border-gray-300 px-3 py-2 w-48 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <Button type="submit">Search</Button>
            </form>
            <Link to="/ocrverify/collegeassignedbatches" className="mt-4 inline-block text-brand-600 hover:underline">
              Back to College Assigned Batches
            </Link>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  const hdr = batch.hdr_data as Record<string, string | undefined>;
  const transcriptUrl = hdr.TRANSCRIPT_URL
    ? (hdr.TRANSCRIPT_URL.startsWith("http") ? hdr.TRANSCRIPT_URL : `${API_BASE_URL.replace(/\/api\/?$/, "")}${hdr.TRANSCRIPT_URL}`)
    : "";
  const resolution = parseResolution(hdr.RESOLUTION);
  const botMessage = hdr.BOT_OCR_VERIFICATION || "";

  return (
    <PageWrapper>
      <PageMeta title={`College OCR Batch: ${batchId} | OCR`} description="College OCR batch" />
      <PageBreadcrumb pageTitle={`College OCR Batch: ${batchId}`} />

      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/ocrverify/collegeassignedbatches" className="text-brand-600 hover:underline">
            ← College Assigned Batches
          </Link>
          <span className="font-medium text-gray-700 dark:text-gray-300">Batch: {batchId}</span>
          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Batch ID"
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white w-40"
            />
            <Button type="submit" variant="outline" className="!py-1">Search</Button>
          </form>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-2 ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Status & Transcript Type */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Status</label>
            <select
              value={hdr.STATUS_FLAG ?? ""}
              onChange={(e) => handleStatusChange(e.target.value, "NO")}
              className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "empty"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Transcript Type</label>
            <select
              value={hdr.TRANSCRIPT_TYPE ?? ""}
              onChange={(e) => handleStatusChange(e.target.value, "YES")}
              className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              {TRANSCRIPT_TYPE_OPTIONS.map((o) => (
                <option key={o.value || "empty"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Header Data + View Transcript + Resolution + BOT */}
        <div className="mb-6 flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold dark:border-gray-700 dark:text-white">
                Header Data
              </h2>
              <form onSubmit={handleSaveHeader} className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">File Name</label>
                    <input name="FILE_NAME" readOnly defaultValue={hdr.FILE_PATH ?? hdr.FILE_NAME ?? ""} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">External Institution Name *</label>
                    <input name="EXTERNAL_INSTITUTION_NAME" defaultValue={hdr.EXTERNAL_INSTITUTION_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Student Full Name *</label>
                    <input name="STUDENT_FULL_NAME" defaultValue={hdr.STUDENT_FULL_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">College Zipcode</label>
                    <input name="EXTERNAL_INSTITUTION_ZIPCODE" defaultValue={hdr.EXTERNAL_INSTITUTION_ZIPCODE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">DOB *</label>
                    <input name="DATE_OF_BIRTH" defaultValue={hdr.DATE_OF_BIRTH ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">SSN</label>
                    <input name="SSN" defaultValue={hdr.SSN ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Degree</label>
                    <input name="DEGREE" defaultValue={hdr.DEGREE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Degree Received Date</label>
                    <input name="DEGREE_RECEIVED_DATE" defaultValue={hdr.DEGREE_RECEIVED_DATE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Second Degree</label>
                    <input name="SECOND_DEGREE_NAME" defaultValue={hdr.SECOND_DEGREE_NAME ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Second Degree Received Date</label>
                    <input name="SECOND_DEGREE_RECEIVED_DATE" defaultValue={hdr.SECOND_DEGREE_RECEIVED_DATE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Total Credits Earned *</label>
                    <input name="TOTAL_CREDITS_EARNED" defaultValue={hdr.TOTAL_CREDITS_EARNED ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Total Credits Attended *</label>
                    <input name="TOTAL_CREDITS_ATTENDED" defaultValue={hdr.TOTAL_CREDITS_ATTENDED ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">CGPA *</label>
                    <input name="CGPA" defaultValue={hdr.CGPA ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">CEEB Code</label>
                    <input name="CEEB_CODE" defaultValue={hdr.CEEB_CODE ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">CLEP Credits</label>
                    <select name="CLEP_CREDITS_YN" defaultValue={hdr.CLEP_CREDITS_YN ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                      <option value="">—</option>
                      <option value="N">NO</option>
                      <option value="Y">YES</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">AP Credits</label>
                    <select name="AP_CREDITS_YN" defaultValue={hdr.AP_CREDITS_YN ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                      <option value="">—</option>
                      <option value="N">NO</option>
                      <option value="Y">YES</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">International Flag</label>
                    <select name="INTERNATIONAL_FLAG" defaultValue={hdr.INTERNATIONAL_FLAG ?? ""} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                      <option value="">—</option>
                      <option value="N">NO</option>
                      <option value="Y">YES</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <Button type="submit" variant="primary">Save Header</Button>
                </div>
              </form>
            </section>
          </div>
          <div className="flex flex-col gap-2">
            {resolution.high && (
              <button
                type="button"
                onClick={() => setResolutionModalContent(resolution.text)}
                className="rounded px-3 py-2 bg-green-600 text-white text-sm hover:bg-green-700"
              >
                High Resolution
              </button>
            )}
            {resolution.low && !resolution.high && (
              <button
                type="button"
                onClick={() => setResolutionModalContent(resolution.text)}
                className="rounded px-3 py-2 bg-red-600 text-white text-sm hover:bg-red-700"
              >
                Low Resolution
              </button>
            )}
            {transcriptUrl && (
              <a
                href={transcriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-3 py-2 bg-brand-600 text-white text-sm hover:bg-brand-700 text-center"
              >
                View Transcript
              </a>
            )}
            {botMessage && (
              <button
                type="button"
                onClick={() => setBotModalContent(botMessage)}
                className="rounded px-3 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 text-left"
              >
                {botMessage.length > 50 ? `${botMessage.slice(0, 50)}... View More` : "BOT OCR Verification"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs: Left | Right | Middle */}
        <div className="mb-2 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {(["left", "right", "middle"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize font-medium ${
                activeTab === tab
                  ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {tab} Data
            </button>
          ))}
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          {!bulkEditMode ? (
            <>
              <Button type="button" variant="outline" onClick={handleAddRow} className="!py-1.5">
                Add Row
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddRowsModalOpen(true)} className="!py-1.5">
                Add Rows
              </Button>
              <Button type="button" variant="outline" onClick={() => setBulkEditMode(true)} className="!py-1.5">
                Enable All
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBulkDelete}
                className="!py-1.5 text-red-600 hover:text-red-700"
              >
                Delete ({selectedLineIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => { setBulkEditMode(false); fetchBatch(); }} className="!py-1.5">
                Cancel
              </Button>
              <Button type="submit" form="line_bulk_form" variant="primary" className="!py-1.5">
                Update All
              </Button>
            </>
          )}
        </div>

        <form id="line_bulk_form" onSubmit={handleBulkUpdate} className={bulkEditMode ? "" : "contents"}>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                  {!bulkEditMode && (
                    <th className="p-2 text-left">
                      <input
                        type="checkbox"
                        checked={displayLineData().filter((r) => r.AUTO_SEQNO != null).length > 0 && selectedLineIds.size >= displayLineData().filter((r) => r.AUTO_SEQNO != null).length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="p-2 text-left">AUTO_SEQNO</th>
                  <th className="p-2 text-left">Bot OCR Verification</th>
                  <th className="p-2 text-left">EXTERNAL_INSTITUTION_NAME</th>
                  <th className="p-2 text-left">SUBJECT</th>
                  <th className="p-2 text-left">COURSE_ID</th>
                  <th className="p-2 text-left">COURSE_TITLE</th>
                  <th className="p-2 text-left">START_TERM</th>
                  <th className="p-2 text-left">END_TERM</th>
                  <th className="p-2 text-left">CREDIT_HOURS_EARNED</th>
                  <th className="p-2 text-left">GRADE</th>
                  <th className="p-2 text-left">PAGE_NBR</th>
                  {!bulkEditMode && <th className="p-2 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayLineData().length === 0 ? (
                  <tr>
                    <td colSpan={bulkEditMode ? 11 : 12} className="p-4 text-center text-gray-500">No line data.</td>
                  </tr>
                ) : (
                  displayLineData().map((line, idx) => (
                    <LineRowEditor
                      key={`${activeTab}-${line.AUTO_SEQNO ?? `new-${idx}`}`}
                      type={activeTab}
                      line={line}
                      bulkEditMode={bulkEditMode}
                      selected={line.AUTO_SEQNO != null && selectedLineIds.has(line.AUTO_SEQNO)}
                      onToggleSelect={() => {
                        if (line.AUTO_SEQNO == null) return;
                        setSelectedLineIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(line.AUTO_SEQNO!)) next.delete(line.AUTO_SEQNO!);
                          else next.add(line.AUTO_SEQNO!);
                          return next;
                        });
                      }}
                      onSave={handleSaveLine}
                      onDelete={handleDeleteLine}
                      onBotViewMore={setBotModalContent}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </form>

        {/* Add Rows Modal */}
        {addRowsModalOpen && (
          <AddRowsModal
            activeTab={activeTab}
            onClose={() => setAddRowsModalOpen(false)}
            onApply={handleAddRowsFromModal}
          />
        )}

        {/* Modals */}
        {botModalContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBotModalContent("")}>
            <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold dark:text-white mb-2">Bot OCR Verification</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{botModalContent}</p>
              <Button className="mt-4" onClick={() => setBotModalContent("")}>Close</Button>
            </div>
          </div>
        )}
        {resolutionModalContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResolutionModalContent("")}>
            <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold dark:text-white mb-2">Resolution Details</h3>
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-64">{resolutionModalContent}</pre>
              <Button className="mt-4" onClick={() => setResolutionModalContent("")}>Close</Button>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}

function AddRowsModal({
  activeTab,
  onClose,
  onApply,
}: {
  activeTab: TabType;
  onClose: () => void;
  onApply: (numRows: number, values: Record<string, string>) => void;
}) {
  const [numRows, setNumRows] = useState(1);
  const [subject, setSubject] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [startTerm, setStartTerm] = useState("");
  const [endTerm, setEndTerm] = useState("");
  const [extInst, setExtInst] = useState("");
  const [creditHours, setCreditHours] = useState("");
  const [grade, setGrade] = useState("");
  const [pageNbr, setPageNbr] = useState("1");

  const handleApply = () => {
    const n = Math.min(20, Math.max(1, numRows));
    onApply(n, {
      SUBJECT: subject,
      COURSE_ID: courseId,
      COURSE_TITLE: courseTitle,
      START_TERM: startTerm,
      END_TERM: endTerm,
      EXTERNAL_INSTITUTION_NAME: extInst,
      CREDIT_HOURS_EARNED: creditHours,
      GRADE: grade,
      PAGE_NBR: pageNbr,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold dark:text-white mb-4">Add Multiple Rows ({activeTab})</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Number of rows (1–20)</label>
            <input type="number" min={1} max={20} value={numRows} onChange={(e) => setNumRows(parseInt(e.target.value, 10) || 1)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Subject" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Course ID</label>
            <input value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Course ID" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Course Title</label>
            <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Course Title" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Start Term</label>
            <input value={startTerm} onChange={(e) => setStartTerm(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Start Term" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">End Term</label>
            <input value={endTerm} onChange={(e) => setEndTerm(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="End Term" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Institution Name</label>
            <input value={extInst} onChange={(e) => setExtInst(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Institution Name" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Credit Hours Earned</label>
            <input value={creditHours} onChange={(e) => setCreditHours(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Credit Hours" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Grade</label>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Grade" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Page Number</label>
            <input value={pageNbr} onChange={(e) => setPageNbr(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Page Nbr" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleApply}>Add Rows</Button>
        </div>
      </div>
    </div>
  );
}

function LineRowEditor({
  type,
  line,
  bulkEditMode,
  selected,
  onToggleSelect,
  onSave,
  onDelete,
  onBotViewMore,
}: {
  type: TabType;
  line: LineRow;
  bulkEditMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onSave: (tab: TabType, row: LineRow, getValues: () => Record<string, string>) => void;
  onDelete: (tab: TabType, autoSeqno: number) => void;
  onBotViewMore: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const id = line.AUTO_SEQNO ?? "new";
  const botVer = (line.BOT_Verification ?? "").toUpperCase();
  const rowClass = botVer === "TOBEVERIFIED" ? "bg-amber-50 dark:bg-amber-900/20" : botVer === "VERIFIED" ? "bg-green-50 dark:bg-green-900/20" : "";

  const getValues = (): Record<string, string> => {
    return {
      SUBJECT: (document.getElementById(`SUBJECT_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      COURSE_ID: (document.getElementById(`COURSE_ID_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      COURSE_TITLE: (document.getElementById(`COURSE_TITLE_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      START_TERM: (document.getElementById(`START_TERM_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      END_TERM: (document.getElementById(`END_TERM_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      EXTERNAL_INSTITUTION_NAME: (document.getElementById(`EXT_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      CREDIT_HOURS_EARNED: (document.getElementById(`CREDIT_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      GRADE: (document.getElementById(`GRADE_${type}_${id}`) as HTMLInputElement)?.value ?? "",
      PAGE_NBR: (document.getElementById(`PAGE_${type}_${id}`) as HTMLInputElement)?.value ?? "",
    };
  };

  const botText = line.BOT_OCR_VERIFICATION ?? "";
  const botShort = botText.length > 30 ? `${botText.slice(0, 30)}... ` : botText;

  if (bulkEditMode) {
    return (
      <tr className={`border-b border-gray-100 dark:border-gray-700 ${rowClass}`}>
        <td className="p-2">
          <input type="hidden" name="AUTO_SEQNO[]" value={line.AUTO_SEQNO ?? ""} readOnly />
          {line.AUTO_SEQNO ?? ""}
        </td>
        <td className="p-2">—</td>
        <td className="p-2">{line.EXTERNAL_INSTITUTION_NAME ?? ""}</td>
        <td className="p-2">
          <input name="SUBJECT[]" defaultValue={line.SUBJECT ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="COURSE_ID[]" defaultValue={line.COURSE_ID ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="COURSE_TITLE[]" defaultValue={line.COURSE_TITLE ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="START_TERM[]" defaultValue={line.START_TERM ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="END_TERM[]" defaultValue={line.END_TERM ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="CREDIT_HOURS_EARNED[]" defaultValue={line.CREDIT_HOURS_EARNED ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="GRADE[]" defaultValue={line.GRADE ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input name="PAGE_NBR[]" defaultValue={line.PAGE_NBR ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
      </tr>
    );
  }

  if (editing) {
    return (
      <tr className={`border-b border-gray-100 dark:border-gray-700 ${rowClass}`}>
        <td className="p-2">
          {line.AUTO_SEQNO != null && (
            <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-gray-300" />
          )}
        </td>
        <td className="p-2">{line.AUTO_SEQNO ?? ""}</td>
        <td className="p-2">—</td>
        <td className="p-2">
          <input id={`EXT_${type}_${id}`} defaultValue={line.EXTERNAL_INSTITUTION_NAME ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`SUBJECT_${type}_${id}`} defaultValue={line.SUBJECT ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`COURSE_ID_${type}_${id}`} defaultValue={line.COURSE_ID ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`COURSE_TITLE_${type}_${id}`} defaultValue={line.COURSE_TITLE ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`START_TERM_${type}_${id}`} defaultValue={line.START_TERM ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`END_TERM_${type}_${id}`} defaultValue={line.END_TERM ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`CREDIT_${type}_${id}`} defaultValue={line.CREDIT_HOURS_EARNED ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`GRADE_${type}_${id}`} defaultValue={line.GRADE ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <input id={`PAGE_${type}_${id}`} defaultValue={line.PAGE_NBR ?? ""} className="w-full rounded border px-1 py-0.5 text-sm dark:bg-gray-900 dark:text-white" />
        </td>
        <td className="p-2">
          <button type="button" onClick={() => { onSave(type, line, getValues); setEditing(false); }} className="text-green-600 hover:underline mr-2">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-gray-600 hover:underline">Cancel</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-gray-100 dark:border-gray-700 ${rowClass}`}>
      <td className="p-2">
        {line.AUTO_SEQNO != null && (
          <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-gray-300" />
        )}
      </td>
      <td className="p-2">{line.AUTO_SEQNO ?? ""}</td>
      <td className="p-2 text-left">
        {botShort}
        {botText.length > 30 && (
          <button type="button" onClick={() => onBotViewMore(botText)} className="text-brand-600 hover:underline ml-1">View More</button>
        )}
      </td>
      <td className="p-2">{line.EXTERNAL_INSTITUTION_NAME ?? ""}</td>
      <td className="p-2">{line.SUBJECT ?? ""}</td>
      <td className="p-2">{line.COURSE_ID ?? ""}</td>
      <td className="p-2">{line.COURSE_TITLE ?? ""}</td>
      <td className="p-2">{line.START_TERM ?? ""}</td>
      <td className="p-2">{line.END_TERM ?? ""}</td>
      <td className="p-2">{line.CREDIT_HOURS_EARNED ?? ""}</td>
      <td className="p-2">{line.GRADE ?? ""}</td>
      <td className="p-2">{line.PAGE_NBR ?? ""}</td>
      <td className="p-2">
        <button type="button" onClick={() => setEditing(true)} className="text-brand-600 hover:underline mr-2">Edit</button>
        {line.AUTO_SEQNO != null && (
          <button type="button" onClick={() => onDelete(type, line.AUTO_SEQNO!)} className="text-red-600 hover:underline">Delete</button>
        )}
      </td>
    </tr>
  );
}
