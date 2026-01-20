import { useState, useEffect } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../config/api";
import { ArrowUpIcon } from "../../../icons";

export default function TranscriptsUpload() {
  const [sourceType, setSourceType] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch available source types
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/school/transcripts/sources`)
      .then(res => res.json())
      .then(data => {
        if (data.sources) {
          setSources(data.sources);
          // Set default to "Scanned" if available
          if (data.sources.includes("Scanned")) {
            setSourceType("Scanned");
          }
        }
      })
      .catch(err => {
        console.error("Error fetching source types:", err);
      });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length > 10) {
        setMessage({ type: "error", text: "Please upload a maximum of 10 files" });
        return;
      }
      // Validate PDF files
      const pdfFiles = files.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
      if (pdfFiles.length !== files.length) {
        setMessage({ type: "error", text: "Only PDF files are allowed" });
        return;
      }
      setSelectedFiles(pdfFiles);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sourceType) {
      setMessage({ type: "error", text: "Please select Source Type" });
      return;
    }

    if (selectedFiles.length === 0) {
      setMessage({ type: "error", text: "Please upload at least one PDF file" });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("source_type", sourceType);
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch(`${API_BASE_URL}/school/transcripts/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: "success", text: data.message || "Successfully uploaded for processing" });
        setSelectedFiles([]);
        // Reset file input
        const fileInput = document.getElementById("transcript_files") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setMessage({ type: "error", text: data.detail || data.message || "Upload failed" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Transcripts Upload | High School Module"
        description="Upload transcripts for processing"
      />
      <PageBreadcrumb pageTitle="Transcripts Upload" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl mb-4">
            High School Transcripts Upload
          </h3>

          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === "success" 
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Source <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  required
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select Source</option>
                  {sources.map(source => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  PDF File <span className="text-red-500">*</span>
                </label>
                <input
                  id="transcript_files"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileChange}
                  required
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
                {selectedFiles.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {selectedFiles.length} file(s) selected
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={uploading}
                startIcon={<ArrowUpIcon className="w-5 h-5" />}
              >
                {uploading ? "Uploading..." : "Submit"}
              </Button>
            </div>
          </form>

          {sourceType === "Scanned" && (
            <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <h4 className="font-semibold mb-4 text-gray-800 dark:text-white">
                GUIDELINES TO BE FOLLOWED WHILE UPLOADING TRANSCRIPTS
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Only PDF documents should be uploaded</li>
                <li>Upload all the pages of a transcript in one single pdf document</li>
                <li>Upload a properly scanned file with all the borders of the Transcript visible. For e.g. No borders should be trimmed which have High School name printed</li>
                <li>UNOFFICIAL transcript should not be uploaded. Only upload Official transcripts</li>
                <li>If any file has restricted permissions, please save it using the "Print as pdf" and then upload the file. It will have "PRINTED COPY" printed everywhere on the transcript</li>
                <li>Transcript scanned should not be skewed. The lines should be horizontally and vertically aligned</li>
                <li>Ensure that the institution name and other identifying marks are not missed during the scanning process</li>
                <li>Do not compress the size of the pdf after scanning. Upload it without compressing</li>
                <li>Please upload no more than 10 transcript files in a single batch.</li>
                <li>Ensure that the transcript filename does not contain any special characters.</li>
              </ul>
            </div>
          )}
        </div>
      </PageContainer>
    </PageWrapper>
  );
}



