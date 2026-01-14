import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import TranscriptReports from "./transcriptreports/TranscriptReports";
import { API_BASE_URL } from "../../config/api";

/**
 * Student View page - Student to Transcripts Action Center
 * Shows student information and allows viewing transcript/articulation reports filtered by student
 * Based on CI3 Studentview controller and student_page view
 */
export default function StudentView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [studentId, setStudentId] = useState<string>(searchParams.get("student_id") || "");
  const [studentName, setStudentName] = useState<string>("");
  const [students, setStudents] = useState<Array<{STUDENT_ID: string, STUDENT_FULL_NAME: string}>>([]);

  // Fetch students list (simplified - can be enhanced with API endpoint later)
  useEffect(() => {
    // TODO: Implement API call to get students list
    // For now, this is a placeholder
  }, []);

  const handleStudentChange = (selectedStudentId: string) => {
    setStudentId(selectedStudentId);
    setSearchParams({ student_id: selectedStudentId });
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Student to Transcripts | College Module"
        description="Student to Transcripts Action Center"
      />
      <PageBreadcrumb pageTitle="Student to Transcripts" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl mb-4">
            Student to Transcripts Action Center
          </h3>
          
          {/* Student Selector */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Student
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              placeholder="Enter Student ID or Name"
              className="relative w-full max-w-md appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            />
          </div>

          {studentId && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Student ID:</strong> {studentId}
                {studentName && (
                  <>
                    <br />
                    <strong>Student Name:</strong> {studentName}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Transcript Reports - filtered by student_id if provided */}
        {studentId && (
          <TranscriptReports />
        )}

        {!studentId && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Please select a student to view their transcripts
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}

