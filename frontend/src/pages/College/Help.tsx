import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { PageWrapper } from "../../components/common/PageContainer";
import Button from "../../components/ui/button/Button";
import { DownloadIcon, ArrowRightIcon } from "../../icons";

export default function Help() {
  // PDF URL - can be configured via environment variable or use relative path
  // The PDF is now in the public folder and can be accessed directly
  // Fallback to CI3 path if needed for backward compatibility
  const pdfUrl = import.meta.env.VITE_HELP_PDF_URL || 
    "/OSU_OKC_Portal_User_Manual.pdf";
  
  const [hasError, setHasError] = useState(false);

  const handleIframeError = () => {
    setHasError(true);
  };

  const handleDownload = () => {
    window.open(pdfUrl, "_blank");
  };

  return (
    <PageWrapper>
      <PageMeta
        title="User Manual | College Module"
        description="OSU-CSC User Manual Document"
      />
      <PageBreadcrumb pageTitle="User Manual" />
      <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mx-auto w-full">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
              OSU-CSC User Manual Document
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <DownloadIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Download PDF</span>
                <span className="sm:hidden">Download</span>
              </Button>
              <Button
                onClick={() => window.open(pdfUrl, "_blank")}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowRightIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Open in New Tab</span>
                <span className="sm:hidden">Open</span>
              </Button>
            </div>
          </div>
          
          {hasError ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-12 dark:border-gray-800 dark:bg-gray-900/50">
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Unable to load the PDF viewer. Please try downloading or opening in a new tab.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDownload} variant="default">
                  Download PDF
                </Button>
                <Button
                  onClick={() => window.open(pdfUrl, "_blank")}
                  variant="outline"
                >
                  Open in New Tab
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <iframe
                src={pdfUrl}
                title="OSU CSC User Manual"
                className="h-[600px] w-full sm:h-[800px] lg:h-[900px]"
                style={{ minHeight: "600px" }}
                onError={handleIframeError}
                onLoad={() => setHasError(false)}
              />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

