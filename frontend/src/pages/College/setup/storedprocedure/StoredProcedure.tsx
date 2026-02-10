import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import Button from "../../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../../config/api";
import { BoltIcon } from "../../../../icons";
import { alertsuccess, alerterror } from "../../../../utils/toast";

export default function StoredProcedure() {
  const [batchId, setBatchId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const validateBatchId = async () => {
    if (!batchId.trim()) {
      alerterror("Batch ID is required");
      return;
    }

    setValidating(true);
    setStudentName("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/storedprocedure/getname`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ BATCH_ID: batchId }),
      });

      const data = await response.json();

      if (data.error === 0 && data.data) {
        setStudentName(data.data.STUDENT_FULL_NAME || "");
        alertsuccess(data.msg || "Valid Batch ID");
      } else {
        alerterror(data.msg || "Invalid Batch ID");
        setStudentName("");
      }
    } catch (error: any) {
      alerterror(error.message || "Error validating Batch ID");
      setStudentName("");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchId.trim()) {
      alerterror("Batch ID is required");
      return;
    }

    // Confirm before executing
    const confirmed = window.confirm(
      `Are you sure you want to reset Batch ID "${batchId}"${studentName ? ` for ${studentName}` : ""}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/storedprocedure/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ BATCH_ID: batchId }),
      });

      const data = await response.json();

      if (data.error === 0) {
        alertsuccess(data.msg || "Stored Procedure executed successfully!");
        // Clear form after successful execution
        setTimeout(() => {
          setBatchId("");
          setStudentName("");
        }, 2000);
      } else {
        alerterror(data.msg || "Error executing stored procedure");
      }
    } catch (error: any) {
      alerterror(error.message || "Error executing stored procedure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Reset Batch ID | College Module"
        description="Reset Batch ID using stored procedure"
      />
      <PageBreadcrumb pageTitle="Reset Batch ID" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl mb-4">
            Reset Batch ID
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Batch ID <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    setStudentName("");
                  }}
                  onBlur={validateBatchId}
                  placeholder="Enter Batch ID"
                  required
                  className="relative flex-1 appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
                <Button
                  type="button"
                  onClick={validateBatchId}
                  disabled={validating || !batchId.trim()}
                  variant="outline"
                >
                  {validating ? "Validating..." : "Validate"}
                </Button>
              </div>
              {studentName && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <strong>Student Name:</strong> {studentName}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading || !batchId.trim() || !studentName}
                startIcon={<BoltIcon className="w-5 h-5" />}
              >
                {loading ? "Running..." : "Run Stored Procedure"}
              </Button>
            </div>
          </form>

          <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-400">
              Warning
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This action will execute the stored procedure TRANSCRIPT_REPROCESS_AS_NEW, which will reset the Batch ID and reprocess the transcript as new. This action cannot be undone. Please verify the Batch ID before proceeding.
            </p>
          </div>
        </div>
      </PageContainer>
    </PageWrapper>
  );
}

