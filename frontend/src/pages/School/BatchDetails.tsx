import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { API_BASE_URL, api } from "../../config/api";
import PageContainer from "../../components/common/PageContainer";

export default function BatchDetails() {
  const { batchId } = useParams<{ batchId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [showMore, setShowMore] = useState(false);
  const [numShown, setNumShown] = useState(10);
  const [transcriptUrl, setTranscriptUrl] = useState<string>("");

  useEffect(() => {
    if (batchId) {
      fetchBatchDetails();
    }
  }, [batchId]);

  useEffect(() => {
    if (data?.rec?.TRANSCRIPT_URL) {
      const url = data.rec.TRANSCRIPT_URL;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        setTranscriptUrl(url);
      } else if (url.startsWith("/api/viewfile")) {
        setTranscriptUrl(`${API_BASE_URL.replace("/api", "")}${url}`);
      } else {
        setTranscriptUrl("");
      }
    } else {
      setTranscriptUrl("");
    }
  }, [data?.rec?.TRANSCRIPT_URL]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/batchdetails/${batchId}`);
      if (response.status === 1) {
        setData(response.data);
      } else {
        setError("Failed to load batch details");
      }
    } catch (err: any) {
      setError(err.message || "Error loading batch details");
    } finally {
      setLoading(false);
    }
  };

  const toggleShowMore = () => {
    if (showMore) {
      setNumShown(10);
      setShowMore(false);
    } else {
      setNumShown(data?.linedata?.length || 0);
      setShowMore(true);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading batch details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error || !data || !data.rec || !data.rec.BATCH_ID) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex flex-col items-center">
              {/* Error Icon - Using SVG directly instead of imported component */}
              <div className="w-32 h-32 mb-6 text-red-500">
                <svg
                  className="w-full h-full"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Invalid Batch ID
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                The batch ID you're looking for doesn't exist or cannot be accessed.
              </p>
              <button
                onClick={() => window.history.back()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  const rec = data.rec;
  const linedata = data.linedata || [];

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl px-1">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {rec.INSTITUTION_NAME || ""}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Batch ID: {batchId} • Student: {rec.STUDENT_FULL_NAME || ""}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {/* Left Column - Transcript */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Transcript
              </h2>
              {transcriptUrl && (
                <a
                  href={transcriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Open in new window
                </a>
              )}
            </div>
            <div className="p-2">
              {transcriptUrl ? (
                <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <iframe
                    src={transcriptUrl}
                    title="Transcript"
                    className="w-full h-[500px] border-0"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 mb-4 text-gray-400">
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      className="w-full h-full"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Transcript Not Found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Unable to load the transcript. Please check the file URL.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Student and Course Details */}
          <div className="space-y-8">
            {/* Student Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Student Details
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                      Personal Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Student Name</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.STUDENT_FULL_NAME || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Student ID</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.STUDENT_ID || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.DATE_OF_BIRTH || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">SSN</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.SSN || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                      Academic Summary
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">CGPA</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.CGPA || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Credits Earned</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {rec.TOTAL_CREDITS_EARNED || "N/A"}
                        </p>
                      </div>
                      {rec.DEGREE_CD && (
                        <>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Degree</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {rec.DEGREE_CD}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Degree Date</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {rec.DEGREE_RECEIVED_DATE || "N/A"}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Institution Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Institution Details
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Banner Institution Name</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {rec.INSTITUTION_NAME || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Transcript Institution Name</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {rec.EXTERNAL_INSTITUTION_NAME || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Institution ID</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {rec.INSTITUTION_ID || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                    Course Details
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {numShown} of {linedata.length} courses
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Term
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Course ID
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {linedata.slice(0, numShown).map((line: any, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                          {line.START_TERM || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                          {line.SUBJECT || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                          {line.COURSE_ID || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                          {line.COURSE_TITLE || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                          {line.CREDIT_HOURS_EARNED || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {line.GRADE || "N/A"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {linedata.length > 10 && (
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 text-center">
                  <button
                    onClick={toggleShowMore}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900 dark:hover:bg-blue-800 transition-colors"
                  >
                    {showMore ? "Show Less" : "Show More"}
                    <svg
                      className={`ml-2 w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}